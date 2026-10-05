import { authenticate, database, failure, jsonBody, prepare, rateLimit, type Request, type Response } from '../../server/payments/http.js';
import { identifier, object, only, text } from '../../server/payments/validation.js';
import { razorpayProvider } from '../../server/payments/provider.js';
import { PaymentService } from '../../server/payments/service.js';
export default async function handler(req: Request, res: Response) {
  try {
    prepare(req, res); const uid = await authenticate(req); const body = object(jsonBody(req));
    only(body, ['orderId', 'razorpay_order_id', 'razorpay_payment_id', 'razorpay_signature']);
    const id = identifier(body.orderId); const paymentId = identifier(body.razorpay_payment_id); const signature = text(body.razorpay_signature, 64);
    const provider = razorpayProvider(); const db = database(); await rateLimit(db, uid, 'verify');
    const service = new PaymentService(db, provider);
    return res.status(200).json({ order: await service.verify(uid, id, body.razorpay_order_id, paymentId, signature, process.env.RAZORPAY_KEY_SECRET!.trim()) });
  } catch (e) { return failure(res, e); }
}
