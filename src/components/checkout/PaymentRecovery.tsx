import React, { useState } from 'react';
import type { Order } from '../../types';
import { confirmedPayment, paymentApi, retryOrder } from '../../services/paymentClient';
export function PaymentRecovery({ order }: { order: Order }) {
  const [busy, setBusy] = useState(false); const [message, setMessage] = useState('');
  if (order.paymentProvider !== 'razorpay') return null;
  async function run(retry: boolean) {
    setBusy(true); setMessage('Confirming your payment...');
    try {
      const result = retry ? await retryOrder(order) : (await paymentApi<{ order: Order }>('status', { orderId: order.id })).order;
      setMessage(result.paymentReviewRequired ? 'Payment received. Store review is required before fulfilment.' : confirmedPayment(result) ? `Payment state: ${result.paymentStatus}` : 'Payment has not been confirmed yet. You can check again or retry.');
    } catch (e) { setMessage(e instanceof Error ? e.message : 'Please check again shortly.'); }
    finally { setBusy(false); }
  }
  return <div className="mt-4 space-y-3 rounded-xl border border-stone-200 p-4 text-xs"><p>{order.paymentReviewRequired ? 'Payment received; store review required.' : `Payment: ${order.paymentStatus}`}</p><div className="flex gap-3"><button disabled={busy} onClick={() => void run(false)} className="rounded border px-4 py-2 disabled:opacity-50">Check payment</button>{!confirmedPayment(order) && <button disabled={busy} onClick={() => void run(true)} className="rounded bg-[#8B1E3F] px-4 py-2 text-white disabled:opacity-50">Retry payment</button>}</div>{message && <p role="status">{message}</p>}</div>;
}
