import type { Order } from '../types';
import { confirmedPayment, orderDisplayStatus, paymentGroup, paymentPresentation } from './paymentState';

export function filterOrders(orders: Order[], query: string, filter: string) {
  const search = query.trim().toLowerCase();
  return orders.filter(order => (!search || [order.id, order.orderNumber, order.shippingAddress.fullName, order.shippingAddress.email, orderDisplayStatus(order), paymentPresentation(order).label].join(' ').toLowerCase().includes(search))
    && (filter === 'all' || (filter === 'unpaid' ? !confirmedPayment(order) && order.paymentMethod !== 'cod' : paymentGroup(order) === filter)));
}

// Export only the currently visible snapshot, with friendly labels and no new reads.
// Escape formula prefixes in user-supplied cells as well as CSV quotes/newlines.
export function ordersCsv(orders: Order[]) {
  const cell = (value: string | number) => {
    const text = String(value); return `"${(/^[\s]*[=+\-@]/.test(text) ? `'${text}` : text).replace(/"/g, '""')}"`;
  };
  return [['Order', 'Customer', 'Payment', 'Fulfilment', 'Order total INR', 'Refunded INR'], ...orders.map(order => [order.orderNumber, order.shippingAddress.fullName, paymentPresentation(order).label, orderDisplayStatus(order), order.totalINR, (order.refundedAmountPaise || 0) / 100])].map(row => row.map(cell).join(',')).join('\r\n');
}
