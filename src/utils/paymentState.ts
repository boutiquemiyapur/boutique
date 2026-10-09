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
  if (order.paymentMethod === 'cod' && (!order.paymentProvider || order.paymentProvider === 'cod')
    && !order.razorpayOrderId && !order.razorpayPaymentId && !order.paymentVerifiedAt)
    return state('Order request received', 'Historical order', 'Your historical Cash on Delivery order is recorded.');
  if (order.paymentProvider !== 'razorpay' || order.paymentMethod !== 'razorpay')
    return state('Payment status unavailable', 'Confirmation required', 'Payment details are incomplete. Contact the store before paying again.', 'warning');
  if (order.paymentReviewRequired)
    return state('Store review required', 'Fulfilment on hold', confirmedPayment(order)
      ? 'Payment was captured, but inventory needs store review before fulfilment. Do not pay again.'
      : 'Payment and inventory need store review. Contact the store before paying again.', 'warning');
  if (paymentSucceeded(order))
    return state(`Thank You, ${order.shippingAddress.fullName}!`, 'Payment confirmed', 'Your payment was captured and verified.', 'success');
  if (['PAID', 'REFUND_PENDING', 'PARTIALLY_REFUNDED', 'REFUNDED'].includes(order.paymentStatus) && !confirmedPayment(order))
    return state('Payment needs confirmation', 'Confirmation required', 'Verified payment details are unavailable. Contact the store before paying again.', 'warning');
  switch (order.paymentStatus) {
    case 'AUTHORIZED': return state('Payment authorized', 'Awaiting capture', 'Your payment is authorized but capture has not been confirmed. Check payment before retrying.', 'warning');
    case 'FAILED': return state('Payment failed', 'Payment not confirmed', 'The payment attempt failed. Check its latest status or retry the same order.', 'error');
    case 'EXPIRED': return state('Payment reservation expired', 'Payment not confirmed', 'Your inventory reservation expired. Retry will check availability and prices again.', 'warning');
    case 'REFUND_PENDING': return state('Refund pending', 'Refund update', 'A refund is awaiting processing. Contact the store for assistance.', 'warning');
    case 'PARTIALLY_REFUNDED': return state('Payment partially refunded', 'Refund update', 'Part of your captured payment has been refunded.');
    case 'REFUNDED': return state('Payment refunded', 'Refund update', 'Your captured payment has been fully refunded.');
    case 'CREATED':
    case 'PAYMENT_PENDING': return state('Complete your payment', 'Payment pending', 'Payment is awaiting trusted confirmation. Check its latest status or retry below.');
    default: return state('Payment status unavailable', 'Confirmation required', 'Contact the store to confirm this payment.', 'warning');
  }
}

export function checkoutFeedback(outcome: PaymentOutcome) {
  if (outcome.kind === 'error') return { title: 'Payment could not be confirmed', message: outcome.message, type: 'error' as const, navigate: false };
  if (outcome.kind === 'dismissed') return { title: 'Checkout closed', message: 'Payment has not been confirmed. Your bag is preserved. Check the order before paying again.', type: 'info' as const, navigate: false };
  const view = paymentPresentation(outcome.order);
  return { title: view.label, message: view.message, type: view.success ? 'success' as const : 'info' as const, navigate: true };
}
