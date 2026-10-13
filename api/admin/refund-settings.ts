import { authenticate, database, failure, jsonBody, prepare, rateLimit, type Request, type Response } from '../../server/payments/http.js';
import { object, only } from '../../server/payments/validation.js';
import { requireCondition } from '../../server/payments/errors.js';
import { RefundSettingsService } from '../../server/orders/refundSettings.js';

export default async function handler(req: Request, res: Response) {
  try {
    prepare(req, res); const uid = await authenticate(req, true); const body = object(jsonBody(req));
    only(body, ['action', 'enabled', 'revision', 'confirmed']);
    requireCondition(['status', 'set'].includes(String(body.action)), 'INVALID_REFUND_SETTINGS_ACTION');
    const db = database(); await rateLimit(db, uid, 'refund-settings'); const service = new RefundSettingsService(db);
    if (body.action === 'status') { only(body, ['action']); return res.status(200).json({ settings: await service.read(), history: await service.history() }); }
    requireCondition(typeof body.enabled === 'boolean' && Number.isSafeInteger(body.revision) && Number(body.revision) >= 0 && typeof body.confirmed === 'boolean', 'INVALID_REFUND_SETTINGS_REQUEST');
    return res.status(200).json({ settings: await service.set(uid, body.enabled, Number(body.revision), body.confirmed), history: await service.history() });
  } catch (e) { return failure(res, e); }
}
