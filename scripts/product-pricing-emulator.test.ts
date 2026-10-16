import assert from 'node:assert/strict';
import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { PaymentService } from '../server/payments/service.js';
import { parseCheckout } from '../server/payments/validation.js';
import type { PaymentProvider, ProviderOrder } from '../server/payments/provider.js';
assert.equal(process.env.FIRESTORE_EMULATOR_HOST, '127.0.0.1:8189', 'Dedicated local emulator only');
const db = getFirestore(initializeApp({ projectId: 'demo-ab-payments' }, 'product-pricing-tests'));
try {
  await db.doc('products/pricing-emulator').set({ status: 'active', inventoryVersion: 0, data: {
    id: 'pricing-emulator', title: 'Pricing fixture', sku: 'PRICING', priceINR: 1000.25, originalPriceINR: 1500, discountPercentage: 50,
    stockCount: 5, colors: [{ colorName: 'Red', colorHex: '#ff0000', images: [] }], availableSizes: ['S'],
    variantInventory: [{ key: 'red::s', colorName: 'Red', size: 'S', stock: 5 }], customStitchingAvailable: false, customStitchingFeeINR: 0,
  } });
  await db.doc('settings/admin').set({ data: { checkoutCharges: [{ id: 'delivery', name: 'Delivery', type: 'fixed', value: 50, enabled: true, sortOrder: 0 }] } });
  const orders: ProviderOrder[] = [];
  const provider: PaymentProvider = {
    keyId: 'mock-pricing-only', createOrder: async (amount, receipt, checkoutId) => {
      const order = { id: 'order_pricing', amount, receipt, currency: 'INR', notes: { checkoutId } };
      orders.push(order); return order;
    }, findOrders: async () => orders, order: async () => orders[0], payments: async () => [], refunds: async () => [],
    payment: async () => { throw Error('No payment may be initiated in this test'); },
  };
  let now = Date.now();
  const service = new PaymentService(db, provider, () => now);
  const request = parseCheckout({ intentId: 'pricing-emulator-intent', items: [{ productId: 'pricing-emulator', quantity: 3, selectedColor: 'Red', selectedSize: 'S' }], shippingAddress: { fullName: 'Pricing Fixture', phone: '9999999999', email: 'pricing@example.com', addressLine1: 'Fixture Street', city: 'Hyderabad', state: 'Telangana', pincode: '500001', country: 'India' } });
  const result = await service.create('pricing-user', request);
  assert.equal(orders[0].amount, 305075);
  assert.equal(result.order.items[0].product.discountPercentage, 33.32);
  assert.equal(result.order.items[0].product.priceINR, 1000.25);
  assert.equal((await db.doc('products/pricing-emulator').get()).data()!.data.variantInventory[0].stock, 2);
  await db.doc('products/pricing-emulator').update({ 'data.priceINR': 750, 'data.discountPercentage': 50 });
  assert.equal((await service.owned('pricing-user', result.order.id)).amountPaise, 305075);
  assert.equal((await service.create('pricing-user', request)).order.id, result.order.id); assert.equal(orders.length, 1);
  now += 900_001; await service.reconcile(result.order.id); await service.release(result.order.id);
  await assert.rejects(service.create('pricing-user', request), /RETRY_PRICE_CHANGED/); assert.equal(orders.length, 1);
  assert.equal((await service.owned('pricing-user', result.order.id)).items[0].product.priceINR, 1000.25);
  console.log('Real Firestore pricing: legacy discounts, paise/quantity/variant/delivery totals, immutable order snapshots, same-intent reuse and expired changed-price rejection passed.');
} finally { await db.terminate(); }
