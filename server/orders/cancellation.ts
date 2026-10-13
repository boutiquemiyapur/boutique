import { randomUUID } from 'node:crypto';
import { RefundSettingsService } from './refundSettings.js';
import type { ApprovedRefundReview } from '../../src/types/refundManagement.js';
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
import { validateRefundEvidence } from '../payments/refundEvidence.js';

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
    validateRefundEvidence(refunds, paymentId, total);
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
      // Provider inspection happens outside the transaction. Revalidate BOTH
      // paid and unpaid quotes against its current snapshot before restoring
      // stock or recording a refund decision. A newly authorized/captured
      // payment must be inspected again, never approved as NOT_REQUIRED.
      requireCondition(!approve || (quote.captured
        ? confirmedPayment(current) && current.razorpayPaymentId === quote.paymentId && Number(current.amountPaise) - Number(current.refundedAmountPaise || 0) === quote.amountPaise
        : historicalCod(current) || (!['AUTHORIZED', 'PAID', 'REFUND_PENDING', 'PARTIALLY_REFUNDED', 'REFUNDED'].includes(current.paymentStatus) && !current.paidAt && !current.paymentVerifiedAt && !current.razorpayPaymentId)), 'REFUND_QUOTE_CHANGED', 409);
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
        next.refund = { state: quote.captured && quote.amountPaise > 0 ? 'AWAITING_ENABLEMENT' : 'NOT_REQUIRED', amountPaise: quote.amountPaise, ...('paymentId' in quote ? { paymentId: quote.paymentId } : {}), idempotencyKey: `abr-${digest(id).slice(0, 32)}`, approvedBy: adminUid, approvedAt: at, updatedAt: at };
        for (const u of updates) tx.update(u.ref, u.data);
        if (restore) { tx.update(rr, { state: inventory, cancelledAt: this.now() }); tx.set(this.ref('inventoryMovements', `${id}-cancel`), { orderId: id, type: inventory, items: reservation!.items, approvedBy: adminUid, createdAt: new Date(this.now()) }); }
      }
      tx.update(ref, { data: sanitizeFirestoreData(next), orderStatus: next.orderStatus, updatedAt: new Date(this.now()) });
      tx.set(this.ref('cancellationAudits', `${id}-decision`), { orderId: id, action: approve ? 'APPROVED' : 'REJECTED', reason, by: adminUid, at });
      return next;
    });
    return order; // Approval never initiates money movement; individual confirmation is separate.
  }
  private async execute(id: string, adminUid: string, reviewId: string) {
    requireCondition(this.executeRefunds && this.provider.createRefund, 'LIVE_REFUNDS_DISABLED', 409);
    const policy = new RefundSettingsService(this.db, this.executeRefunds, this.now); policy.requireEnabled(await policy.read());
    const record = await this.record(id); const current = record.data as Order;
    requireCondition(current.orderStatus === 'Cancelled' && current.cancellationRequest?.status === 'APPROVED' && current.refund?.approvedBy, 'ADMIN_APPROVAL_REQUIRED', 403);
    if (['PROCESSED', 'FAILED', 'MANUAL_REVIEW', 'NOT_REQUIRED'].includes(current.refund.state)) return current;
    if (!this.validRefundTimes(current.refund)) { await this.updateRefund(id, { state: 'MANUAL_REVIEW', error: 'REFUND_TIMESTAMPS_INVALID' }); return (await this.record(id)).data as Order; }
    requireCondition(this.authorizedRefund(current.refund) && current.refund.executionAuthorization!.adminUid === adminUid && current.refund.executionAuthorization!.reviewId === reviewId, 'REFUND_CONFIRMATION_REQUIRED', 409);
    await this.syncRefund(id);
    const after = (await this.record(id)).data as Order;
    if (after.refund?.id || after.refund?.state === 'MANUAL_REVIEW') return after;
    if (this.now() - Date.parse(after.refund!.approvedAt || '') > 86_400_000) { await this.updateRefund(id, { state: 'MANUAL_REVIEW', error: 'REFUND_RETRY_WINDOW_EXPIRED' }); return (await this.record(id)).data as Order; }
    const quote = await this.quote(id);
    const claimed = await this.db.runTransaction(async tx => {
      const ref = this.ref('orders', id); const order = (await tx.get(ref)).data()!.data as Order; const refund = order.refund!;
      const settings = policy.snapshot((await tx.get(policy.ref())).data()); policy.requireEnabled(settings);
      requireCondition(this.authorizedRefund(refund) && refund.executionAuthorization!.adminUid === adminUid && refund.executionAuthorization!.reviewId === reviewId && refund.executionAuthorization!.settingsRevision === settings.revision, 'REFUND_SETTINGS_CHANGED', 409);
      requireCondition(order.cancellationRequest?.status === 'APPROVED' && order.orderStatus === 'Cancelled' && refund.approvedBy, 'ADMIN_APPROVAL_REQUIRED', 403);
      if (!this.validRefundTimes(refund) || this.now() - Date.parse(refund.approvedAt!) > 86_400_000) {
        const at = new Date(this.now()).toISOString();
        tx.update(ref, { 'data.refund.state': 'MANUAL_REVIEW', 'data.refund.error': 'REFUND_TIMESTAMPS_INVALID', 'data.refund.updatedAt': at, updatedAt: new Date(this.now()) });
        tx.set(this.ref('cancellationAudits', `${id}-invalid-refund-time`), { orderId: id, action: 'REFUND_MANUAL_REVIEW', at, approvedBy: refund.approvedBy });
        return null;
      }
      if (refund.id || (refund.state === 'INITIATING' && this.now() - Date.parse(refund.updatedAt) < 60_000)) return null;
      requireCondition(['APPROVED', 'AWAITING_ENABLEMENT', 'UNKNOWN', 'INITIATING'].includes(refund.state) && quote.captured && quote.paymentId === refund.paymentId && quote.amountPaise === refund.amountPaise && quote.amountPaise >= 100, 'REFUND_QUOTE_CHANGED', 409);
      const at = new Date(this.now()).toISOString();
      tx.update(ref, { 'data.refund.state': 'INITIATING', 'data.refund.updatedAt': at, 'data.cancellationRequest.audit': [...order.cancellationRequest!.audit, { action: 'REFUND_INITIATING', at, by: 'trusted-backend' }].slice(-30), updatedAt: new Date(this.now()) });
      tx.set(this.ref('cancellationAudits', `${id}-refund-${digest(`INITIATING-${at}`).slice(0, 16)}`), { orderId: id, action: 'REFUND_INITIATING', at, approvedBy: refund.approvedBy, amountPaise: refund.amountPaise, paymentId: refund.paymentId });
      return refund;
    });
    if (!claimed) return (await this.record(id)).data as Order;
    try {
      // Stable key and immutable body survive ambiguous network responses.
      // Recheck the policy immediately before transport; OFF prevents new sends.
      const finalPolicy = await policy.read(); policy.requireEnabled(finalPolicy);
      requireCondition(claimed.executionAuthorization!.settingsRevision === finalPolicy.revision, 'REFUND_SETTINGS_CHANGED', 409);
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
    // Status-only, even with both gates ON and a prior individual confirmation.
    // A lost/unknown attempt needs a NEW manual admin review before any send.
    const order = (await this.record(id)).data as Order;
    if (order.cancellationRequest?.status === 'APPROVED' && order.refund && !order.refund.id && ['AWAITING_ENABLEMENT', 'APPROVED', 'INITIATING', 'UNKNOWN'].includes(order.refund.state)
      && (!this.validRefundTimes(order.refund) || this.now() - Date.parse(order.refund.approvedAt!) > 86_400_000)) {
      await this.updateRefund(id, { state: 'MANUAL_REVIEW', error: 'REFUND_APPROVAL_REVIEW_REQUIRED' });
      await this.syncRefund(id); // Discover an existing provider refund; never initiate another.
      return (await this.record(id)).data as Order;
    }
    await this.syncRefund(id);
    return (await this.record(id)).data as Order;
  }
  validRefundTimes(refund: NonNullable<Order['refund']>) {
    const valid = (v: unknown) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(v) && Number.isFinite(Date.parse(v)) && new Date(v).toISOString() === v;
    return valid(refund.approvedAt) && valid(refund.updatedAt) && Date.parse(refund.approvedAt!) <= Date.parse(refund.updatedAt) && Date.parse(refund.updatedAt) <= this.now();
  }
  authorizedRefund(refund: NonNullable<Order['refund']>) {
    const a = refund.executionAuthorization;
    return !!a && typeof a.adminUid === 'string' && a.adminUid.length > 0 && typeof a.reviewId === 'string' && a.reviewId.length > 0
      && typeof a.confirmedAt === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(a.confirmedAt) && Number.isFinite(Date.parse(a.confirmedAt)) && new Date(a.confirmedAt).toISOString() === a.confirmedAt && Date.parse(a.confirmedAt) <= this.now()
      && Number.isSafeInteger(a.settingsRevision) && a.settingsRevision > 0
      && a.paymentId === refund.paymentId && a.amountPaise === refund.amountPaise && a.idempotencyKey === refund.idempotencyKey && a.approvedAt === refund.approvedAt;
  }
  async auditAction(adminUid: string, id: string, action: string) {
    await this.db.runTransaction(async tx => tx.set(this.ref('cancellationAudits', `${id}-${randomUUID()}`), { orderId: id, action, by: adminUid, at: new Date(this.now()).toISOString() }));
  }
  async retryApprovedRefund(adminUid: string, id: string) {
    // Legacy retry requests cannot send money using an old confirmation.
    requireCondition(this.executeRefunds, 'LIVE_REFUNDS_DISABLED', 409);
    await this.auditAction(adminUid, id, 'REFUND_RETRY_REQUESTED');
    requireCondition(false, 'REFUND_CONFIRMATION_REQUIRED', 409);
  }
  async prepareRefundReview(adminUid: string, id: string): Promise<ApprovedRefundReview> {
    await this.auditAction(adminUid, id, 'REFUND_REVIEWED');
    const policy = new RefundSettingsService(this.db, this.executeRefunds, this.now); const settings = await policy.read();
    let order = (await this.record(id)).data as Order;
    requireCondition(order.orderStatus === 'Cancelled' && order.cancellationRequest?.status === 'APPROVED' && order.refund?.approvedBy, 'ADMIN_APPROVAL_REQUIRED', 403);
    const result = (reason?: string): ApprovedRefundReview => ({ orderId: id, paymentId: order.refund?.paymentId, amountPaise: order.refund?.amountPaise || 0, currency: 'INR', state: order.refund!.state, refundId: order.refund?.id, approvedAt: order.refund?.approvedAt, canExecute: false, settings, ...(reason ? { reason } : {}) });
    if (!order.refund?.id && (!this.validRefundTimes(order.refund!) || this.now() - Date.parse(order.refund!.approvedAt!) > 86_400_000)) {
      await this.updateRefund(id, { state: 'MANUAL_REVIEW', error: 'REFUND_APPROVAL_REVIEW_REQUIRED' }); await this.syncRefund(id); order = (await this.record(id)).data as Order; return result('REFUND_APPROVAL_REVIEW_REQUIRED');
    }
    await this.syncRefund(id); order = (await this.record(id)).data as Order;
    if (order.refund?.id || ['PROCESSED', 'FAILED', 'MANUAL_REVIEW', 'NOT_REQUIRED'].includes(order.refund!.state)) return result('REFUND_ALREADY_RECORDED_OR_REVIEW_REQUIRED');
    if (!this.validRefundTimes(order.refund!) || this.now() - Date.parse(order.refund!.approvedAt!) > 86_400_000) {
      await this.updateRefund(id, { state: 'MANUAL_REVIEW', error: 'REFUND_APPROVAL_REVIEW_REQUIRED' }); order = (await this.record(id)).data as Order; return result('REFUND_APPROVAL_REVIEW_REQUIRED');
    }
    const quote = await this.quote(id); order = (await this.record(id)).data as Order;
    requireCondition(quote.captured && quote.paymentId === order.refund!.paymentId && quote.amountPaise === order.refund!.amountPaise && quote.amountPaise > 0, 'REFUND_QUOTE_CHANGED', 409);
    if (quote.amountPaise < 100) { await this.updateRefund(id, { state: 'MANUAL_REVIEW', error: 'REFUND_AMOUNT_BELOW_PROVIDER_MINIMUM' }); order = (await this.record(id)).data as Order; return result('REFUND_APPROVAL_REVIEW_REQUIRED'); }
    if (!settings.effectiveEnabled) return result(settings.codeEnabled ? 'ADMIN_REFUNDS_DISABLED' : 'LIVE_REFUNDS_DISABLED');
    const reviewId = randomUUID(); const expiresAt = this.now() + 300_000;
    await this.db.runTransaction(async tx => {
      const current = (await tx.get(this.ref('orders', id))).data()!.data as Order;
      const fresh = policy.snapshot((await tx.get(policy.ref())).data()); policy.requireEnabled(fresh);
      requireCondition(fresh.revision === settings.revision && current.refund?.approvedAt === order.refund!.approvedAt && current.refund?.amountPaise === quote.amountPaise && current.refund?.paymentId === quote.paymentId, 'REFUND_QUOTE_CHANGED', 409);
      tx.set(this.ref('refundReviews', reviewId), { adminUid, orderId: id, paymentId: quote.paymentId, amountPaise: quote.amountPaise, settingsRevision: settings.revision, approvedAt: current.refund!.approvedAt, idempotencyKey: current.refund!.idempotencyKey, expiresAt, consumed: false, createdAt: new Date(this.now()).toISOString() });
    });
    return { ...result(), canExecute: true, reviewId, expiresAt: new Date(expiresAt).toISOString() };
  }
  async confirmReviewedRefund(adminUid: string, id: string, reviewId: string, confirmed: boolean) {
    requireCondition(confirmed === true, 'REFUND_CONFIRMATION_REQUIRED');
    await this.auditAction(adminUid, id, 'REFUND_EXECUTION_REQUESTED');
    const policy = new RefundSettingsService(this.db, this.executeRefunds, this.now); policy.requireEnabled(await policy.read());
    const saved = (await this.ref('refundReviews', reviewId).get()).data();
    requireCondition(saved?.adminUid === adminUid && saved?.orderId === id && Number.isSafeInteger(saved?.expiresAt) && saved.expiresAt > this.now(), 'REFUND_REVIEW_EXPIRED_OR_INVALID', 409);
    if (saved.consumed) return this.recoverRefund(id);
    const quote = await this.quote(id);
    const authorized = await this.db.runTransaction(async tx => {
      const rr = this.ref('refundReviews', reviewId); const review = (await tx.get(rr)).data();
      const ref = this.ref('orders', id); const order = (await tx.get(ref)).data()!.data as Order; const refund = order.refund;
      const settings = policy.snapshot((await tx.get(policy.ref())).data()); policy.requireEnabled(settings);
      const attempt = await tx.get(this.ref('paymentAttempts', id));
      requireCondition(review?.adminUid === adminUid && review?.orderId === id && review.expiresAt > this.now(), 'REFUND_REVIEW_EXPIRED_OR_INVALID', 409);
      if (review.consumed) return false;
      requireCondition(order.orderStatus === 'Cancelled' && order.cancellationRequest?.status === 'APPROVED' && refund?.approvedBy && this.validRefundTimes(refund) && this.now() - Date.parse(refund.approvedAt!) <= 86_400_000, 'REFUND_APPROVAL_REVIEW_REQUIRED', 409);
      requireCondition(!refund.id && !['PROCESSED', 'FAILED', 'MANUAL_REVIEW', 'NOT_REQUIRED'].includes(refund.state) && settings.revision === review.settingsRevision && quote.captured && quote.paymentId === review.paymentId && quote.amountPaise === review.amountPaise && refund.paymentId === review.paymentId && refund.amountPaise === review.amountPaise && refund.approvedAt === review.approvedAt && refund.idempotencyKey === review.idempotencyKey, 'REFUND_QUOTE_CHANGED', 409);
      const at = new Date(this.now()).toISOString();
      tx.update(ref, { 'data.refund.executionAuthorization': { adminUid, confirmedAt: at, reviewId, settingsRevision: settings.revision, paymentId: review.paymentId, amountPaise: review.amountPaise, idempotencyKey: review.idempotencyKey, approvedAt: review.approvedAt }, 'data.cancellationRequest.audit': [...order.cancellationRequest.audit, { action: 'REFUND_EXECUTION_CONFIRMED', at, by: adminUid }].slice(-30) });
      tx.update(rr, { consumed: true, consumedAt: at });
      if (attempt.exists) tx.update(attempt.ref, { nextCheckAt: this.now() + 60_000 });
      tx.set(this.ref('cancellationAudits', `${id}-confirmed-${reviewId}`), { orderId: id, action: 'REFUND_EXECUTION_CONFIRMED', by: adminUid, at, amountPaise: review.amountPaise, paymentId: review.paymentId });
      return true;
    });
    return authorized ? this.execute(id, adminUid, reviewId) : this.recoverRefund(id);
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
