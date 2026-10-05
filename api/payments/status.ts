import { authenticate, database, failure, jsonBody, prepare, rateLimit, type Request, type Response } from '../../server/payments/http.js';
import { identifier, object, only } from '../../server/payments/validation.js';
import { razorpayProvider } from '../../server/payments/provider.js';
import { PaymentService } from '../../server/payments/service.js';
export default async function handler(req: Request, res: Response) {
  try {
    prepare(req, res); const uid = await authenticate(req); const body = object(jsonBody(req)); only(body, ['orderId']); const id = identifier(body.orderId);
    const db = database(); await rateLimit(db, uid, 'verify'); const service = new PaymentService(db, razorpayProvider());
    await service.owned(uid, id); return res.status(200).json({ order: await service.reconcile(id) });
  } catch (e) { return failure(res, e); }
}
