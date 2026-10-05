import { database, failure, prepare, rawBody, type Request, type Response } from '../../server/payments/http.js';
import { digest, identifier, object, text } from '../../server/payments/validation.js';
import { requireCondition } from '../../server/payments/errors.js';
import { razorpayProvider, validSignature } from '../../server/payments/provider.js';
import { PaymentService } from '../../server/payments/service.js';
export const config = { api: { bodyParser: false } };
export default async function handler(req: Request, res: Response) {
  try {
    prepare(req, res); const secret = process.env.RAZORPAY_WEBHOOK_SECRET?.trim(); requireCondition(secret, 'PAYMENT_CONFIGURATION_MISSING', 503);
    const raw = await rawBody(req); requireCondition(validSignature(raw, req.headers['x-razorpay-signature'], secret), 'SIGNATURE_INVALID');
    const body = object(JSON.parse(raw.toString('utf8'))) as Record<string, any>;
    const eventName = text(body.event, 80); const hash = digest(raw);
    const event = { id: typeof req.headers['x-razorpay-event-id'] === 'string' ? text(req.headers['x-razorpay-event-id'], 120) : hash, hash };
    const db = database(); const prior = await db.collection('paymentEvents').doc(digest(event.id)).get();
    if (prior.exists) { requireCondition(prior.data()?.hash === hash, 'EVENT_CONFLICT', 409); return res.status(200).json({ received: true }); }
    const ignore = async () => {
      await db.runTransaction(async tx => {
        const ref = db.collection('paymentEvents').doc(digest(event.id)); const previous = await tx.get(ref);
        requireCondition(!previous.exists || previous.data()?.hash === hash, 'EVENT_CONFLICT', 409);
        if (!previous.exists) tx.set(ref, { hash, ignored: true, processedAt: new Date() });
      });
      return res.status(200).json({ received: true });
    };
    const supported = ['payment.authorized', 'payment.captured', 'payment.failed', 'order.paid', 'refund.created', 'refund.processed', 'refund.failed'];
    if (!supported.includes(eventName)) {
      return ignore();
    }
    const paymentId = identifier(body.payload?.payment?.entity?.id || body.payload?.refund?.entity?.payment_id);
    const provider = razorpayProvider(); const payment = await provider.payment(paymentId);
    if (!payment.order_id) return ignore();
    const providerOrder = await provider.order(payment.order_id);
    if (!providerOrder.notes?.checkoutId) return ignore();
    const id = identifier(providerOrder.notes.checkoutId);
    const service = new PaymentService(db, provider); await service.attach(id, providerOrder);
    await service.syncPayment(id, paymentId, event);
    return res.status(200).json({ received: true });
  } catch (e) { return failure(res, e); }
}
