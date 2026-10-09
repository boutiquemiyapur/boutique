import React, { useEffect, useRef, useState } from 'react';
import type { Order } from '../../types';
import { paymentApi, retryOrder } from '../../services/paymentClient';
import { checkoutFeedback, confirmedPayment, paymentPresentation, preferPaymentOrder } from '../../utils/paymentState';

export function PaymentRecovery({ order }: { order: Order }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ source: Order; text: string } | null>(null);
  const [checkedOrder, setCheckedOrder] = useState<{ source: Order; order: Order } | null>(null);
  const inFlight = useRef(false);
  const activeId = useRef(order.id);
  activeId.current = order.id;
  useEffect(() => { setCheckedOrder(null); setMessage(null); }, [order]);
  const latest = checkedOrder?.source === order ? preferPaymentOrder(order, checkedOrder.order) : order;
  const payment = paymentPresentation(latest);
  if (order.paymentMethod !== 'razorpay' && order.paymentProvider !== 'razorpay') return null;
  const retryAllowed = latest.paymentProvider === 'razorpay' && latest.paymentMethod === 'razorpay'
    && !latest.paymentReviewRequired && ['CREATED', 'PAYMENT_PENDING', 'FAILED', 'EXPIRED'].includes(latest.paymentStatus);
  async function run(retry: boolean) {
    if (inFlight.current) return;
    const id = order.id;
    const feedback = (text: string) => setMessage({ source: order, text });
    inFlight.current = true; setBusy(true); feedback('Checking trusted payment status...');
    try {
      if (retry) {
        const outcome = await retryOrder(latest);
        if (activeId.current !== id) return;
        if (outcome.kind === 'confirmed' || outcome.kind === 'pending') setCheckedOrder({ source: order, order: outcome.order });
        feedback(checkoutFeedback(outcome).message);
      } else {
        const { order: result } = await paymentApi<{ order: Order }>('status', { orderId: id });
        if (activeId.current !== id) return;
        if (result?.id !== id) throw new Error('Payment response did not match this order. Contact the store.');
        setCheckedOrder({ source: order, order: result }); feedback(paymentPresentation(result).message);
      }
    } catch (e) { if (activeId.current === id) feedback(e instanceof Error ? e.message : 'Please check again shortly.'); }
    finally { inFlight.current = false; setBusy(false); }
  }
  return <div className="mt-4 space-y-3 rounded-xl border border-stone-200 p-4 text-xs">
    <p>{payment.label}: {latest.paymentStatus}</p>
    <p>{payment.message}</p>
    <div className="flex gap-3">
      <button disabled={busy} onClick={() => void run(false)} className="rounded border px-4 py-2 disabled:opacity-50">Check payment</button>
      {retryAllowed && !confirmedPayment(latest) && <button disabled={busy} onClick={() => void run(true)} className="rounded bg-[#8B1E3F] px-4 py-2 text-white disabled:opacity-50">Retry payment</button>}
    </div>
    {message?.source === order && <p role="status">{message.text}</p>}
  </div>;
}
