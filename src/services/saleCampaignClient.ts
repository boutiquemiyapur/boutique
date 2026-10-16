import { firebaseAuth } from '../firebase/config';
const errors: Record<string, string> = {
  CAMPAIGN_CHANGED: 'This campaign changed elsewhere. Reload it before saving.', CAMPAIGN_SLUG_TAKEN: 'That URL slug is already in use.',
  PAUSE_CAMPAIGN_BEFORE_EDITING: 'Pause the campaign before changing its settings or products.', SALE_PRICE_EXCEEDS_REGULAR: 'Every fixed sale price must be positive and no greater than its regular selling price.',
  CAMPAIGN_NEEDS_PRODUCTS: 'Select products or categories before publishing.', TOO_MANY_PUBLISHED_CAMPAIGNS: 'Archive or pause an older campaign first (20 published campaigns maximum).',
  INVALID_CAMPAIGN: 'Check campaign fields, image URLs and dates.', INVALID_CAMPAIGN_PRODUCT: 'One of the selected products is unavailable. Remove it before publishing.',
  PRODUCT_CAMPAIGN_LIMIT: 'This product already has 100 campaign assignments. Remove obsolete assignments first.',
  INVALID_SALE_PRICE: 'Enter positive sale prices with up to two decimal places.', INVALID_FINANCIAL_RECORD: 'Use valid positive prices with up to two decimal places.',
};
export async function campaignAdmin<T = any>(body: object): Promise<T> {
  const user = firebaseAuth?.currentUser; if (!user) throw Error('Sign in as an administrator.');
  const token = await user.getIdToken();
  const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), 20000);
  try {
    const response = await fetch('/api/admin/sale-campaigns', { method: 'POST', signal: controller.signal, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(body) });
    const result = await response.json().catch(() => null);
    if (!response.ok || !result) throw Error(errors[result?.code] || 'Campaign request failed. Check your connection and administrator access.');
    return result;
  } catch (error) {
    if (controller.signal.aborted) throw Error('Campaign request timed out. Reload the campaign before retrying; some changes may have been saved.');
    throw error;
  } finally { clearTimeout(timer); }
}
