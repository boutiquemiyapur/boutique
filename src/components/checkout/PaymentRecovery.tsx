import React, { useEffect, useRef, useState } from 'react';
import type { Order } from '../../types';
import { paymentApi, retryOrder, paymentStageText, type PaymentStage } from '../../services/paymentClient';
import { ButtonProgress } from '../common/Loading';
import { checkoutFeedback, confirmedPayment, paymentPresentation, preferPaymentOrder } from '../../utils/paymentState';

export function PaymentRecovery({ order }: { order: Order }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ source: Order; text: string } | null>(null);
  const [checkedOrder, setCheckedOrder] = useState<{ source: Order; order: Order } | null>(null);
  const inFlight = useRef(false);
  const [stage, setStage] = useState<PaymentStage>('idle');
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
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
    inFlight.current = true; setBusy(true); setStage(retry ? 'preparing' : 'checking');
    feedback(retry ? 'Preparing secure checkout…' : 'Checking latest payment status…');
    try {
      if (retry) {
        const outcome = await retryOrder(latest, next => { if (mounted.current && activeId.current === id) setStage(next); });
        if (!mounted.current || activeId.current !== id) return;
        if (outcome.kind === 'confirmed' || outcome.kind === 'pending') setCheckedOrder({ source: order, order: outcome.order });
        feedback(checkoutFeedback(outcome).message);
      } else {
        const { order: result } = await paymentApi<{ order: Order }>('status', { orderId: id });
        if (!mounted.current || activeId.current !== id) return;
        if (result?.id !== id) throw new Error('Payment response did not match this order. Contact the store.');
        setCheckedOrder({ source: order, order: result }); feedback(paymentPresentation(result).message);
      }
    } catch (e) { if (mounted.current && activeId.current === id) feedback(e instanceof Error ? e.message : 'Please check again shortly.'); }
    finally { inFlight.current = false; if (mounted.current) { setBusy(false); setStage('idle'); } }
  }
  return <div className="mt-4 space-y-3 rounded-xl border border-stone-200 p-4 text-xs">
    <p className="font-semibold">{payment.label}</p>
    <p>{payment.message}</p>
    <div className="flex gap-3">
      <button aria-busy={busy} disabled={busy} onClick={() => void run(false)} className="rounded border px-4 py-2 disabled:opacity-50">Check payment</button>
      {retryAllowed && !confirmedPayment(latest) && <button disabled={busy} onClick={() => void run(true)} className="rounded bg-[#8B1E3F] px-4 py-2 text-white disabled:opacity-50">Retry payment</button>}
    </div>
    {busy && <p role="status">{stage === 'checkout' ? paymentStageText.checkout : <ButtonProgress>{paymentStageText[stage] || 'Checking latest payment status…'}</ButtonProgress>}</p>}
    {message?.source === order && <p role="status">{message.text}</p>}
  </div>;
}
