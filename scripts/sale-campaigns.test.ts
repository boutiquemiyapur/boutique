import test from 'node:test';
import assert from 'node:assert/strict';
import { campaignActive, campaignState, campaignValidationError, fromKolkataInput, kolkataInput, resolveSalePrice, withSalePrice, type SaleCampaign } from '../src/utils/saleCampaigns.js';
import { normalizeProduct, productForStorage, refreshCartProducts, productSelectionKey } from '../src/utils/productData.js';
import { productPricing } from '../src/utils/productPricing.js';
import { calculateCheckoutTotals } from '../src/utils/checkoutTotals.js';
import { fixture } from './payment-fixture.js';
import { parseCheckout } from '../server/payments/validation.js';
import { CancellationService } from '../server/orders/cancellation.js';

const now = 1_800_000_000_000;
const campaign = (extra: Partial<SaleCampaign> = {}): SaleCampaign => ({ id: 'diwali', name: 'Diwali Special Sale', slug: 'diwali-2026', description: 'Festival collection', desktopImage: 'https://images.example.com/desktop.jpg', mobileImage: '', ctaText: 'Explore Diwali Offers', startsAt: now - 1000, endsAt: now + 3600000, status: 'published', mode: 'percentage', percentage: 20, categoryNames: [], displayOrder: 1, homepage: true, featured: true, revision: 1, assignedCount: 1, ...extra });
const product = normalizeProduct({ id: 'dress', title: 'Festive dress', sku: 'F1', category: 'Dresses', priceINR: 1800, originalPriceINR: 2000, stockCount: 10 });
test('percentage on regular selling price gives accurate MRP discount and never mutates the base', () => {
  const effective = withSalePrice(product, resolveSalePrice(product, [campaign()], { diwali: {} }, now));
  assert.equal(effective.priceINR, 1440); assert.equal(effective.regularPriceINR, 1800);
  assert.equal(productPricing(effective).discountPercentage, 28); assert.equal(productPricing(effective).discountAmountINR, 560);
  assert.equal(product.priceINR, 1800); assert.throws(() => productForStorage(effective), /regular catalog/);
});
test('collection-only preserves regular discounts, fixed price never increases price, missing fixed prices are excluded', () => {
  assert.equal(resolveSalePrice(product, [campaign({ mode: 'collection' })], { diwali: {} }, now).priceINR, 1800);
  const fixed = campaign({ mode: 'fixed' });
  assert.equal(resolveSalePrice(product, [fixed], { diwali: { fixedPriceINR: 1250.25 } }, now).priceINR, 1250.25);
  for (const fixedPriceINR of [undefined, 0, -1, Infinity, NaN, 1800.01, 1.001]) assert.equal(resolveSalePrice(product, [fixed], { diwali: { fixedPriceINR } }, now).priceINR, 1800);
});
test('overlaps never stack; lowest price then display order then stable ID wins', () => {
  const a = campaign({ id: 'a', percentage: 10, displayOrder: -1 }); const b = campaign({ id: 'b' });
  const memberships = { a: {}, b: {} };
  assert.equal(resolveSalePrice(product, [a, b], memberships, now).saleCampaign?.id, 'b');
  assert.equal(resolveSalePrice(product, [a, b], memberships, now).priceINR, 1440);
  b.percentage = 10; assert.equal(resolveSalePrice(product, [b, a], memberships, now).saleCampaign?.id, 'a');
  b.displayOrder = -1; assert.equal(resolveSalePrice(product, [b, a], memberships, now).saleCampaign?.id, 'a');
});
test('eligibility starts inclusively, ends exclusively, and rejects drafts/paused/archived/ended', () => {
  const c = campaign({ startsAt: now, endsAt: now + 1 });
  assert.equal(campaignActive(c, now - 1), false); assert.equal(campaignActive(c, now), true); assert.equal(campaignActive(c, now + 1), false);
  assert.equal(campaignState(c, now - 1), 'scheduled'); assert.equal(campaignState(c, now), 'active'); assert.equal(campaignState(c, now + 1), 'ended');
  for (const status of ['draft', 'paused', 'archived', 'ended'] as const) assert.equal(resolveSalePrice(product, [campaign({ status })], { diwali: {} }, now).priceINR, 1800);
});
test('category membership supports current and future products and removed assignments stop applying', () => {
  assert.equal(resolveSalePrice(product, [campaign({ categoryNames: ['Dresses'] })], {}, now).priceINR, 1440);
  assert.equal(resolveSalePrice(product, [campaign()], {}, now).priceINR, 1800);
  assert.equal(resolveSalePrice({ ...product, category: 'Sarees' }, [campaign({ categoryNames: ['Dresses'] })], {}, now).priceINR, 1800);
});
test('paise rounding, absent MRP and quantity totals remain consistent', () => {
  const p = { ...product, priceINR: 99.99, originalPriceINR: undefined };
  const effective = withSalePrice(p, resolveSalePrice(p, [campaign({ percentage: 25 })], { diwali: {} }, now));
  assert.equal(effective.priceINR, 74.99); assert.equal(productPricing(effective).referenceLabel, 'Regular price');
  assert.equal(productPricing(effective).discountAmountINR, 25);
  const cart = refreshCartProducts([{ product: p, quantity: 3, isCustomTailored: false } as any], [effective]);
  assert.equal(calculateCheckoutTotals(cart, null, []).totalINR, 224.97);
});
test('validation rejects invalid prices, schedules, URL credentials and oversized category selections', () => {
  assert.equal(campaignValidationError(campaign()), null);
  for (const change of [{ percentage: 100 }, { percentage: -1 }, { percentage: 33.333 }, { startsAt: NaN }, { endsAt: now - 1001 }, { slug: '../admin' }, { desktopImage: 'javascript:alert(1)' }, { mobileImage: 'https://user:pass@example.com/x.jpg' }, { categoryNames: Array(31).fill('A') }, { mode: 'fixed', categoryNames: ['Dresses'] }]) assert.ok(campaignValidationError(campaign(change as any)));
});
test('Asia/Kolkata scheduling round-trips independently of the machine timezone', () => {
  const epoch = fromKolkataInput('2026-10-20T09:30'); assert.equal(new Date(epoch).toISOString(), '2026-10-20T04:00:00.000Z');
  assert.equal(kolkataInput(epoch), '2026-10-20T09:30'); assert.ok(Number.isNaN(fromKolkataInput('')));
});
test('price and stock updates preserve selection identity; changed gallery/options invalidate it', () => {
  assert.equal(productSelectionKey(product), productSelectionKey({ ...product, priceINR: 1440, stockCount: 2 }));
  assert.notEqual(productSelectionKey(product), productSelectionKey({ ...product, availableSizes: ['S'] }));
  assert.notEqual(productSelectionKey(product), productSelectionKey({ ...product, images: ['new.jpg'] }));
});
function seed(f: ReturnType<typeof fixture>, c = campaign()) {
  f.docs.set('saleCampaignControl/published', { ids: [c.id] }); f.docs.set(`saleCampaigns/${c.id}`, c);
  f.docs.set('saleProductAssignments/dress', { campaigns: { [c.id]: {} } });
  Object.assign(f.docs.get('products/dress').data, { priceINR: 1800, originalPriceINR: 2000 });
}
test('server-priced Razorpay order reserves original variants without persisting temporary prices to catalog', async () => {
  const f = fixture(10); seed(f); f.request.items[0].quantity = 3;
  f.docs.get('settings/admin').data.checkoutCharges = [{ id: 'delivery', name: 'Delivery', type: 'fixed', value: 50, enabled: true, sortOrder: 0 }];
  const result = await f.service.create('uid', f.request);
  assert.equal(result.order.amountPaise, 437000); assert.equal(f.orders[0].amount, 437000);
  assert.equal(result.order.items[0].product.priceINR, 1440); assert.equal(result.order.items[0].product.discountPercentage, 28);
  const stored = f.docs.get('products/dress').data;
  assert.equal(stored.priceINR, 1800); assert.equal(stored.saleCampaign, undefined); assert.equal(stored.regularPriceINR, undefined);
  assert.equal(stored.variantInventory[0].stock, 7);
  assert.equal((await f.service.create('uid', f.request)).order.id, result.order.id); assert.equal(f.calls, 1);
});
test('paused/expired/removed offers do not affect fresh orders; forged client price/campaign fields fail', async () => {
  for (const mutation of ['paused', 'expired', 'removed']) {
    const f = fixture(5); seed(f);
    if (mutation === 'paused') f.docs.get('saleCampaigns/diwali').status = 'paused';
    if (mutation === 'expired') f.docs.get('saleCampaigns/diwali').endsAt = now;
    if (mutation === 'removed') f.docs.get('saleProductAssignments/dress').campaigns = {};
    const result = await f.service.create('uid', f.request); assert.equal(result.order.amountPaise, 180000);
  }
  const f = fixture();
  for (const extra of [{ priceINR: 1 }, { campaignId: 'diwali' }, { discountPercentage: 99 }]) assert.throws(() => parseCheckout({ ...f.request, items: [{ ...f.request.items[0], ...extra }] }), /UNEXPECTED_FIELD/);
});
test('expired quote renewal detects campaign end without a duplicate provider order', async () => {
  const f = fixture(5); seed(f, campaign({ endsAt: now + 1000 })); f.evidence({ status: 'created', captured: false });
  const result = await f.service.create('uid', f.request); f.advance(); await f.service.reconcile(result.order.id); await f.service.release(result.order.id);
  await assert.rejects(f.service.create('uid', f.request), /RETRY_PRICE_CHANGED/); assert.equal(f.calls, 1);
  assert.equal((await f.service.owned('uid', result.order.id)).amountPaise, 144000);
});
test('sale pricing never bypasses variant selection or out-of-stock validation', async () => {
  for (const mutation of ['variant', 'stock']) {
    const f = fixture(5); seed(f);
    if (mutation === 'variant') f.request.items[0].selectedSize = 'XL';
    else { f.docs.get('products/dress').data.stockCount = 0; f.docs.get('products/dress').data.variantInventory[0].stock = 0; }
    await assert.rejects(f.service.create('uid', f.request), /INVALID_OPTIONS_OR_STOCK/); assert.equal(f.calls, 0);
  }
});
test('historical sale prices and refund quotes survive later campaign and catalog changes', async () => {
  const f = fixture(5); seed(f); const result = await f.service.create('uid', f.request);
  f.evidence({ amount: 144000 }); await f.service.syncPayment(result.order.id, 'pay_test1');
  f.docs.get('saleCampaigns/diwali').status = 'archived'; f.docs.get('products/dress').data.priceINR = 750;
  f.docs.set('refundSettings/control', { enabled: true, revision: 1, updatedBy: 'admin', updatedAt: new Date(now).toISOString() });
  const service = new CancellationService(f.db, f.provider, true, () => now);
  await service.request('uid', result.order.id, 'Other'); await service.review('admin', result.order.id, true, 'Approved');
  const quote = await service.prepareRefundReview('admin', result.order.id); assert.equal(quote.amountPaise, 144000);
  const saved = await f.service.owned('uid', result.order.id); assert.equal(saved.items[0].product.priceINR, 1440); assert.equal(saved.items[0].product.saleCampaign?.id, 'diwali'); assert.equal(f.refundCalls, 0);
  assert.equal(f.docs.get('products/dress').data.priceINR, 750); assert.equal(f.docs.get('products/dress').data.saleCampaign, undefined);
});
