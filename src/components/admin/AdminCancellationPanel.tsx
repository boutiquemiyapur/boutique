import React, { useRef, useState } from 'react';
import type { Order } from '../../types';
import { cancellationApi } from '../../services/cancellationClient';
import { CancellationStatus } from '../common/CancellationStatus';
export const AdminCancellationPanel = ({ order }: { order: Order }) => {
  const [busy, setBusy] = useState(false); const inFlight = useRef(false);
  const [error, setError] = useState(''); const [reason, setReason] = useState('');
  const [quote, setQuote] = useState<{ captured: boolean; amountPaise: number; paymentId?: string } | null>(null);
  const [execution, setExecution] = useState(false);
  if (!order.cancellationRequest) return null;
  const run = async (action: 'quote' | 'approve' | 'reject' | 'retryRefund') => {
    if (inFlight.current) return; inFlight.current = true; setBusy(true); setError(''); if (action === 'quote') setQuote(null);
    try { const result = await cancellationApi(action, order.id, reason); setExecution(result.executionEnabled); setQuote(result.quote || null); }
    catch (e) { setError(e instanceof Error ? e.message : 'Check the latest order before retrying.'); }
    finally { inFlight.current = false; setBusy(false); }
  };
  return <section className="my-4 border-t border-stone-200 pt-3"><CancellationStatus order={order} />
    <p className="text-xs">Only an authorized admin can approve cancellation. Refunds use the full verified remaining amount.</p>
    {order.cancellationRequest.status === 'REQUESTED' && <>
      <button disabled={busy} onClick={() => void run('quote')} className="my-2 underline">Check payment and eligible refund</button>
      {quote && <p>Verified captured payment: {quote.captured ? quote.paymentId : 'None'}. Eligible refund: INR {(quote.amountPaise / 100).toFixed(2)}. {execution ? 'Approval initiates the refund.' : 'LIVE refund execution is disabled; approval records cancellation and holds the refund for store action.'}</p>}
      <label className="block">Decision note<input value={reason} maxLength={300} onChange={e => setReason(e.target.value)} className="mt-1 w-full border p-2" /></label>
      <div className="mt-2 flex gap-3"><button disabled={busy || !quote} onClick={() => void run('approve')} className="rounded bg-[#625e59] p-2 text-white disabled:opacity-50">Approve cancellation</button><button disabled={busy || !reason.trim()} onClick={() => void run('reject')} className="border p-2 disabled:opacity-50">Reject request</button></div>
    </>}
    {order.cancellationRequest.status === 'APPROVED' && <button disabled={busy} onClick={() => void run('retryRefund')} className="mt-2 underline disabled:opacity-50">Check / recover approved refund</button>}
    <p className="mt-2 text-stone-500">Audit: {order.cancellationRequest.audit.map(e => `${e.action} · ${e.at} · ${e.by}`).join('; ')}</p>
    {error && <p role="alert" className="mt-2 text-red-700">{error}</p>}
  </section>;
};
