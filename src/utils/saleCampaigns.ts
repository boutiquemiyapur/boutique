import type { Product } from '../types/index.js';
import { moneyPaise, productPricing } from './productPricing.js';

export type CampaignStatus = 'draft' | 'published' | 'paused' | 'ended' | 'archived';
export type SaleCampaign = {
  id: string; name: string; slug: string; description: string; desktopImage: string; mobileImage: string; ctaText: string;
  startsAt: number; endsAt: number; status: CampaignStatus; mode: 'collection' | 'percentage' | 'fixed'; percentage: number;
  categoryNames: string[]; displayOrder: number; homepage: boolean; featured: boolean; revision: number; assignedCount: number;
};
export type SaleAssignment = { productId: string; fixedPriceINR?: number };
export type CampaignMemberships = Record<string, { fixedPriceINR?: number }>;
export type SalePrice = { priceINR: number; regularPriceINR: number; saleCampaignIds: string[]; saleCampaign?: { id: string; name: string; slug: string; endsAt: number } };
export const campaignState = (c: SaleCampaign, now: number): string => c.status !== 'published' ? c.status : now < c.startsAt ? 'scheduled' : now >= c.endsAt ? 'ended' : 'active';
export const campaignActive = (c: SaleCampaign, now: number) => c.status === 'published' && Number.isSafeInteger(c.startsAt) && Number.isSafeInteger(c.endsAt) && c.startsAt <= now && now < c.endsAt;
export const campaignOrder = (a: SaleCampaign, b: SaleCampaign) => a.displayOrder - b.displayOrder || a.id.localeCompare(b.id, 'en');
export const validCampaignImage = (value: string) => {
  try { const url = new URL(value); return typeof value === 'string' && value.length <= 2048 && url.protocol === 'https:' && Boolean(url.hostname) && !url.username && !url.password && !/[\s\\]/.test(value); } catch { return false; }
};
export const campaignValidationError = (c: SaleCampaign): string | null => {
  if (typeof c.name !== 'string' || !c.name.trim() || c.name.length > 100) return 'Enter a campaign name of up to 100 characters.';
  if (typeof c.slug !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(c.slug) || c.slug.length > 80) return 'Use a unique slug with lowercase letters, numbers and single hyphens.';
  if (typeof c.description !== 'string' || c.description.length > 2000 || typeof c.ctaText !== 'string' || !c.ctaText.trim() || c.ctaText.length > 80) return 'Enter CTA text (up to 80 characters) and a description of up to 2,000 characters.';
  if (!validCampaignImage(c.desktopImage) || typeof c.mobileImage !== 'string' || (c.mobileImage && !validCampaignImage(c.mobileImage))) return 'Use valid HTTPS banner image URLs without credentials.';
  if (!Number.isSafeInteger(c.startsAt) || !Number.isSafeInteger(c.endsAt) || c.startsAt < 0 || c.endsAt <= c.startsAt || c.endsAt > 8_640_000_000_000_000) return 'Choose a valid start and a later end time in Asia/Kolkata.';
  if (!['collection', 'percentage', 'fixed'].includes(c.mode)) return 'Choose a valid pricing mode.';
  if (!Number.isFinite(c.percentage) || c.percentage < 0 || c.percentage >= 100 || Math.abs(c.percentage * 100 - Math.round(c.percentage * 100)) > 0.000001) return 'Discount must be 0% to 99.99%, with up to two decimal places.';
  if (!Array.isArray(c.categoryNames) || c.categoryNames.length > 30 || c.categoryNames.some(n => typeof n !== 'string' || !n.trim() || n.length > 100) || new Set(c.categoryNames).size !== c.categoryNames.length) return 'Select up to 30 unique categories.';
  if (c.mode === 'fixed' && c.categoryNames.length) return 'Fixed pricing requires individual product assignments; remove category selections.';
  if (!Number.isSafeInteger(c.displayOrder) || Math.abs(c.displayOrder) > 10000 || typeof c.homepage !== 'boolean' || typeof c.featured !== 'boolean') return 'Enter a whole-number display order between -10000 and 10000 and valid visibility settings.';
  return null;
};

/** No stacking. Lowest valid price wins, then display order, then campaign ID. */
export function resolveSalePrice(product: Product, campaigns: SaleCampaign[], memberships: CampaignMemberships, now: number): SalePrice {
  const regularPaise = moneyPaise(product.priceINR);
  const offers = campaigns.filter(c => campaignActive(c, now) && (Object.hasOwn(memberships, c.id) || c.categoryNames.includes(product.category))).flatMap(c => {
    let amount = regularPaise;
    if (c.mode === 'percentage') amount = Math.round(regularPaise * (10000 - Math.round(c.percentage * 100)) / 10000);
    if (c.mode === 'fixed') {
      const fixed = memberships[c.id]?.fixedPriceINR ?? NaN; amount = moneyPaise(fixed);
      if (!Number.isFinite(fixed) || Math.abs(fixed * 100 - amount) > 0.000001) return [];
    }
    // Invalid/more expensive stale offers never raise regular prices or become free.
    return Number.isSafeInteger(amount) && amount > 0 && amount <= regularPaise ? [{ campaign: c, amount }] : [];
  }).sort((a, b) => a.amount - b.amount || campaignOrder(a.campaign, b.campaign));
  const winner = offers[0];
  return { priceINR: winner ? winner.amount / 100 : product.priceINR, regularPriceINR: product.priceINR, saleCampaignIds: offers.map(o => o.campaign.id), ...(winner ? { saleCampaign: { id: winner.campaign.id, name: winner.campaign.name, slug: winner.campaign.slug, endsAt: winner.campaign.endsAt } } : {}) };
}
export function withSalePrice(product: Product, price: SalePrice): Product {
  if (!price.saleCampaignIds.length) return product;
  const next = { ...product, ...price };
  return { ...next, discountPercentage: productPricing(next).discountPercentage };
}
export const kolkataInput = (epoch: number) => Number.isFinite(epoch) ? new Date(epoch + 330 * 60_000).toISOString().slice(0, 16) : '';
export const fromKolkataInput = (value: string) => value ? Date.parse(`${value}:00+05:30`) : NaN;
