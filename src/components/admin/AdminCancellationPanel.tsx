import React, { useRef, useState } from 'react';
import type { Order } from '../../types';
import { cancellationApi } from '../../services/cancellationClient';
import { CancellationStatus } from '../common/CancellationStatus';
import { AdminRefundActions } from './AdminRefundActions';
export const AdminCancellationPanel = ({ order }: { order: Order }) => {
  const [busy, setBusy] = useState(false); const inFlight = useRef(false);
  const [error, setError] = useState(''); const [reason, setReason] = useState('');
  const [quote, setQuote] = useState<{ captured: boolean; amountPaise: number; paymentId?: string } | null>(null);
  if (!order.cancellationRequest) return null;
  const run = async (action: 'quote' | 'approve' | 'reject') => {
    if (inFlight.current) return; inFlight.current = true; setBusy(true); setError(''); if (action === 'quote') setQuote(null);
    try { const result = await cancellationApi(action, order.id, reason); setQuote(result.quote || null); }
    catch (e) { setError(e instanceof Error ? e.message : 'Check the latest order before retrying.'); }
    finally { inFlight.current = false; setBusy(false); }
  };
  return <section className="my-4 border-t border-stone-200 pt-3"><CancellationStatus order={order} />
    <p className="text-xs">Only an authorized admin can approve cancellation. Refunds use the full verified remaining amount.</p>
    {order.cancellationRequest.status === 'REQUESTED' && <>
      <button disabled={busy} onClick={() => void run('quote')} className="my-2 underline">Check payment and eligible refund</button>
      {quote && <p>Verified captured payment: {quote.captured ? quote.paymentId : 'None'}. Eligible refund: INR {(quote.amountPaise / 100).toFixed(2)}. Approval records cancellation and restores eligible ledger-backed stock. Refund execution requires a separate individual review and confirmation.</p>}
      <label className="block">Decision note<input value={reason} maxLength={300} onChange={e => setReason(e.target.value)} className="mt-1 w-full border p-2" /></label>
      <div className="mt-2 flex gap-3"><button disabled={busy || !quote} onClick={() => void run('approve')} className="rounded bg-[#625e59] p-2 text-white disabled:opacity-50">Approve cancellation</button><button disabled={busy || !reason.trim()} onClick={() => void run('reject')} className="border p-2 disabled:opacity-50">Reject request</button></div>
    </>}
    {order.cancellationRequest.status === 'APPROVED' && <div key={order.id}><AdminRefundActions order={order} /></div>}
    <p className="mt-2 text-stone-500">Audit: {order.cancellationRequest.audit.map(e => `${e.action} · ${e.at} · ${e.by}`).join('; ')}</p>
    {error && <p role="alert" className="mt-2 text-red-700">{error}</p>}
  </section>;
};
