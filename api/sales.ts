import { activeCampaigns, campaignPrices } from '../server/sales/campaigns.js';
import { database, failure, jsonBody, prepare, type Request, type Response } from '../server/payments/http.js';
import { identifier, object, only } from '../server/payments/validation.js';
import { requireCondition } from '../server/payments/errors.js';
import { productFromDocument } from '../src/utils/productData.js';
import type { SaleCampaign } from '../src/utils/saleCampaigns.js';
import adminHandler from '../server/sales/adminHandler.js';

// Explicit public projection: no admin identities, audit fields or drafts.
export const publicCampaign = (c: SaleCampaign) => {
  const { id, name, slug, description, desktopImage, mobileImage, ctaText, startsAt, endsAt, mode, percentage, categoryNames, displayOrder, homepage, featured } = c;
  return { id, name, slug, description, desktopImage, mobileImage, ctaText, startsAt, endsAt, mode, percentage, categoryNames, displayOrder, homepage, featured, status: 'published', revision: c.revision, assignedCount: 0 };
};
export default async function handler(req: Request & { query?: Record<string, string | string[]> }, res: Response) {
  // Both campaign URLs share one function to stay within Vercel Hobby's cap.
  // The rewrite marker only selects a handler; it never grants admin access.
  const url = new URL(req.url || '/api/sales', 'https://local.invalid');
  if (url.pathname === '/api/admin/sale-campaigns' || url.searchParams.get('__campaignAdmin') === '1' || req.query?.__campaignAdmin === '1') return adminHandler(req, res);
  try {
    const db = database(); const now = Date.now();
    if (req.method === 'GET') {
      prepare(req, res, 'GET');
      const url = new URL(req.url || '/', 'https://local.invalid'); const slug = url.searchParams.get('slug');
      const campaigns = await activeCampaigns(db, now);
      if (slug) {
        requireCondition(/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) && slug.length <= 80, 'INVALID_CAMPAIGN_SLUG');
        const campaign = campaigns.find(c => c.slug === slug);
        // Generic unavailable response keeps unpublished metadata private.
        return res.status(200).json({ campaign: campaign ? publicCampaign(campaign) : null, now });
      }
      return res.status(200).json({ campaigns: campaigns.map(publicCampaign), now });
    }
    prepare(req, res); const body = object(jsonBody(req)); only(body, ['productIds']);
    requireCondition(Array.isArray(body.productIds) && body.productIds.length > 0 && body.productIds.length <= 100, 'INVALID_PRODUCT_IDS');
    const ids = [...new Set(body.productIds.map(identifier))];
    const result = await db.runTransaction(async tx => {
      const snapshots = await tx.getAll(...ids.map(id => db.collection('products').doc(id)));
      const products = snapshots.filter(s => s.exists).map(s => productFromDocument(s.id, s.data()!)).filter(p => p && p.isActive !== false);
      const prices = await campaignPrices(db, products, now, tx);
      return Object.fromEntries(products.map((p, i) => [p.id, prices[i]]));
    });
    return res.status(200).json({ prices: result, now });
  } catch (error) { return failure(res, error); }
}
