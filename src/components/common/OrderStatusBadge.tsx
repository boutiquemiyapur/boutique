import type { Order } from '../../types';
import { orderDisplayStatus, paymentPresentation, fulfilmentEligible } from '../../utils/paymentState';

export function OrderStatusBadge({ order }: { order: Order }) {
  const payment = paymentPresentation(order);
  const tone = !fulfilmentEligible(order) ? payment.tone : order.orderStatus === 'Cancelled' ? 'error' : order.orderStatus === 'Delivered' ? 'success' : 'neutral';
  return <span className={`inline-flex rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-wide ${tone === 'error' ? 'bg-rose-100 text-rose-800' : tone === 'success' ? 'bg-emerald-100 text-emerald-800' : tone === 'warning' ? 'bg-amber-100 text-amber-800' : 'bg-stone-100 text-stone-700'}`}>{orderDisplayStatus(order)}</span>;
}
