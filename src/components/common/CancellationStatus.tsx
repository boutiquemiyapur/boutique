import React from 'react';
import type { Order } from '../../types';
export const CancellationStatus = ({ order }: { order: Order }) => {
  const request = order.cancellationRequest;
  if (!request) return null;
  const labels = { REQUESTED: 'Cancellation requested — awaiting admin review', APPROVED: 'Cancellation approved', REJECTED: 'Cancellation rejected' };
  const refunds = { AWAITING_ENABLEMENT: 'Refund awaiting individual store review and confirmation.', APPROVED: 'Refund approved — awaiting initiation', INITIATING: 'Refund initiation is being checked', UNKNOWN: 'Refund status unknown — store reconciliation required', PENDING: 'Refund processing. Acceptance does not mean the money has reached your account.', PROCESSED: 'Refund processed by Razorpay. Bank credit timing may vary.', FAILED: 'Refund failed — contact the store for assistance', MANUAL_REVIEW: 'Refund requires store review', NOT_REQUIRED: 'No captured amount was due for refund at approval. Contact the store if payment arrives later.' };
  return <div className="my-3 rounded-lg border border-stone-200 bg-stone-50 p-3 text-xs leading-5" role="status">
    <p className="font-semibold">{labels[request.status]}</p><p>Reason: {request.reason}</p>
    {order.refund && <span className={`my-2 inline-block rounded-full px-2 py-1 font-semibold ${order.refund.state === 'PROCESSED' ? 'bg-green-100 text-green-800' : order.refund.state === 'FAILED' ? 'bg-red-100 text-red-800' : 'bg-stone-200 text-stone-800'}`}>{order.refund.state.replace(/_/g, ' ')}</span>}
    {request.decisionReason && <p>Store response: {request.decisionReason}</p>}
    {order.refund && <><p>{refunds[order.refund.state]}</p>{order.refund.amountPaise > 0 && <p>Refund amount: INR {(order.refund.amountPaise / 100).toFixed(2)}</p>}{order.refund.id && <p>Razorpay refund: {order.refund.id}</p>}</>}
    {request.inventory === 'MANUAL_REVIEW' && <p>Inventory correction requires store review.</p>}
  </div>;
};
