import { authenticate, database, failure, jsonBody, prepare, rateLimit, type Request, type Response } from '../../server/payments/http.js';
import { parseCheckout } from '../../server/payments/validation.js';
import { razorpayProvider } from '../../server/payments/provider.js';
import { PaymentService } from '../../server/payments/service.js';
export default async function handler(req: Request, res: Response) {
  try {
    prepare(req, res); const uid = await authenticate(req); const request = parseCheckout(jsonBody(req));
    const provider = razorpayProvider(); const db = database(); await rateLimit(db, uid, 'create');
    return res.status(200).json(await new PaymentService(db, provider).create(uid, request));
  } catch (e) { return failure(res, e); }
}
