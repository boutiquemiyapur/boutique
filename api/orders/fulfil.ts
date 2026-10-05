import { fulfilOrder } from '../../server/orders/fulfil.js';
import { authenticate, database, failure, jsonBody, prepare, rateLimit, type Request, type Response } from '../../server/payments/http.js';
import { identifier, object, only, text } from '../../server/payments/validation.js';
import { requireCondition } from '../../server/payments/errors.js';
import type { OrderStatus } from '../../src/types/index.js';
const statuses = ['Order Placed', 'Confirmed', 'Processing', 'Artisan Tailoring', 'Ready for Dispatch', 'Quality Inspection', 'Dispatched', 'In Transit', 'Out for Delivery', 'Delivered', 'Cancelled'];
export default async function handler(req: Request, res: Response) {
  try {
    prepare(req, res); const uid = await authenticate(req, true); const body = object(jsonBody(req)); only(body, ['orderId', 'status', 'trackingNumber']);
    const id = identifier(body.orderId); const status = text(body.status, 40) as OrderStatus; requireCondition(statuses.includes(status), 'INVALID_FULFILMENT_STATUS');
    const trackingNumber = text(body.trackingNumber, 100, true); const db = database(); await rateLimit(db, uid, 'fulfil');
    const order = await fulfilOrder(db, uid, id, status, trackingNumber);
    return res.status(200).json({ order });
  } catch (e) { return failure(res, e); }
}
