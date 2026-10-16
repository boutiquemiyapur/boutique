import test from 'node:test';
import assert from 'node:assert/strict';
import { productPricing, editProductPricing, pricingValidationError, formatProductMoney } from '../src/utils/productPricing.js';
import { normalizeProduct, productForStorage } from '../src/utils/productData.js';
import { calculateCheckoutTotals } from '../src/utils/checkoutTotals.js';
import { fixture } from './payment-fixture.js';
import { CancellationService } from '../server/orders/cancellation.js';

for (const discount of [0, 10, 25, 33.33, 50, 75]) test(`${discount}% derives selling price and savings in paise`, () => {
  const { product } = editProductPricing({ priceINR: 2000, originalPriceINR: 2000 }, 'discountPercentage', discount, 'price');
  assert.equal(product.priceINR, Math.round(200000 * (10000 - discount * 100) / 10000) / 100);
  assert.equal(productPricing(product).discountPercentage, discount);
  assert.equal(productPricing(product).discountAmountINR, (200000 - Math.round(product.priceINR * 100)) / 100);
  assert.equal(productPricing(product).isDiscounted, discount > 0);
});

test('legacy conflicts never reprice; missing/equal/invalid MRP never creates a badge', () => {
  const product = normalizeProduct({ priceINR: 1000, originalPriceINR: 1500, discountPercentage: 50 });
  assert.equal(product.priceINR, 1000); assert.equal(product.discountPercentage, 33.33);
  assert.equal(productPricing(product).discountAmountINR, 500);
  assert.equal(productForStorage(product).priceINR, 1000);
  for (const originalPriceINR of [undefined, null, 0, -1, NaN, Infinity, 500, 1000]) {
    assert.equal(productPricing({ priceINR: 1000, originalPriceINR, discountPercentage: 50 }).isDiscounted, false);
  }
  assert.equal(productPricing({ priceINR: 0.01, originalPriceINR: 1000 }).discountPercentage, 99.99);
});

test('last-edited mode survives MRP changes and never round-trips a derived percentage', () => {
  let state = editProductPricing({ priceINR: 1000, originalPriceINR: 1500, discountPercentage: 33.33 }, 'originalPriceINR', 3000, 'price');
  assert.equal(state.product.priceINR, 1000); assert.equal(state.product.discountPercentage, 66.67);
  state = editProductPricing(state.product, 'discountPercentage', 50, state.mode);
  assert.equal(state.product.priceINR, 1500);
  state = editProductPricing(state.product, 'originalPriceINR', 2000, state.mode);
  assert.equal(state.product.priceINR, 1000);
  state = editProductPricing(state.product, 'priceINR', 1500, state.mode);
  assert.equal(state.mode, 'price'); assert.equal(state.product.discountPercentage, 25);
  state = editProductPricing(state.product, 'originalPriceINR', 3000, state.mode);
  assert.equal(state.product.priceINR, 1500); assert.equal(state.product.discountPercentage, 50);
  state = editProductPricing(state.product, 'originalPriceINR', undefined, state.mode);
  assert.equal(state.product.priceINR, 1500); assert.equal(state.product.discountPercentage, 0);
  const withoutMrp = editProductPricing({ priceINR: 750, originalPriceINR: 1500, discountPercentage: 50 }, 'originalPriceINR', undefined, 'discount');
  assert.equal(withoutMrp.product.priceINR, 750); assert.equal(withoutMrp.product.discountPercentage, 0); assert.equal(withoutMrp.mode, 'price');
});

test('validation rejects invalid money and discounts; selling-only products work', () => {
  for (const priceINR of [0, -1, NaN, Infinity, 1.001, 1000001]) assert.ok(pricingValidationError({ priceINR }));
  for (const originalPriceINR of [0, -1, NaN, Infinity, 1.001, 999]) assert.ok(pricingValidationError({ priceINR: 1000, originalPriceINR }));
  for (const discountPercentage of [-1, 100, 101, NaN, Infinity]) assert.ok(pricingValidationError({ priceINR: 1000, originalPriceINR: 1500, discountPercentage }));
  assert.ok(pricingValidationError({ priceINR: 1000, discountPercentage: 10 }));
  assert.equal(pricingValidationError({ priceINR: 1000 }), null);
  assert.throws(() => productForStorage(normalizeProduct({ priceINR: 0 })), /Selling price/);
});

test('paise rounding and display retain decimal selling prices and exact cart totals', () => {
  const state = editProductPricing({ priceINR: 99.99, originalPriceINR: 99.99 }, 'discountPercentage', 25, 'price');
  assert.equal(state.product.priceINR, 74.99); assert.equal(productPricing(state.product).discountAmountINR, 25);
  assert.equal(formatProductMoney(1000.25), '1,000.25');
  const product = normalizeProduct({ priceINR: 0.1 });
  const totals = calculateCheckoutTotals([{ product, quantity: 3, isCustomTailored: false } as any], null, []);
  assert.equal(totals.subtotalINR, 0.3); assert.equal(totals.totalINR, 0.3);
});

test('Razorpay amount uses authoritative selling price, quantities, variants and delivery; ignores legacy discount', async () => {
  const f = fixture(10);
  Object.assign(f.docs.get('products/dress').data, { priceINR: 1000.25, originalPriceINR: 1500, discountPercentage: 50 });
  f.docs.get('settings/admin').data.checkoutCharges = [{ id: 'delivery', name: 'Delivery', type: 'fixed', value: 50, enabled: true, sortOrder: 0 }];
  f.request.items[0].quantity = 3;
  const result = await f.service.create('discount-customer', f.request);
  assert.equal(result.order.items[0].product.priceINR, 1000.25);
  assert.equal(result.order.items[0].product.discountPercentage, 33.32);
  assert.equal(result.order.subtotalINR, 3000.75); assert.equal(result.order.amountPaise, 305075);
  assert.equal(f.orders[0].amount, 305075);
  assert.equal(calculateCheckoutTotals(result.order.items, null, result.order.charges!).totalINR, 3050.75);
  assert.equal(f.docs.get('products/dress').data.variantInventory[0].stock, 7);
  assert.equal((await f.service.create('discount-customer', f.request)).order.id, result.order.id); assert.equal(f.calls, 1);
  const snapshot = structuredClone(result.order);
  Object.assign(f.docs.get('products/dress').data, { priceINR: 750, discountPercentage: 50 });
  assert.deepEqual(await f.service.owned('discount-customer', result.order.id), snapshot);
});

test('expired price changes stop before a second provider order; historical amount remains intact', async () => {
  const f = fixture(5); f.evidence({ status: 'created', captured: false });
  const result = await f.service.create('customer', f.request);
  f.advance(); await f.service.reconcile(result.order.id); await f.service.release(result.order.id);
  f.docs.get('products/dress').data.priceINR = 750;
  await assert.rejects(f.service.create('customer', f.request), /RETRY_PRICE_CHANGED/);
  assert.equal(f.calls, 1); assert.equal((await f.service.owned('customer', result.order.id)).amountPaise, 149900);
});

test('future catalog discounts cannot change a paid order or its approved refund quote', async () => {
  const f = fixture(5);
  const result = await f.service.create('customer', f.request);
  await f.service.syncPayment(result.order.id, 'pay_test1');
  f.docs.get('products/dress').data.priceINR = 750;
  f.docs.get('products/dress').data.originalPriceINR = 1500;
  f.docs.get('products/dress').data.discountPercentage = 50;
  f.docs.set('refundSettings/control', { enabled: true, revision: 1, updatedBy: 'admin', updatedAt: new Date(1_800_000_000_000).toISOString() });
  const cancellation = new CancellationService(f.db, f.provider, true, () => 1_800_000_000_000);
  await cancellation.request('customer', result.order.id, 'Other');
  await cancellation.review('admin', result.order.id, true, 'Approved');
  const quote = await cancellation.prepareRefundReview('admin', result.order.id);
  assert.equal(quote.amountPaise, 149900);
  const historical = await f.service.owned('customer', result.order.id);
  assert.equal(historical.items[0].product.priceINR, 1499); assert.equal(historical.amountPaise, 149900);
  assert.equal(historical.refund?.amountPaise, 149900); assert.equal(f.refundCalls, 0);
});
