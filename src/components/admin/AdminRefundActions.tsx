import React, { useEffect, useRef, useState } from 'react';
import type { Order } from '../../types';
import type { ApprovedRefundReview, RefundSettingsStatus } from '../../types/refundManagement';
import { confirmApprovedRefund, loadRefundSettings, reviewApprovedRefund } from '../../services/refundManagementClient';
import { RefundConfirmationDialog } from './RefundConfirmationDialog';

export function AdminRefundActions({ order }: { order: Order }) {
  const [settings, setSettings] = useState<RefundSettingsStatus | null>(null);
  const [review, setReview] = useState<ApprovedRefundReview | null>(null);
  const [confirm, setConfirm] = useState(false); const [busy, setBusy] = useState(false); const running = useRef(false);
  const [error, setError] = useState(''); const [notice, setNotice] = useState('');
  useEffect(() => { let active = true; void loadRefundSettings().then(data => { if (active) setSettings(data.settings); }).catch(e => { if (active) setError(e instanceof Error ? e.message : 'Unable to load refund permission.'); }); return () => { active = false; }; }, [order.id]);
  const inspect = async (openConfirmation: boolean) => {
    if (running.current) return; running.current = true; setBusy(true); setError(''); setNotice('');
    try {
      const result = await reviewApprovedRefund(order.id); setReview(result.review); setSettings(result.review.settings);
      setConfirm(openConfirmation && result.review.canExecute);
      if (!result.review.canExecute) setNotice(result.review.reason === 'LIVE_REFUNDS_DISABLED' ? 'Refund execution is locked pending security approval.' : result.review.reason === 'ADMIN_REFUNDS_DISABLED' ? 'Refund execution is OFF in Payment & Refund Settings.' : 'No new refund can be initiated from this review. Check the trusted status and original approval.');
    } catch (e) { setError(e instanceof Error ? e.message : 'Unable to review payment evidence.'); }
    finally { running.current = false; setBusy(false); }
  };
  const execute = async () => {
    if (running.current || !review?.reviewId) return; running.current = true; setBusy(true); setError('');
    try {
      const result = await confirmApprovedRefund(order.id, review.reviewId);
      const state = result.order.refund?.state;
      const messages: Record<string, string> = { PENDING: 'Refund is processing. Acceptance does not mean bank credit is complete.', PROCESSED: 'Razorpay reports this refund processed. Bank credit timing may vary.', FAILED: 'Razorpay reports the refund failed. Store review is required.', MANUAL_REVIEW: 'Refund requires manual review. No new refund should be started.', UNKNOWN: 'Refund outcome is unknown. Status tracking will not resend it. Review and explicitly confirm any retry; do not start a different refund.', INITIATING: 'Refund initiation is being checked.' };
      setNotice(messages[state || ''] || 'Refund initiation was not confirmed. Review the latest order status.'); setConfirm(false); setReview(null);
    } catch (e) { setError(e instanceof Error ? e.message : 'Refund could not be confirmed. Check status before retrying.'); setConfirm(false); setReview(null); }
    finally { running.current = false; setBusy(false); }
  };
  const terminal = ['PROCESSED', 'FAILED', 'MANUAL_REVIEW', 'NOT_REQUIRED'].includes(order.refund?.state || '');
  return <div className="mt-4 space-y-3 rounded-lg border border-stone-200 bg-white p-3 text-xs">
    {!settings && !error && <p role="status">Loading refund permission…</p>}
    {settings && !settings.codeEnabled && <p>Refund execution is locked pending security approval.</p>}
    <p>Cancellation approval and refund execution are separate. Older approvals are reviewed individually; approval timestamps and idempotency keys are never renewed here.</p>
    <div className="flex flex-wrap gap-3"><button type="button" disabled={busy} onClick={() => void inspect(false)} className="underline disabled:opacity-50">Review / synchronize approved refund</button>
      {!terminal && !order.refund?.id && <button type="button" disabled={busy || !settings?.effectiveEnabled} onClick={() => void inspect(true)} className="rounded bg-[#625e59] px-3 py-2 text-white disabled:opacity-40">Refund Now — ₹{((order.refund?.amountPaise || 0) / 100).toFixed(2)}</button>}
    </div>
    {review && <div className="space-y-1 break-words border-t pt-2"><p>Trusted refund status: {review.state}</p><p>Amount: ₹{(review.amountPaise / 100).toFixed(2)} · Currency: {review.currency}</p><p>Payment: {review.paymentId || 'Unavailable'}</p>{review.refundId && <p>Refund: {review.refundId}</p>}<p>Original approval: {review.approvedAt ? new Date(review.approvedAt).toLocaleString() : 'Unavailable'}</p></div>}
    {notice && <p role="status">{notice}</p>}{error && <p role="alert" className="text-red-700">{error}</p>}
    {confirm && review && <RefundConfirmationDialog title={`Refund ₹${(review.amountPaise / 100).toFixed(2)}?`} busy={busy} confirmLabel="Confirm refund now" onCancel={() => setConfirm(false)} onConfirm={() => void execute()}>
      <p>Order: {review.orderId}</p><p>Captured payment: {review.paymentId}</p><p>Verified refund amount: ₹{(review.amountPaise / 100).toFixed(2)} INR</p><p>This initiates a financial refund through Razorpay. Payment history, gates and duplicate protection will be checked again. Do not confirm unless you intend to refund this specific order.</p>
    </RefundConfirmationDialog>}
  </div>;
}
