import { timingSafeEqual } from 'node:crypto';
import { database, failure, prepare, type Request, type Response } from '../../server/payments/http.js';
import { requireCondition } from '../../server/payments/errors.js';
import { razorpayProvider } from '../../server/payments/provider.js';
import { PaymentService } from '../../server/payments/service.js';
export const config = { maxDuration: 300 };
// Schedule at least once per minute; CRON_SECRET is server-only.
export default async function handler(req: Request, res: Response) {
  try {
    prepare(req, res, 'GET'); const secret = process.env.CRON_SECRET; requireCondition(secret, 'RECONCILIATION_CONFIGURATION_MISSING', 503);
    const expected = Buffer.from(`Bearer ${secret}`); const actual = Buffer.from(req.headers.authorization || '');
    requireCondition(expected.length === actual.length && timingSafeEqual(expected, actual), 'AUTH_INVALID', 401);
    const db = database(); const service = new PaymentService(db, razorpayProvider());
    const expired = await db.collection('paymentAttempts').where('nextCheckAt', '<=', Date.now()).orderBy('nextCheckAt').limit(5).get();
    let processed = 0; let failed = 0;
    await Promise.all(expired.docs.map(async record => {
      let delay = 60_000;
      try { const order = await service.reconcile(record.id); processed++; if (['PAID', 'PARTIALLY_REFUNDED', 'REFUNDED'].includes(order.paymentStatus)) delay = 86_400_000; }
      catch { failed++; console.error('Payment reconciliation failed', { orderId: record.id, code: 'RECONCILIATION_RETRY_REQUIRED' }); }
      finally { await record.ref.update({ nextCheckAt: Date.now() + delay }); }
    }));
    return res.status(failed ? 503 : 200).json({ processed, failed });
  } catch (e) { return failure(res, e); }
}
