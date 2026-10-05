import type { Firestore } from 'firebase-admin/firestore';
import type { Order, OrderStatus } from '../../src/types/index.js';
import { requireCondition } from '../payments/errors.js';
export async function fulfilOrder(db: Firestore, uid: string, id: string, status: OrderStatus, trackingNumber = '') {
  return db.runTransaction(async tx => {
      const ref = db.collection('orders').doc(id); const existing = await tx.get(ref); let record = existing.data();
      if (!record) {
        const legacy = await tx.get(db.collectionGroup('orders').where('data.id', '==', id));
        const candidates = legacy.docs.filter(s => /^users\/[^/]+\/orders\/[^/]+$/.test(s.ref.path) && s.data()?.data?.paymentMethod === 'cod');
        requireCondition(candidates.length === 1, 'ORDER_NOT_FOUND', 404);
        record = { ...candidates[0].data(), customerId: candidates[0].ref.path.split('/')[1] };
      }
      const current = record.data as Order;
      requireCondition(current && current.id === id && ((current.paymentMethod === 'cod' && (!current.paymentProvider || current.paymentProvider === 'cod') && !current.razorpayOrderId && !current.razorpayPaymentId && !current.paymentVerifiedAt) || (current.paymentProvider === 'razorpay' && current.paymentStatus === 'PAID' && current.paymentReviewRequired === false)), 'PAYMENT_NOT_READY_FOR_FULFILMENT', 409);
      const updated = { ...current, orderStatus: status, ...(trackingNumber ? { trackingNumber } : {}), timeline: current.orderStatus === status ? current.timeline : [...current.timeline, { status, timestamp: new Date().toISOString(), description: `Order status updated to ${status}.`, completed: true }] };
      // A missing canonical historical COD record is copied faithfully, never
      // relabelled as a provider payment. All financial fields are preserved.
      tx.set(ref, { ...record, data: updated, orderStatus: status, updatedAt: new Date(), fulfilmentUpdatedBy: uid });
      return updated;
    });
}
