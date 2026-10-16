import type { Firestore, Transaction } from 'firebase-admin/firestore';
import { campaignActive, campaignOrder, campaignValidationError, resolveSalePrice, type CampaignMemberships, type SaleAssignment, type SaleCampaign } from '../../src/utils/saleCampaigns.js';
import { productFromDocument } from '../../src/utils/productData.js';
import { requireCondition } from '../payments/errors.js';
import { identifier, object, only, paise } from '../payments/validation.js';

export const MAX_PUBLISHED_CAMPAIGNS = 20;
const controlRef = (db: Firestore) => db.collection('saleCampaignControl').doc('published');
const campaignRef = (db: Firestore, id: string) => {
  identifier(id); requireCondition(!['__proto__', 'constructor', 'prototype'].includes(id), 'INVALID_CAMPAIGN_ID');
  return db.collection('saleCampaigns').doc(id);
};
const read = async (ref: FirebaseFirestore.DocumentReference, tx?: Transaction) => tx ? tx.get(ref) : ref.get();
const all = async (db: Firestore, refs: FirebaseFirestore.DocumentReference[], tx?: Transaction) => refs.length ? tx ? tx.getAll(...refs) : db.getAll(...refs) : [];

/** A bounded, transactional publication index avoids scans and extra checkout indexes. */
export async function activeCampaigns(db: Firestore, now: number, tx?: Transaction) {
  const control = await read(controlRef(db), tx);
  const ids = control.data()?.ids ?? [];
  requireCondition(Array.isArray(ids) && ids.length <= MAX_PUBLISHED_CAMPAIGNS && new Set(ids).size === ids.length && ids.every(id => typeof id === 'string' && /^[\w-]{1,100}$/.test(id)), 'CAMPAIGN_CONFIGURATION_INVALID', 503);
  const snapshots = await all(db, ids.map(id => campaignRef(db, id)), tx);
  const campaigns = snapshots.filter(s => s.exists).map(s => ({ ...s.data(), id: s.id }) as SaleCampaign);
  requireCondition(campaigns.every(c => !campaignValidationError(c)), 'CAMPAIGN_CONFIGURATION_INVALID', 503);
  return campaigns.filter(c => campaignActive(c, now)).sort(campaignOrder);
}
export async function campaignPrices(db: Firestore, products: import('../../src/types/index.js').Product[], now: number, tx?: Transaction) {
  const campaigns = await activeCampaigns(db, now, tx);
  const memberships = campaigns.length ? await all(db, products.map(p => db.collection('saleProductAssignments').doc(p.id)), tx) : [];
  return products.map((product, index) => resolveSalePrice(product, campaigns, memberships[index]?.data()?.campaigns ?? {}, now));
}

function parseCampaign(value: unknown, id: string): SaleCampaign {
  const b = object(value);
  only(b, ['name', 'slug', 'description', 'desktopImage', 'mobileImage', 'ctaText', 'startsAt', 'endsAt', 'mode', 'percentage', 'categoryNames', 'displayOrder', 'homepage', 'featured']);
  const campaign = { ...b, id, status: 'draft', revision: 0, assignedCount: 0 } as SaleCampaign;
  const error = campaignValidationError(campaign); requireCondition(!error, 'INVALID_CAMPAIGN', 400);
  return campaign;
}
export class CampaignService {
  constructor(public db: Firestore, public now = () => Date.now()) {}
  async list(cursor = '') {
    let query = this.db.collection('saleCampaigns').orderBy('__name__').limit(21);
    if (cursor) query = query.startAfter(identifier(cursor));
    const result = await query.get();
    return { campaigns: result.docs.slice(0, 20).map(s => ({ ...s.data(), id: s.id })), cursor: result.docs.length > 20 ? result.docs[19].id : null, now: this.now() };
  }
  async assignments(id: string, cursor = '') {
    let query = campaignRef(this.db, id).collection('products').orderBy('__name__').limit(101);
    if (cursor) query = query.startAfter(identifier(cursor));
    const result = await query.get();
    return { assignments: result.docs.slice(0, 100).map(s => s.data()), cursor: result.docs.length > 100 ? result.docs[99].id : null };
  }
  async save(uid: string, id: string, revision: number, value: unknown) {
    const input = parseCampaign(value, id);
    return this.db.runTransaction(async tx => {
      const ref = campaignRef(this.db, id); const snapshot = await tx.get(ref); const previous = snapshot.data() as SaleCampaign | undefined;
      requireCondition((previous?.revision ?? 0) === revision, 'CAMPAIGN_CHANGED', 409);
      requireCondition(!previous || previous.status !== 'published', 'PAUSE_CAMPAIGN_BEFORE_EDITING', 409);
      const slugRef = this.db.collection('saleCampaignSlugs').doc(input.slug); const slug = await tx.get(slugRef);
      const oldSlugRef = previous && previous.slug !== input.slug ? this.db.collection('saleCampaignSlugs').doc(previous.slug) : null;
      if (oldSlugRef) await tx.get(oldSlugRef);
      requireCondition(!slug.exists || slug.data()?.campaignId === id, 'CAMPAIGN_SLUG_TAKEN', 409);
      const next = { ...input, revision: revision + 1, assignedCount: previous?.assignedCount ?? 0, updatedBy: uid, updatedAt: this.now() };
      tx.set(ref, next); tx.set(slugRef, { campaignId: id }); if (oldSlugRef) tx.delete(oldSlugRef);
      return next;
    });
  }
  async assign(uid: string, id: string, revision: number, values: unknown) {
    requireCondition(Array.isArray(values) && values.length > 0 && values.length <= 50, 'INVALID_ASSIGNMENTS');
    const changes = values.map(v => {
      const b = object(v); only(b, ['productId', 'remove', 'fixedPriceINR']);
      requireCondition(typeof b.remove === 'boolean', 'INVALID_ASSIGNMENTS');
      const productId = identifier(b.productId); if (b.fixedPriceINR !== undefined) requireCondition(paise(b.fixedPriceINR) > 0, 'INVALID_SALE_PRICE');
      return { productId, remove: b.remove, ...(b.fixedPriceINR !== undefined ? { fixedPriceINR: Number(b.fixedPriceINR) } : {}) };
    });
    requireCondition(new Set(changes.map(c => c.productId)).size === changes.length, 'INVALID_ASSIGNMENTS');
    return this.db.runTransaction(async tx => {
      const ref = campaignRef(this.db, id); const snapshot = await tx.get(ref); const campaign = snapshot.data() as SaleCampaign;
      requireCondition(snapshot.exists && campaign.revision === revision, 'CAMPAIGN_CHANGED', 409);
      requireCondition(campaign.status !== 'published', 'PAUSE_CAMPAIGN_BEFORE_EDITING', 409);
      const productRefs = changes.map(c => this.db.collection('products').doc(c.productId));
      const assignmentRefs = changes.map(c => ref.collection('products').doc(c.productId));
      const reverseRefs = changes.map(c => this.db.collection('saleProductAssignments').doc(c.productId));
      const snapshots = await tx.getAll(...productRefs, ...assignmentRefs, ...reverseRefs);
      let count = campaign.assignedCount;
      changes.forEach((change, i) => {
        const product = snapshots[i].exists ? productFromDocument(change.productId, snapshots[i].data()!) : null;
        const old = snapshots[i + changes.length]; const reverse = snapshots[i + 2 * changes.length].data()?.campaigns ?? {};
        if (change.remove) { delete reverse[id]; if (old.exists) count--; }
        else {
          requireCondition(product && product.isActive !== false, 'INVALID_CAMPAIGN_PRODUCT', 409);
          if (campaign.mode === 'fixed') requireCondition(change.fixedPriceINR != null && paise(change.fixedPriceINR) <= paise(product!.priceINR), 'SALE_PRICE_EXCEEDS_REGULAR', 409);
          requireCondition(Object.hasOwn(reverse, id) || Object.keys(reverse).length < 100, 'PRODUCT_CAMPAIGN_LIMIT', 409);
          reverse[id] = change.fixedPriceINR == null ? {} : { fixedPriceINR: change.fixedPriceINR }; if (!old.exists) count++;
        }
        if (change.remove) tx.delete(assignmentRefs[i]);
        else tx.set(assignmentRefs[i], { productId: change.productId, ...reverse[id] });
        tx.set(reverseRefs[i], { campaigns: reverse });
      });
      const next = { ...campaign, assignedCount: count, revision: revision + 1, updatedBy: uid, updatedAt: this.now() };
      tx.set(ref, next); return next;
    });
  }
  async transition(uid: string, id: string, revision: number, status: SaleCampaign['status']) {
    requireCondition(['published', 'paused', 'ended', 'archived'].includes(status), 'INVALID_CAMPAIGN_STATUS');
    const ref = campaignRef(this.db, id); const before = await ref.get(); const c = before.data() as SaleCampaign;
    requireCondition(before.exists && c.revision === revision, 'CAMPAIGN_CHANGED', 409);
    if (status === 'published') {
      requireCondition(!campaignValidationError(c) && c.endsAt > this.now(), 'INVALID_CAMPAIGN', 409);
      requireCondition(c.assignedCount > 0 || c.categoryNames.length > 0, 'CAMPAIGN_NEEDS_PRODUCTS', 409);
      // Paginated validation outside the transaction; revision is checked again in
      // the publication transaction, so concurrent edits cannot slip through.
      let cursor = ''; let count = 0;
      do {
        const page = await this.assignments(id, cursor);
        const rows = page.assignments as SaleAssignment[];
        const products = await all(this.db, rows.map(r => this.db.collection('products').doc(r.productId)));
        rows.forEach((row, i) => {
          const p = products[i].exists ? productFromDocument(row.productId, products[i].data()!) : null;
          requireCondition(p && p.isActive !== false, 'INVALID_CAMPAIGN_PRODUCT', 409);
          if (c.mode === 'fixed') requireCondition(row.fixedPriceINR != null && paise(row.fixedPriceINR) > 0 && paise(row.fixedPriceINR) <= paise(p!.priceINR), 'SALE_PRICE_EXCEEDS_REGULAR', 409);
          count++;
        }); cursor = page.cursor ?? '';
      } while (cursor);
      requireCondition(count === c.assignedCount, 'CAMPAIGN_CHANGED', 409);
    }
    return this.db.runTransaction(async tx => {
      const snapshot = await tx.get(ref); const current = snapshot.data() as SaleCampaign;
      const control = await tx.get(controlRef(this.db)); const ids: string[] = control.data()?.ids ?? [];
      requireCondition(current?.revision === revision, 'CAMPAIGN_CHANGED', 409);
      const nextIds = ids.filter(v => v !== id); if (status === 'published') nextIds.push(id);
      requireCondition(nextIds.length <= MAX_PUBLISHED_CAMPAIGNS, 'TOO_MANY_PUBLISHED_CAMPAIGNS', 409);
      const next = { ...current, status, revision: revision + 1, updatedBy: uid, updatedAt: this.now() };
      tx.set(ref, next); tx.set(controlRef(this.db), { ids: nextIds }); return next;
    });
  }
}
