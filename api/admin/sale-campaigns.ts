import { CampaignService } from '../../server/sales/campaigns.js';
import { authenticate, database, failure, jsonBody, prepare, rateLimit, type Request, type Response } from '../../server/payments/http.js';
import { identifier, object, only } from '../../server/payments/validation.js';
import { requireCondition } from '../../server/payments/errors.js';
import type { CampaignStatus } from '../../src/utils/saleCampaigns.js';
export default async function handler(req: Request, res: Response) {
  try {
    prepare(req, res); const uid = await authenticate(req, true);
    const body = object(jsonBody(req)); only(body, ['action', 'id', 'revision', 'campaign', 'changes', 'status', 'cursor']);
    const db = database(); const service = new CampaignService(db);
    await rateLimit(db, uid, 'sale-campaigns');
    if (body.action === 'list') { only(body, ['action', 'cursor']); return res.status(200).json(await service.list(body.cursor ? identifier(body.cursor) : '')); }
    const id = identifier(body.id);
    if (body.action === 'assignments') { only(body, ['action', 'id', 'cursor']); return res.status(200).json(await service.assignments(id, body.cursor ? identifier(body.cursor) : '')); }
    requireCondition(Number.isSafeInteger(body.revision) && Number(body.revision) >= 0, 'INVALID_CAMPAIGN_REVISION');
    let campaign;
    if (body.action === 'save') { only(body, ['action', 'id', 'revision', 'campaign']); campaign = await service.save(uid, id, Number(body.revision), body.campaign); }
    else if (body.action === 'assign') { only(body, ['action', 'id', 'revision', 'changes']); campaign = await service.assign(uid, id, Number(body.revision), body.changes); }
    else { requireCondition(body.action === 'transition', 'INVALID_CAMPAIGN_ACTION'); only(body, ['action', 'id', 'revision', 'status']); campaign = await service.transition(uid, id, Number(body.revision), body.status as CampaignStatus); }
    return res.status(200).json({ campaign });
  } catch (error) { return failure(res, error); }
}
