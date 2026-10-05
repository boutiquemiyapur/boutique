import type { Firestore } from 'firebase-admin/firestore';
import type { Order, PaymentState } from '../../src/types/index.js';
import { sanitizeFirestoreData } from '../../src/utils/firestoreData.js';
import { withDeductedStock, productFromDocument, hasVariantInventory, variantKey } from '../../src/utils/productData.js';
import { trustedCheckout } from './checkout.js';
import { PaymentError, requireCondition } from './errors.js';
import { checkoutId, fingerprint, digest, type CheckoutRequest } from './validation.js';
import { validSignature, type PaymentProvider, type ProviderOrder, type ProviderPayment } from './provider.js';

const PAID = ['PAID', 'REFUND_PENDING', 'PARTIALLY_REFUNDED', 'REFUNDED'];
type ReservedLine = { productId: string; color: string; size: string; quantity: number; variantInventory: boolean };
type Reservation = { customerId: string; orderId: string; state: 'RESERVED' | 'CONSUMED' | 'RELEASED'; expiresAt: number; items: ReservedLine[] };
export class PaymentService {
  constructor(public db: Firestore, public provider: PaymentProvider, public now = () => Date.now()) {}
  ref(collection: string, id: string) { return this.db.collection(collection).doc(id); }
  async owned(uid: string, id: string): Promise<Order> {
    const s = await this.ref('orders', id).get();
    requireCondition(s.exists && s.data()?.customerId === uid && s.data()?.data.paymentProvider === 'razorpay', 'ORDER_NOT_FOUND', 404);
    return s.data()!.data as Order;
  }
  async create(uid: string, request: CheckoutRequest) {
    const id = checkoutId(uid, request.intentId); const fp = fingerprint(request); const now = this.now();
    const result = await this.db.runTransaction(async tx => {
      const prior = await tx.get(this.ref('checkoutRequests', id));
      if (prior.exists) {
        requireCondition(prior.data()?.customerId === uid && prior.data()?.fingerprint === fp, 'INTENT_CONFLICT', 409);
        return { fresh: false, order: (await tx.get(this.ref('orders', id))).data()!.data as Order };
      }
      const checkout = await trustedCheckout(this.db, tx, request, now);
      const iso = new Date(now).toISOString(); const expiresAt = now + 15 * 60_000;
      const order: Order = { id, checkoutIntentId: request.intentId, orderNumber: `AB-${id.slice(4, 24).toUpperCase()}`, createdAt: iso, items: checkout.items, shippingAddress: request.shippingAddress, shippingMethod: 'standard', ...checkout.legacy, subtotalINR: checkout.totals.subtotalINR, tailoringTotalINR: checkout.totals.tailoringTotalINR, couponDiscountINR: checkout.totals.couponDiscountINR, couponCodeApplied: request.couponCode, charges: checkout.totals.charges, totalINR: checkout.amountPaise / 100, amountPaise: checkout.amountPaise, currency: 'INR', paymentMethod: 'razorpay', paymentProvider: 'razorpay', paymentStatus: 'CREATED', orderStatus: 'Order Placed', reservationExpiresAt: new Date(expiresAt).toISOString(), timeline: [] };
      const versions = new Map<string, number>();
      for (const p of checkout.products) {
        // Increment version from the transaction snapshot, never from browser state.
        const productSnapshot = await tx.get(this.ref('products', p.id));
        versions.set(p.id, productSnapshot.data()?.inventoryVersion || 0);
      }
      for (const p of checkout.products) {
        const lines = checkout.items.filter(l => l.product.id === p.id).map(l => ({ colorName: l.selectedColor, size: l.selectedSize, quantity: l.quantity }));
        const version = versions.get(p.id)!;
        const data = withDeductedStock(p, lines);
        tx.update(this.ref('products', p.id), { data: sanitizeFirestoreData(data), inventoryVersion: version + 1, updatedAt: new Date(now) });
      }
      tx.set(this.ref('checkoutRequests', id), { customerId: uid, fingerprint: fp, orderId: id, createdAt: new Date(now) });
      const reserved = checkout.items.map(l => ({ productId: l.product.id, color: l.selectedColor, size: l.selectedSize, quantity: l.quantity, variantInventory: hasVariantInventory(l.product) }));
      tx.set(this.ref('inventoryReservations', id), { customerId: uid, orderId: id, state: 'RESERVED', expiresAt, items: reserved });
      tx.set(this.ref('inventoryMovements', `${id}-reserve`), { orderId: id, type: 'RESERVE', items: reserved, createdAt: new Date(now) });
      tx.set(this.ref('paymentAttempts', id), { orderId: id, customerId: uid, receipt: id.slice(4, 36), state: 'CREATING', startedAt: now, nextCheckAt: now + 60_000 });
      tx.set(this.ref('orders', id), { customerId: uid, orderNumber: order.orderNumber, paymentStatus: order.paymentStatus, orderStatus: order.orderStatus, data: sanitizeFirestoreData(order), createdAt: new Date(now), updatedAt: new Date(now) });
      return { fresh: true, order };
    });
    if (PAID.includes(result.order.paymentStatus)) return { order: result.order, checkout: null };
    if (this.now() >= Date.parse(result.order.reservationExpiresAt!)) {
      await this.reconcile(id);
      const latest = await this.owned(uid, id);
      if (PAID.includes(latest.paymentStatus)) return { order: latest, checkout: null };
      requireCondition(latest.razorpayOrderId, 'PROVIDER_CREATION_REQUIRES_REVIEW', 409);
      await this.renew(id, request);
    }
    if (!result.order.razorpayOrderId) {
      const attempt = (await this.ref('paymentAttempts', id).get()).data()!;
      let providerOrder: ProviderOrder;
      if (result.fresh) {
        try { providerOrder = await this.provider.createOrder(result.order.amountPaise!, attempt.receipt, id); }
        catch { await this.ref('paymentAttempts', id).update({ state: 'UNKNOWN' }); throw new PaymentError('PROVIDER_CREATION_UNCERTAIN', 503); }
      } else {
        requireCondition(this.now() - attempt.startedAt > 30_000, 'PAYMENT_CREATION_IN_PROGRESS', 409);
        const matches = await this.provider.findOrders(attempt.receipt, attempt.startedAt);
        requireCondition(matches.length === 1, 'PROVIDER_CREATION_REQUIRES_REVIEW', 409);
        providerOrder = matches[0];
      }
      await this.attach(id, providerOrder);
    }
    const order = await this.owned(uid, id);
    if (PAID.includes(order.paymentStatus)) return { order, checkout: null };
    return { order, checkout: { keyId: this.provider.keyId, orderId: order.razorpayOrderId!, amount: order.amountPaise!, currency: 'INR' as const, expiresAt: order.reservationExpiresAt! } };
  }
  async renew(id: string, request: CheckoutRequest) {
    await this.db.runTransaction(async tx => {
      const or = this.ref('orders', id); const order = (await tx.get(or)).data()!.data as Order;
      const rr = this.ref('inventoryReservations', id); const reservation = (await tx.get(rr)).data() as Reservation & { generation?: number };
      if (reservation.state === 'RESERVED' && reservation.expiresAt > this.now()) return;
      requireCondition(reservation.state === 'RELEASED' && !PAID.includes(order.paymentStatus) && !order.paymentReviewRequired, 'RESERVATION_REQUIRES_REVIEW', 409);
      const c = await trustedCheckout(this.db, tx, request, this.now());
      requireCondition(c.amountPaise === order.amountPaise && c.items.every((l, i) => l.product.priceINR === order.items[i].product.priceINR && l.tailoringFeeINR === order.items[i].tailoringFeeINR), 'RETRY_PRICE_CHANGED', 409);
      const versions = await tx.getAll(...c.products.map(p => this.ref('products', p.id)));
      for (const p of c.products) tx.update(this.ref('products', p.id), { data: sanitizeFirestoreData(withDeductedStock(p, c.items.filter(l => l.product.id === p.id).map(l => ({ colorName: l.selectedColor, size: l.selectedSize, quantity: l.quantity })))), inventoryVersion: (versions.find(s => s.id === p.id)!.data()!.inventoryVersion || 0) + 1, updatedAt: new Date(this.now()) });
      const generation = (reservation.generation || 1) + 1; const expiresAt = this.now() + 900_000;
      tx.set(rr, { ...reservation, generation, state: 'RESERVED', expiresAt });
      tx.set(this.ref('inventoryMovements', `${id}-reserve-${generation}`), { orderId: id, type: 'RESERVE', items: reservation.items, generation, createdAt: new Date(this.now()) });
      tx.update(or, { 'data.reservationExpiresAt': new Date(expiresAt).toISOString(), 'data.paymentStatus': 'PAYMENT_PENDING', paymentStatus: 'PAYMENT_PENDING', updatedAt: new Date(this.now()) });
    });
  }
  async attach(id: string, provider: ProviderOrder) {
    await this.db.runTransaction(async tx => {
      const ref = this.ref('orders', id); const snapshot = await tx.get(ref); const order = snapshot.data()!.data as Order;
      requireCondition(/^order_[a-zA-Z0-9]+$/.test(provider.id) && provider.amount === order.amountPaise && provider.currency === 'INR' && provider.receipt === id.slice(4, 36) && provider.notes?.checkoutId === id, 'PROVIDER_MAPPING_INVALID', 409);
      requireCondition(!order.razorpayOrderId || order.razorpayOrderId === provider.id, 'PROVIDER_MAPPING_CONFLICT', 409);
      const next = { ...order, razorpayOrderId: provider.id, paymentStatus: order.paymentStatus === 'CREATED' ? 'PAYMENT_PENDING' : order.paymentStatus };
      tx.update(ref, { data: next, paymentStatus: next.paymentStatus, updatedAt: new Date(this.now()) });
      tx.update(this.ref('paymentAttempts', id), { state: 'READY', razorpayOrderId: provider.id });
    });
  }
  async apply(id: string, payment: ProviderPayment, event?: { id: string; hash: string }, refundPending = false) {
    return this.db.runTransaction(async tx => {
      const ref = this.ref('orders', id); const snapshot = await tx.get(ref);
      requireCondition(snapshot.exists, 'ORDER_NOT_FOUND', 404); const order = snapshot.data()!.data as Order;
      const eventRef = event ? this.ref('paymentEvents', digest(event.id)) : null;
      const oldEvent = eventRef ? await tx.get(eventRef) : null;
      if (oldEvent?.exists) { requireCondition(oldEvent.data()?.hash === event!.hash, 'EVENT_CONFLICT', 409); return order; }
      requireCondition(order.paymentProvider === 'razorpay' && payment.order_id === order.razorpayOrderId && payment.currency === 'INR' && payment.amount === order.amountPaise && /^pay_[a-zA-Z0-9]+$/.test(payment.id), 'PAYMENT_EVIDENCE_MISMATCH', 409);
      const reservationRef = this.ref('inventoryReservations', id); const reservation = (await tx.get(reservationRef)).data() as Reservation;
      requireCondition(reservation, 'RESERVATION_MISSING', 409);
      const captured = payment.captured === true && ['captured', 'refunded'].includes(payment.status);
      requireCondition(Number.isSafeInteger(payment.amount_refunded) && payment.amount_refunded >= 0 && payment.amount_refunded <= payment.amount, 'REFUND_EVIDENCE_INVALID', 409);
      let state = order.paymentStatus as PaymentState; let next = { ...order }; const now = new Date(this.now()).toISOString();
      if (captured) {
        requireCondition(!order.razorpayPaymentId || order.razorpayPaymentId === payment.id, 'MULTIPLE_CAPTURED_PAYMENTS', 409);
        const refunded = Math.max(order.refundedAmountPaise || 0, payment.amount_refunded);
        state = refunded === payment.amount ? 'REFUNDED' : refunded > 0 ? 'PARTIALLY_REFUNDED' : refundPending ? 'REFUND_PENDING' : 'PAID';
        next = { ...next, razorpayPaymentId: payment.id, refundedAmountPaise: refunded, paidAt: order.paidAt || now, paymentVerifiedAt: order.paymentVerifiedAt || now, paymentReviewRequired: order.paymentReviewRequired === true || reservation.state === 'RELEASED' };
        if (reservation.state === 'RESERVED') {
          tx.update(reservationRef, { state: 'CONSUMED', consumedAt: this.now() });
          tx.set(this.ref('inventoryMovements', `${id}-consume`), { orderId: id, type: 'CONSUME', items: reservation.items, createdAt: new Date(this.now()) });
        }
        if (!order.paidAt) next.timeline = [...order.timeline, { status: order.orderStatus, timestamp: now, description: reservation.state === 'RELEASED' ? 'Payment received after inventory release. Store review required before fulfilment.' : 'Payment captured and verified.', completed: true }];
      } else if (!PAID.includes(order.paymentStatus) && reservation.state !== 'RELEASED') {
        if (payment.status === 'authorized') state = 'AUTHORIZED';
        else if (payment.status === 'failed' && state !== 'AUTHORIZED') state = 'FAILED';
      }
      next.paymentStatus = state;
      tx.update(ref, { data: sanitizeFirestoreData(next), paymentStatus: state, updatedAt: new Date(this.now()) });
      if (eventRef) tx.set(eventRef, { hash: event!.hash, orderId: id, paymentId: payment.id, processedAt: new Date(this.now()) });
      return next;
    });
  }
  async syncPayment(id: string, paymentId: string, event?: { id: string; hash: string }) {
    const payment = await this.provider.payment(paymentId);
    requireCondition(payment.id === paymentId, 'PAYMENT_EVIDENCE_MISMATCH', 409);
    const refunds = payment.captured ? await this.provider.refunds(paymentId) : [];
    requireCondition(refunds.every(r => r.payment_id === paymentId && Number.isSafeInteger(r.amount) && r.amount >= 0), 'REFUND_EVIDENCE_INVALID', 409);
    const processed = refunds.filter(r => r.status === 'processed').reduce((sum, r) => sum + r.amount, 0);
    return this.apply(id, { ...payment, amount_refunded: Math.max(payment.amount_refunded, processed) }, event, refunds.some(r => ['pending', 'created'].includes(r.status)));
  }
  async verify(uid: string, id: string, providerOrderId: unknown, paymentId: string, signature: string, secret: string) {
    const order = await this.owned(uid, id);
    requireCondition(order.razorpayOrderId && providerOrderId === order.razorpayOrderId, 'PROVIDER_MAPPING_INVALID', 409);
    requireCondition(validSignature(`${order.razorpayOrderId}|${paymentId}`, signature, secret), 'SIGNATURE_INVALID');
    return this.syncPayment(id, paymentId);
  }
  async release(id: string) {
    return this.db.runTransaction(async tx => {
      const rr = this.ref('inventoryReservations', id); const reservation = (await tx.get(rr)).data() as Reservation;
      const or = this.ref('orders', id); const order = (await tx.get(or)).data()!.data as Order;
      if (reservation.state !== 'RESERVED' || reservation.expiresAt > this.now() || PAID.includes(order.paymentStatus)) return false;
      const ids = [...new Set(reservation.items.map(l => l.productId))];
      const products = await tx.getAll(...ids.map(p => this.ref('products', p)));
      const updates = products.map(s => {
        // Archived products must still receive their reserved stock back.
        const raw = s.data(); requireCondition(raw, 'RESERVATION_INVENTORY_CHANGED', 409);
        const p = productFromDocument(s.id, { ...raw, status: 'active' }); requireCondition(p, 'RESERVATION_INVENTORY_CHANGED', 409);
        const lines = reservation.items.filter(l => l.productId === p.id);
        requireCondition(hasVariantInventory(p) === lines[0].variantInventory, 'RESERVATION_INVENTORY_CHANGED', 409);
        if (hasVariantInventory(p)) {
          for (const l of lines) requireCondition(p.variantInventory!.some(v => v.key === variantKey(l.color, l.size)), 'RESERVATION_INVENTORY_CHANGED', 409);
          p.variantInventory = p.variantInventory!.map(v => ({ ...v, stock: v.stock + lines.filter(l => variantKey(l.color, l.size) === v.key).reduce((sum, l) => sum + l.quantity, 0) }));
          p.stockCount = p.variantInventory.reduce((sum, v) => sum + v.stock, 0);
        } else p.stockCount += lines.reduce((sum, l) => sum + l.quantity, 0);
        return { s, p };
      });
      for (const { s, p } of updates) tx.update(s.ref, { data: sanitizeFirestoreData(p), inventoryVersion: (s.data()!.inventoryVersion || 0) + 1, updatedAt: new Date(this.now()) });
      tx.update(rr, { state: 'RELEASED', releasedAt: this.now() });
      tx.set(this.ref('inventoryMovements', `${id}-release-${(reservation as Reservation & { generation?: number }).generation || 1}`), { orderId: id, type: 'RELEASE', items: reservation.items, createdAt: new Date(this.now()) });
      tx.update(or, { 'data.paymentStatus': 'EXPIRED', paymentStatus: 'EXPIRED', updatedAt: new Date(this.now()) }); return true;
    });
  }
  async reconcile(id: string) {
    let record = (await this.ref('orders', id).get()).data(); requireCondition(record, 'ORDER_NOT_FOUND', 404);
    let order = record.data as Order;
    if (!order.razorpayOrderId) {
      const attempt = (await this.ref('paymentAttempts', id).get()).data()!;
      if (this.now() - attempt.startedAt < 30_000) return order;
      const matches = await this.provider.findOrders(attempt.receipt, attempt.startedAt);
      requireCondition(matches.length <= 1, 'PROVIDER_MAPPING_CONFLICT', 409);
      if (matches.length === 1) { await this.attach(id, matches[0]); order = (await this.ref('orders', id).get()).data()!.data; }
    }
    if (order.razorpayOrderId) {
      const payments = await this.provider.payments(order.razorpayOrderId);
      for (const payment of payments) order = await this.syncPayment(id, payment.id);
    }
    await this.release(id);
    return (await this.ref('orders', id).get()).data()!.data as Order;
  }
}

