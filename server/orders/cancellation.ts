import type { Firestore } from 'firebase-admin/firestore';
import type { Order } from '../../src/types/index.js';
import { cancellationStageEligible, CANCELLATION_REASONS } from '../../src/utils/cancellationPolicy.js';
import { confirmedPayment, historicalCod } from '../../src/utils/paymentState.js';
import { sanitizeFirestoreData } from '../../src/utils/firestoreData.js';
import { requireCondition } from '../payments/errors.js';
import { digest } from '../payments/validation.js';
import type { PaymentProvider, ProviderRefund } from '../payments/provider.js';
import { PaymentService } from '../payments/service.js';
import { restoration, type Reservation } from './inventory.js';

type Quote = { captured: boolean; amountPaise: number; paymentId?: string };
export class CancellationService {
  constructor(public db: Firestore, public provider: PaymentProvider, public executeRefunds = false, public now = () => Date.now()) {}
  ref(name: string, id: string) { return this.db.collection(name).doc(id); }
  async record(id: string) { const record = (await this.ref('orders', id).get()).data(); requireCondition(record?.data?.id === id, 'ORDER_NOT_FOUND', 404); return record; }
  eligible(order: Order) { return cancellationStageEligible(order) && !order.cancellation; }
  async request(uid: string, id: string, reason: string) {
    requireCondition(CANCELLATION_REASONS.some(r => r === reason), 'INVALID_CANCELLATION_REASON');
    return this.db.runTransaction(async tx => {
      const ref = this.ref('orders', id); let record = (await tx.get(ref)).data(); const canonical = Boolean(record);
      if (!record) {
        const legacy = (await tx.get(this.db.collection('users').doc(uid).collection('orders').doc(id))).data();
        requireCondition(legacy?.data?.id === id && historicalCod(legacy.data) && (!legacy.customerId || legacy.customerId === uid), 'ORDER_NOT_FOUND', 404);
        record = { ...legacy, customerId: uid };
      }
      requireCondition(record?.customerId === uid && record?.data?.id === id, 'ORDER_NOT_FOUND', 404);
      const order = record.data as Order;
      if (order.cancellationRequest) return order; // One durable request; retries cannot replace its reason.
      requireCondition(this.eligible(order) && !['REFUNDED', 'REFUND_PENDING'].includes(order.paymentStatus), 'CANCELLATION_INELIGIBLE', 409);
      requireCondition(historicalCod(order) || order.paymentProvider === 'razorpay', 'CANCELLATION_REVIEW_REQUIRED', 409);
      const at = new Date(this.now()).toISOString();
      const next: Order = { ...order, cancellationRequest: { status: 'REQUESTED', reason, requestedAt: at, requestedBy: uid, audit: [{ action: 'REQUESTED', at, by: uid }] } };
      const update = { data: sanitizeFirestoreData(next), updatedAt: new Date(this.now()) };
      if (canonical) tx.update(ref, update); else tx.set(ref, { ...record, ...update });
      return next;
    });
  }
  async quote(id: string): Promise<Quote> {
    const order = (await this.record(id)).data as Order;
    if (historicalCod(order)) return { captured: false, amountPaise: 0 };
    requireCondition(order.paymentProvider === 'razorpay' && order.razorpayOrderId, 'PAYMENT_REVIEW_REQUIRED', 409);
    // Read current provider evidence before approval; never use client amounts.
    const latest = await new PaymentService(this.db, this.provider, this.now).reconcile(id);
    if (!confirmedPayment(latest)) {
      requireCondition(!['AUTHORIZED', 'PAID', 'REFUND_PENDING', 'PARTIALLY_REFUNDED', 'REFUNDED'].includes(latest.paymentStatus), 'PAYMENT_REVIEW_REQUIRED', 409);
      return { captured: false, amountPaise: 0 };
    }
    const payment = await this.provider.payment(latest.razorpayPaymentId!);
    requireCondition(payment.id === latest.razorpayPaymentId && payment.order_id === latest.razorpayOrderId
      && payment.currency === 'INR' && payment.amount === latest.amountPaise && payment.captured === true
      && ['captured', 'refunded'].includes(payment.status), 'PAYMENT_EVIDENCE_MISMATCH', 409);
    const refunds = await this.provider.refunds(payment.id); this.validateRefunds(refunds, payment.id, payment.amount);
    requireCondition(!refunds.some(r => ['created', 'pending'].includes(r.status)), 'REFUND_ALREADY_PENDING', 409);
    const refunded = Math.max(payment.amount_refunded, latest.refundedAmountPaise || 0, refunds.filter(r => r.status === 'processed').reduce((n, r) => n + r.amount, 0));
    requireCondition(Number.isSafeInteger(refunded) && refunded >= 0 && refunded <= payment.amount, 'REFUND_EVIDENCE_INVALID', 409);
    return { captured: true, paymentId: payment.id, amountPaise: payment.amount - refunded };
  }
  validateRefunds(refunds: ProviderRefund[], paymentId: string, total: number) {
    const ids = new Set<string>();
    requireCondition(refunds.every(r => /^rfnd_[a-zA-Z0-9]+$/.test(r.id) && !ids.has(r.id) && !!ids.add(r.id)
      && (!r.currency || r.currency === 'INR') && r.payment_id === paymentId && Number.isSafeInteger(r.amount) && r.amount > 0 && r.amount <= total
      && ['created', 'pending', 'processed', 'failed'].includes(r.status)), 'REFUND_EVIDENCE_INVALID', 409);
  }
  async review(adminUid: string, id: string, approve: boolean, reason: string) {
    requireCondition(approve || reason.trim().length >= 2, 'DECISION_REASON_REQUIRED');
    const prior = (await this.record(id)).data as Order;
    if (prior.cancellationRequest?.status !== 'REQUESTED') { requireCondition(prior.cancellationRequest?.status === (approve ? 'APPROVED' : 'REJECTED'), 'CANCELLATION_DECISION_CONFLICT', 409); return prior; }
    const quote = approve ? await this.quote(id) : { captured: false, amountPaise: 0 };
    const order = await this.db.runTransaction(async tx => {
      const ref = this.ref('orders', id); const record = (await tx.get(ref)).data()!; const current = record.data as Order;
      requireCondition(current.cancellationRequest, 'CANCELLATION_REQUEST_MISSING', 409);
      if (current.cancellationRequest.status !== 'REQUESTED') { requireCondition(current.cancellationRequest.status === (approve ? 'APPROVED' : 'REJECTED'), 'CANCELLATION_DECISION_CONFLICT', 409); return current; }
      requireCondition(!approve || this.eligible(current), 'CANCELLATION_INELIGIBLE', 409);
      requireCondition(!approve || !quote.captured || (current.razorpayPaymentId === quote.paymentId && Number(current.amountPaise) - Number(current.refundedAmountPaise || 0) === quote.amountPaise), 'REFUND_QUOTE_CHANGED', 409);
      const rr = this.ref('inventoryReservations', id); const reservation = approve ? (await tx.get(rr)).data() as Reservation | undefined : undefined;
      let inventory: 'RESTORED' | 'RELEASED' | 'MANUAL_REVIEW' = 'MANUAL_REVIEW';
      if (reservation) requireCondition(reservation.orderId === id && reservation.customerId === record.customerId, 'RESERVATION_INVENTORY_CHANGED', 409);
      const reserveId = `${id}-reserve${(reservation?.generation || 1) > 1 ? `-${reservation!.generation}` : ''}`;
      const ledger = approve && reservation ? (await tx.get(this.ref('inventoryMovements', reserveId))).data() : undefined;
      const consumed = approve && reservation?.state === 'CONSUMED' ? (await tx.get(this.ref('inventoryMovements', `${id}-consume`))).data() : undefined;
      const trustworthy = ledger?.orderId === id && JSON.stringify(ledger.items) === JSON.stringify(reservation?.items)
        && (reservation?.state !== 'CONSUMED' || (consumed?.orderId === id && JSON.stringify(consumed.items) === JSON.stringify(reservation.items)));
      const attempt = approve ? await tx.get(this.ref('paymentAttempts', id)) : null;
      const cartRef = this.ref('carts', record.customerId);
      const cart = approve && !quote.captured ? await tx.get(cartRef) : null;
      const restore = approve && trustworthy && reservation && ['RESERVED', 'CONSUMED'].includes(reservation.state);
      const updates = restore ? await restoration(this.db, tx, reservation!, this.now()) : [];
      if (reservation?.state === 'RELEASED' || reservation?.state === 'RESTORED') inventory = reservation.state;
      if (restore) inventory = reservation!.state === 'RESERVED' ? 'RELEASED' : 'RESTORED';
      const at = new Date(this.now()).toISOString();
      const next: Order = { ...current, cancellationRequest: { ...current.cancellationRequest, status: approve ? 'APPROVED' : 'REJECTED', reviewedAt: at, reviewedBy: adminUid, decisionReason: reason, ...(approve ? { inventory } : {}), audit: [...current.cancellationRequest.audit, { action: approve ? 'APPROVED' : 'REJECTED', at, by: adminUid }] } };
      if (approve) {
        if (cart?.exists && cart.data()?.ownerId === record.customerId) tx.update(cartRef, { checkoutGeneration: `cancel-${id}`, updatedAt: new Date(this.now()) });
        if (attempt?.exists) tx.update(attempt.ref, { nextCheckAt: this.now() + 60_000 });
        next.orderStatus = 'Cancelled'; next.cancellation = { reason: current.cancellationRequest.reason, cancelledAt: at, cancelledBy: adminUid };
        next.timeline = [...current.timeline, { status: 'Cancelled', timestamp: at, description: 'Cancellation approved by the store. Refund progress is recorded separately.', completed: true }];
        next.refund = { state: quote.captured && quote.amountPaise > 0 ? this.executeRefunds ? 'APPROVED' : 'AWAITING_ENABLEMENT' : 'NOT_REQUIRED', amountPaise: quote.amountPaise, ...('paymentId' in quote ? { paymentId: quote.paymentId } : {}), idempotencyKey: `abr-${digest(id).slice(0, 32)}`, approvedBy: adminUid, approvedAt: at, updatedAt: at };
        for (const u of updates) tx.update(u.ref, u.data);
        if (restore) { tx.update(rr, { state: inventory, cancelledAt: this.now() }); tx.set(this.ref('inventoryMovements', `${id}-cancel`), { orderId: id, type: inventory, items: reservation!.items, approvedBy: adminUid, createdAt: new Date(this.now()) }); }
      }
      tx.update(ref, { data: sanitizeFirestoreData(next), orderStatus: next.orderStatus, updatedAt: new Date(this.now()) });
      tx.set(this.ref('cancellationAudits', `${id}-decision`), { orderId: id, action: approve ? 'APPROVED' : 'REJECTED', reason, by: adminUid, at });
      return next;
    });
    return approve && this.executeRefunds && order.refund?.state === 'APPROVED' ? this.execute(id) : order;
  }
  async execute(id: string) {
    requireCondition(this.executeRefunds && this.provider.createRefund, 'LIVE_REFUNDS_DISABLED', 409);
    const record = await this.record(id); const current = record.data as Order;
    requireCondition(current.orderStatus === 'Cancelled' && current.cancellationRequest?.status === 'APPROVED' && current.refund?.approvedBy, 'ADMIN_APPROVAL_REQUIRED', 403);
    if (['PROCESSED', 'FAILED', 'MANUAL_REVIEW', 'NOT_REQUIRED'].includes(current.refund.state)) return current;
    await this.syncRefund(id);
    const after = (await this.record(id)).data as Order;
    if (after.refund?.id || after.refund?.state === 'MANUAL_REVIEW') return after;
    if (this.now() - Date.parse(after.refund!.approvedAt || '') > 86_400_000) { await this.updateRefund(id, { state: 'MANUAL_REVIEW', error: 'REFUND_RETRY_WINDOW_EXPIRED' }); return (await this.record(id)).data as Order; }
    const quote = await this.quote(id);
    const claimed = await this.db.runTransaction(async tx => {
      const ref = this.ref('orders', id); const order = (await tx.get(ref)).data()!.data as Order; const refund = order.refund!;
      requireCondition(order.cancellationRequest?.status === 'APPROVED' && order.orderStatus === 'Cancelled' && refund.approvedBy, 'ADMIN_APPROVAL_REQUIRED', 403);
      if (refund.id || (refund.state === 'INITIATING' && this.now() - Date.parse(refund.updatedAt) < 60_000)) return null;
      requireCondition(['APPROVED', 'AWAITING_ENABLEMENT', 'UNKNOWN', 'INITIATING'].includes(refund.state) && quote.captured && quote.paymentId === refund.paymentId && quote.amountPaise === refund.amountPaise && quote.amountPaise > 0, 'REFUND_QUOTE_CHANGED', 409);
      const at = new Date(this.now()).toISOString();
      tx.update(ref, { 'data.refund.state': 'INITIATING', 'data.refund.updatedAt': at, 'data.cancellationRequest.audit': [...order.cancellationRequest!.audit, { action: 'REFUND_INITIATING', at, by: 'trusted-backend' }].slice(-30), updatedAt: new Date(this.now()) });
      tx.set(this.ref('cancellationAudits', `${id}-refund-${digest(`INITIATING-${at}`).slice(0, 16)}`), { orderId: id, action: 'REFUND_INITIATING', at, approvedBy: refund.approvedBy, amountPaise: refund.amountPaise, paymentId: refund.paymentId });
      return refund;
    });
    if (!claimed) return (await this.record(id)).data as Order;
    try {
      // Stable key and immutable body survive ambiguous network responses.
      const refund = await this.provider.createRefund!(claimed.paymentId!, claimed.amountPaise, claimed.idempotencyKey!);
      requireCondition(refund.payment_id === claimed.paymentId && refund.amount === claimed.amountPaise, 'REFUND_EVIDENCE_MISMATCH', 409);
      this.validateRefunds([refund], claimed.paymentId!, claimed.amountPaise);
      await this.updateRefund(id, { id: refund.id, state: refund.status === 'processed' ? 'PROCESSED' : refund.status === 'failed' ? 'FAILED' : 'PENDING' });
      await new PaymentService(this.db, this.provider, this.now).syncPayment(id, claimed.paymentId!);
    } catch { await this.updateRefund(id, { state: 'UNKNOWN', error: 'REFUND_RECONCILIATION_REQUIRED' }); }
    return (await this.record(id)).data as Order;
  }
  async updateRefund(id: string, patch: Partial<NonNullable<Order['refund']>>) {
    await this.db.runTransaction(async tx => {
      const ref = this.ref('orders', id); const order = (await tx.get(ref)).data()!.data as Order;
      requireCondition(order.cancellationRequest?.status === 'APPROVED' && order.refund?.approvedBy, 'ADMIN_APPROVAL_REQUIRED', 403);
      const refund = order.refund!;
      if (refund.state === 'PROCESSED' || (refund.state === 'FAILED' && patch.state !== 'PROCESSED') || (patch.state === 'UNKNOWN' && refund.id)) return;
      requireCondition(!refund.id || !patch.id || refund.id === patch.id, 'REFUND_EVIDENCE_MISMATCH', 409);
      const at = new Date(this.now()).toISOString();
      const audit = patch.state && refund.state !== patch.state ? [...order.cancellationRequest!.audit, { action: `REFUND_${patch.state}`, at, by: 'trusted-backend' }].slice(-30) : order.cancellationRequest!.audit;
      tx.update(ref, { 'data.refund': sanitizeFirestoreData({ ...refund, ...patch, updatedAt: at }), 'data.cancellationRequest.audit': audit, updatedAt: new Date(this.now()) });
      if (patch.state && refund.state !== patch.state) tx.set(this.ref('cancellationAudits', `${id}-refund-${digest(`${patch.state}-${at}`).slice(0, 16)}`), sanitizeFirestoreData({ orderId: id, action: `REFUND_${patch.state}`, at, approvedBy: refund.approvedBy, refundId: patch.id || refund.id, amountPaise: refund.amountPaise }));
    });
  }
  async recoverRefund(id: string) {
    await this.syncRefund(id);
    const order = (await this.record(id)).data as Order;
    if (this.executeRefunds && order.cancellationRequest?.status === 'APPROVED' && ['APPROVED', 'INITIATING', 'UNKNOWN'].includes(order.refund?.state || '')) return this.execute(id);
    return order;
  }
  async retryApprovedRefund(adminUid: string, id: string) {
    requireCondition(this.executeRefunds, 'LIVE_REFUNDS_DISABLED', 409);
    const order = (await this.record(id)).data as Order;
    requireCondition(order.cancellationRequest?.status === 'APPROVED' && order.orderStatus === 'Cancelled', 'ADMIN_APPROVAL_REQUIRED', 403);
    if (order.refund?.state === 'NOT_REQUIRED') {
      const quote = await this.quote(id);
      if (!quote.captured || !quote.amountPaise) return order;
      await this.db.runTransaction(async tx => {
        const ref = this.ref('orders', id); const latest = (await tx.get(ref)).data()!.data as Order;
        requireCondition(latest.cancellationRequest?.status === 'APPROVED' && latest.orderStatus === 'Cancelled' && latest.refund?.state === 'NOT_REQUIRED', 'REFUND_QUOTE_CHANGED', 409);
        tx.update(ref, { 'data.refund': { ...latest.refund, state: 'APPROVED', paymentId: quote.paymentId, amountPaise: quote.amountPaise, approvedBy: adminUid, approvedAt: new Date(this.now()).toISOString(), updatedAt: new Date(this.now()).toISOString() } });
      });
    }
    return this.execute(id);
  }
  async syncRefund(id: string) {
    const order = (await this.record(id)).data as Order;
    if (order.cancellationRequest?.status !== 'APPROVED' || !order.refund?.paymentId || !order.refund.amountPaise) return;
    requireCondition(confirmedPayment(order) && order.refund.approvedBy && order.refund.paymentId === order.razorpayPaymentId && Number.isSafeInteger(order.refund.amountPaise) && order.refund.amountPaise > 0 && order.refund.amountPaise <= Number(order.amountPaise), 'REFUND_EVIDENCE_MISMATCH', 409);
    const refunds = await this.provider.refunds(order.refund.paymentId);
    this.validateRefunds(refunds, order.refund.paymentId, Number(order.amountPaise));
    const matches = refunds.filter(r => r.id === order.refund!.id || (!order.refund!.id && r.receipt === order.refund!.idempotencyKey));
    if (matches.length > 1) { await this.updateRefund(id, { state: 'MANUAL_REVIEW', error: 'REFUND_MAPPING_REVIEW' }); return; }
    if (!matches.length && (refunds.some(r => ['created', 'pending'].includes(r.status)) || refunds.filter(r => r.status === 'processed').reduce((n, r) => n + r.amount, 0) > Number(order.amountPaise) - order.refund.amountPaise)) {
      await this.updateRefund(id, { state: 'MANUAL_REVIEW', error: 'EXTERNAL_REFUND_MAPPING_REVIEW' }); return;
    }
    if (matches.length === 1) {
      const r = matches[0]; requireCondition(r.amount === order.refund.amountPaise, 'REFUND_EVIDENCE_MISMATCH', 409);
      await this.updateRefund(id, { id: r.id, state: r.status === 'processed' ? 'PROCESSED' : r.status === 'failed' ? 'FAILED' : 'PENDING' });
    }
  }
}
