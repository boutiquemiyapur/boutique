import type { Order } from '../types';

export type PaymentOutcome =
  | { kind: 'dismissed' | 'pending' | 'confirmed'; order: Order }
  | { kind: 'error'; order?: Order; message: string };

// These are display checks on trusted API/Firestore records, never proof supplied
// by Checkout callbacks. The server remains the authority for all financial writes.
export const confirmedPayment = (order: Order) =>
  order.paymentMethod === 'razorpay' && order.paymentProvider === 'razorpay'
  && ['PAID', 'REFUND_PENDING', 'PARTIALLY_REFUNDED', 'REFUNDED'].includes(order.paymentStatus)
  && /^order_[a-zA-Z0-9]+$/.test(order.razorpayOrderId || '')
  && /^pay_[a-zA-Z0-9]+$/.test(order.razorpayPaymentId || '')
  && order.currency === 'INR' && Number.isSafeInteger(order.amountPaise) && Number(order.amountPaise) >= 100
  && Number.isFinite(Date.parse(order.paidAt || ''))
  && Number.isFinite(Date.parse(order.paymentVerifiedAt || ''));

export const paymentSucceeded = (order: Order) => confirmedPayment(order)
  && order.paymentStatus === 'PAID' && order.paymentReviewRequired === false;

export const historicalCod = (order: Order) => order.paymentMethod === 'cod'
  && (!order.paymentProvider || order.paymentProvider === 'cod')
  && !order.razorpayOrderId && !order.razorpayPaymentId && !order.paymentVerifiedAt;
export const fulfilmentEligible = (order: Order) => historicalCod(order) || paymentSucceeded(order);
export const completedSale = (order: Order) => order.orderStatus === 'Delivered'
  && (paymentSucceeded(order) || (historicalCod(order) && order.paymentStatus === 'Paid'));
export function capturedRevenue(order: Order) {
  if (!confirmedPayment(order) || order.paymentStatus === 'REFUNDED') return 0;
  const refunded = order.refundedAmountPaise ?? (order.paymentStatus === 'PARTIALLY_REFUNDED' ? NaN : 0);
  if (!Number.isSafeInteger(refunded) || refunded < 0 || refunded > Number(order.amountPaise)) return 0;
  return (Number(order.amountPaise) - refunded) / 100;
}

export function paymentGroup(order: Order) {
  if (order.paymentReviewRequired || (order.paymentMethod !== 'cod' && order.paymentProvider !== 'razorpay')) return 'review';
  if (['REFUND_PENDING', 'PARTIALLY_REFUNDED', 'REFUNDED'].includes(order.paymentStatus)) return confirmedPayment(order) ? 'refund' : 'review';
  if (paymentSucceeded(order)) return 'paid';
  if (order.cancellation && !confirmedPayment(order)) return 'cancelled';
  if (['PAID', 'Paid'].includes(order.paymentStatus) && !historicalCod(order)) return 'review';
  if (['FAILED', 'Failed'].includes(order.paymentStatus)) return 'failed';
  if (order.paymentStatus === 'EXPIRED') return 'expired';
  if (historicalCod(order)) return 'cod';
  return ['CREATED', 'PAYMENT_PENDING', 'AUTHORIZED', 'Pending'].includes(order.paymentStatus) ? 'pending' : 'review';
}

export function orderDisplayStatus(order: Order) {
  if (!fulfilmentEligible(order)) return paymentPresentation(order).label;
  if (order.orderStatus === 'Order Placed') return historicalCod(order) ? 'Cash on Delivery' : 'Order Confirmed';
  return order.orderStatus;
}

export const trustedPaymentOutcome = (order: Order): PaymentOutcome =>
  ({ kind: paymentSucceeded(order) ? 'confirmed' : 'pending', order });

export function requestedOrder(orders: Order[], id: string | null, last: Order | null): Order | null {
  if (id) return orders.find(order => order.id === id) || (last?.id === id ? last : null);
  return last;
}

// Select an existing server snapshot; never synthesize or promote payment status.
// A dismissal or slow API response must not undo a newer captured/refunded snapshot.
export function preferPaymentOrder(current: Order | undefined, incoming: Order): Order {
  if (!current || current.id !== incoming.id) return incoming;
  if (confirmedPayment(current) && !confirmedPayment(incoming)) return current;
  if (confirmedPayment(current) && confirmedPayment(incoming)
    && ((current.refundedAmountPaise || 0) > (incoming.refundedAmountPaise || 0)
      || (current.paymentReviewRequired === true && incoming.paymentReviewRequired !== true))) return current;
  return incoming;
}

export function paymentPresentation(order: Order) {
  const state = (title: string, label: string, message: string, tone: 'neutral' | 'warning' | 'error' | 'success' = 'neutral') =>
    ({ title, label, message, tone, success: tone === 'success' });
  if (historicalCod(order))
    return state('Order request received', 'Historical order', 'Your historical Cash on Delivery order is recorded.');
  if (order.paymentProvider !== 'razorpay' || order.paymentMethod !== 'razorpay')
    return state('Payment status unavailable', 'Payment Under Review', 'Payment details are incomplete. Contact the store before paying again.', 'warning');
  if (order.paymentReviewRequired)
    return state('Store review required', 'Payment Under Review', confirmedPayment(order)
      ? 'Payment was captured, but inventory needs store review before fulfilment. Do not pay again.'
      : 'Payment and inventory need store review. Contact the store before paying again.', 'warning');
  if (paymentSucceeded(order))
    return state(`Thank You, ${order.shippingAddress.fullName}!`, 'Payment Successful', 'Your payment was captured and verified.', 'success');
  if (['PAID', 'REFUND_PENDING', 'PARTIALLY_REFUNDED', 'REFUNDED'].includes(order.paymentStatus) && !confirmedPayment(order))
    return state('Payment needs confirmation', 'Payment Under Review', 'Verified payment details are unavailable. Contact the store before paying again.', 'warning');
  switch (order.paymentStatus) {
    case 'AUTHORIZED': return state('Payment authorized', 'Verifying Payment', 'Your payment is authorized but capture has not been confirmed. Check payment before retrying.', 'warning');
    case 'Failed':
    case 'FAILED': return state('Payment failed', 'Payment Failed', 'The payment attempt failed. Check its latest status or retry the same order.', 'error');
    case 'EXPIRED': return state('Payment reservation expired', 'Payment Expired', 'Your inventory reservation expired. Retry will check availability and prices again.', 'warning');
    case 'REFUND_PENDING': return state('Refund pending', 'Refund Processing', 'A refund is awaiting processing. Contact the store for assistance.', 'warning');
    case 'PARTIALLY_REFUNDED': return state('Payment partially refunded', 'Partially Refunded', 'Part of your captured payment has been refunded.');
    case 'REFUNDED': return state('Payment refunded', 'Refunded', 'Your captured payment has been fully refunded.');
    case 'CREATED': return state('Complete your payment', 'Payment Incomplete', 'Your order request exists, but payment is not confirmed. Check its status before paying again.');
    case 'Pending':
    case 'PAYMENT_PENDING': return state('Verifying your payment', 'Verifying Payment', 'Payment has not been confirmed. Updates appear automatically when received. Check its latest status before retrying.');
    default: return state('Payment status unavailable', 'Payment Under Review', 'Contact the store to confirm this payment.', 'warning');
  }
}

export function checkoutFeedback(outcome: PaymentOutcome) {
  if (outcome.kind === 'error') return { title: 'Payment could not be confirmed', message: outcome.message, type: 'error' as const, navigate: false };
  if (outcome.kind === 'dismissed') return { title: 'Payment Cancelled', message: 'You closed checkout. Payment is not confirmed and may still arrive later. Your bag is preserved; check the order before paying again.', type: 'info' as const, navigate: false };
  const view = paymentPresentation(outcome.order);
  return { title: view.label, message: view.message, type: view.success ? 'success' as const : 'info' as const, navigate: true };
}
