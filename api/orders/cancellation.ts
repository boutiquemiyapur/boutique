import { CancellationService } from '../../server/orders/cancellation.js';
import { LIVE_REFUND_EXECUTION_ENABLED } from '../../server/orders/refundPolicy.js';
import { razorpayProvider } from '../../server/payments/provider.js';
import { authenticate, database, failure, jsonBody, prepare, rateLimit, type Request, type Response } from '../../server/payments/http.js';
import { identifier, object, only, text } from '../../server/payments/validation.js';
import { requireCondition } from '../../server/payments/errors.js';

export default async function handler(req: Request, res: Response) {
  try {
    prepare(req, res); const body = object(jsonBody(req)); only(body, ['orderId', 'action', 'reason']);
    const action = text(body.action, 20); requireCondition(['request', 'quote', 'approve', 'reject', 'retryRefund'].includes(action), 'INVALID_CANCELLATION_ACTION');
    const uid = await authenticate(req, action !== 'request');
    const id = identifier(body.orderId); const db = database(); await rateLimit(db, uid, 'cancellation');
    const service = new CancellationService(db, razorpayProvider(), LIVE_REFUND_EXECUTION_ENABLED);
    const reason = text(body.reason, 300, true);
    if (action === 'quote') { const order = (await service.record(id)).data; requireCondition(order.cancellationRequest?.status === 'REQUESTED' && service.eligible(order), 'CANCELLATION_INELIGIBLE', 409); return res.status(200).json({ quote: await service.quote(id), executionEnabled: LIVE_REFUND_EXECUTION_ENABLED }); }
    const order = action === 'request' ? await service.request(uid, id, reason)
      : action === 'retryRefund' ? await service.retryApprovedRefund(uid, id)
      : await service.review(uid, id, action === 'approve', reason);
    return res.status(200).json({ order, executionEnabled: LIVE_REFUND_EXECUTION_ENABLED });
  } catch (e) { return failure(res, e); }
}
