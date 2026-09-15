import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const outfile = resolve('node_modules/.cache/order-transaction-tests.mjs');
await build({
  absWorkingDir: process.cwd(),
  entryPoints: [resolve('api/orders/create.ts')],
  outfile,
  bundle: true,
  platform: 'node',
  format: 'esm',
  packages: 'external',
  plugins: [{ name: 'firebase-admin-fixture', setup(builder) {
    builder.onResolve({ filter: /^firebase-admin\/(app|auth|firestore)$/ }, (args) => ({ path: args.path, namespace: 'fixture' }));
    builder.onLoad({ filter: /.*/, namespace: 'fixture' }, ({ path }) => ({ loader: 'js', contents: path.endsWith('/app')
      ? 'export const getApps=()=>[{}]; export const initializeApp=()=>({}); export const cert=(value)=>value;'
      : path.endsWith('/auth')
        ? 'export const getAuth=()=>({verifyIdToken:async()=>({uid:"customer-123456789"})});'
        : 'export const getFirestore=()=>globalThis.testDatabase; export const FieldValue={serverTimestamp:()=>"server-time",increment:(value)=>({__increment:value})};' }));
  } }],
});
const { default: handler } = await import(pathToFileURL(outfile).href);

const response = () => {
  const result = { code: 0, body: null };
  return { result, api: { status(code) { result.code = code; return { json(value) { result.body = value; } }; } } };
};
const undefinedPaths = (value, path = 'data', found = []) => {
  if (value === undefined) {
    found.push(path);
    return found;
  }
  if (value === null || typeof value !== 'object') return found;
  if (Array.isArray(value)) value.forEach((item, index) => undefinedPaths(item, `${path}[${index}]`, found));
  else Object.entries(value).forEach(([key, item]) => undefinedPaths(item, `${path}.${key}`, found));
  return found;
};
const assertFirestoreSafe = (value) => assert.deepEqual(undefinedPaths(value), []);
const snapshot = (ref, value) => ({ id: ref.id, exists: value !== undefined, data: () => value });
const database = (initial) => {
  const documents = new Map(Object.entries(initial));
  const db = {
    documents,
    collection(name) { return { doc(id) { return { id, path: `${name}/${id}` }; } }; },
    async runTransaction(callback) {
      const pending = [];
      const transaction = {
        get: async (ref) => snapshot(ref, documents.get(ref.path)),
        getAll: async (...refs) => refs.map((ref) => snapshot(ref, documents.get(ref.path))),
        update: (ref, value) => {
          assertFirestoreSafe(value);
          pending.push(() => { const current = documents.get(ref.path); const next = { ...current, ...value }; for (const [key, item] of Object.entries(value)) if (item?.__increment) next[key] = (current?.[key] || 0) + item.__increment; documents.set(ref.path, next); });
        },
        set: (ref, value) => {
          assertFirestoreSafe(value);
          pending.push(() => documents.set(ref.path, value));
        },
      };
      const result = await callback(transaction);
      pending.forEach((write) => write());
      return result;
    },
  };
  return db;
};
const product = {
  id: 'dress', title: 'Dress', subtitle: '', sku: 'D-1', category: 'Dresses', fabric: '', occasion: '', priceINR: 1000,
  rating: 0, reviewCount: 0, images: [], colors: [{ colorName: 'Red', colorHex: '', images: [] }], availableSizes: ['S'],
  variantInventory: [{ key: 'red::s', colorName: 'Red', size: 'S', stock: 2 }], stockCount: 2, isReadyToShip: true,
  description: '', craftDetails: '', careInstructions: '', customStitchingAvailable: false, customStitchingFeeINR: 0, tags: [], isActive: true,
};
const validBody = { requestId: 'request-12345678', expectedTotalINR: 1100, items: [{ productId: 'dress', selectedColor: 'Red', selectedSize: 'S', quantity: 1, isCustomTailored: false, expectedPriceINR: 1000, expectedTailoringFeeINR: 0 }], shippingAddress: { fullName: 'Customer', phone: '9999999999', email: 'customer@example.com', addressLine1: 'Street', city: 'Hyderabad', state: 'Telangana', pincode: '500001', country: 'India' } };

test('trusted checkout creates the order and decrements the exact variant atomically', async () => {
  globalThis.testDatabase = database({
    'products/dress': { data: product, category: 'Dresses', sku: 'D-1', status: 'active', inventoryVersion: 7 },
    'settings/admin': { data: { checkoutCharges: [{ id: 'gst', name: 'GST', type: 'percentage', value: 5, enabled: true, sortOrder: 0 }, { id: 'delivery', name: 'Delivery', type: 'fixed', value: 50, enabled: true, sortOrder: 1 }] } },
  });
  const first = response();
  await handler({ method: 'POST', headers: { authorization: 'Bearer token' }, body: validBody }, first.api);
  assert.equal(first.result.code, 200);
  assert.equal(first.result.body.order.totalINR, 1100);
  assert.equal(first.result.body.order.items.length, 1);
  assert.equal(first.result.body.order.items[0].selectedColor, 'Red');
  assert.equal(first.result.body.order.items[0].selectedSize, 'S');
  assert.equal(first.result.body.order.items[0].giftPackaging, false);
  assert.equal(first.result.body.order.items[0].product.customStitchingAvailable, false);
  assert.equal('weightGrams' in first.result.body.order.items[0].product, false);
  assert.equal(first.result.body.order.items[0].product.subtitle, '');
  assert.equal(first.result.body.order.couponCodeApplied, null);
  assert.deepEqual(first.result.body.order.charges.map((charge) => [charge.name, charge.amountINR]), [['GST', 50], ['Delivery', 50]]);
  assertFirestoreSafe(first.result.body.order);
  const storedOrder = [...globalThis.testDatabase.documents.entries()].find(([key]) => key.startsWith('orders/'))?.[1];
  assert.ok(storedOrder);
  assertFirestoreSafe(storedOrder);
  assert.equal(storedOrder.customerId, 'customer-123456789');
  assert.equal(storedOrder.data.paymentMethod, 'cod');
  assert.equal(storedOrder.data.paymentStatus, 'Pending');
  assert.equal(storedOrder.data.timeline[0].timestamp, storedOrder.data.createdAt);
  assert.deepEqual(storedOrder.data.charges, first.result.body.order.charges);
  assert.equal(globalThis.testDatabase.documents.get('products/dress').data.variantInventory[0].stock, 1);
  assert.equal(globalThis.testDatabase.documents.get('products/dress').data.stockCount, 1);
  assert.equal(globalThis.testDatabase.documents.get('products/dress').inventoryVersion, 8);

  const retry = response();
  await handler({ method: 'POST', headers: { authorization: 'Bearer token' }, body: validBody }, retry.api);
  assert.equal(retry.result.code, 200);
  assert.equal(retry.result.body.order.id, first.result.body.order.id);
  assert.equal(globalThis.testDatabase.documents.get('products/dress').data.stockCount, 1);
  assert.equal(globalThis.testDatabase.documents.get('products/dress').inventoryVersion, 8);
});

test('trusted checkout removes multiple undefined optional fields from the product and address snapshots', async () => {
  globalThis.testDatabase = database({
    'products/dress': { data: { ...product, weightGrams: undefined, originalPriceINR: undefined, discountPercentage: undefined, includesBlousePiece: undefined, isBestseller: undefined, reviews: undefined, zariType: undefined, blouseLength: undefined, sareeLength: undefined, careInstructions: undefined, occasion: undefined, specifications: undefined, colors: [{ ...product.colors[0], swatchLabel: undefined }] }, category: 'Dresses', sku: 'D-1', status: 'active' },
    'settings/admin': { data: { checkoutCharges: [] } },
  });
  const result = response();
  const body = { ...validBody, expectedTotalINR: 1000, shippingAddress: { ...validBody.shippingAddress, addressLine2: undefined, isDefault: false } };
  await handler({ method: 'POST', headers: { authorization: 'Bearer token' }, body }, result.api);
  assert.equal(result.result.code, 200);
  const storedProduct = result.result.body.order.items[0].product;
  for (const field of ['weightGrams', 'originalPriceINR', 'discountPercentage', 'includesBlousePiece', 'isBestseller', 'reviews']) {
    assert.equal(field in storedProduct, false);
  }
  assert.equal(storedProduct.zariType, '');
  assert.equal(storedProduct.blouseLength, '');
  assert.equal(storedProduct.sareeLength, '');
  assert.equal(storedProduct.careInstructions, '');
  assert.equal(storedProduct.occasion, '');
  assert.deepEqual(storedProduct.specifications, []);
  assert.equal(storedProduct.colors.length, 1);
  assert.equal(storedProduct.colors[0].colorName, 'Red');
  assert.equal('swatchLabel' in storedProduct.colors[0], false);
  assert.equal('addressLine2' in result.result.body.order.shippingAddress, false);
  assert.equal(result.result.body.order.shippingAddress.isDefault, false);
  assertFirestoreSafe(result.result.body.order);
});

test('trusted checkout preserves zero and false values while sanitizing the order payload', async () => {
  globalThis.testDatabase = database({
    'products/dress': { data: { ...product, weightGrams: 0, isReadyToShip: false, includesBlousePiece: false }, category: 'Dresses', sku: 'D-1', status: 'active' },
    'settings/admin': { data: { checkoutCharges: [] } },
  });
  const result = response();
  await handler({ method: 'POST', headers: { authorization: 'Bearer token' }, body: { ...validBody, expectedTotalINR: 1000 } }, result.api);
  assert.equal(result.result.code, 200);
  assert.equal(result.result.body.order.items[0].product.weightGrams, 0);
  assert.equal(result.result.body.order.items[0].product.isReadyToShip, false);
  assert.equal(result.result.body.order.items[0].product.includesBlousePiece, false);
  assert.equal(result.result.body.order.items[0].giftPackaging, false);
  assertFirestoreSafe(result.result.body.order);
});

test('trusted checkout rejects overselling without changing stock or creating an order', async () => {
  globalThis.testDatabase = database({
    'products/dress': { data: { ...product, variantInventory: [{ key: 'red::s', colorName: 'Red', size: 'S', stock: 0 }], stockCount: 0 }, category: 'Dresses', sku: 'D-1', status: 'active' },
    'settings/admin': { data: { checkoutCharges: [] } },
  });
  const result = response();
  await handler({ method: 'POST', headers: { authorization: 'Bearer token' }, body: { ...validBody, expectedTotalINR: 1000 } }, result.api);
  assert.equal(result.result.code, 400);
  assert.match(result.result.body.error, /out of stock/);
  assert.equal(globalThis.testDatabase.documents.get('products/dress').data.stockCount, 0);
  assert.equal([...globalThis.testDatabase.documents.keys()].some((key) => key.startsWith('orders/')), false);
});

test('trusted checkout requires review when the authoritative total changes', async () => {
  globalThis.testDatabase = database({
    'products/dress': { data: product, category: 'Dresses', sku: 'D-1', status: 'active' },
    'settings/admin': { data: { checkoutCharges: [{ id: 'delivery', name: 'Delivery', type: 'fixed', value: 75, enabled: true, sortOrder: 0 }] } },
  });
  const result = response();
  await handler({ method: 'POST', headers: { authorization: 'Bearer token' }, body: { ...validBody, expectedTotalINR: 1050 } }, result.api);
  assert.equal(result.result.code, 400);
  assert.match(result.result.body.error, /charges have changed/);
  assert.equal(globalThis.testDatabase.documents.get('products/dress').data.stockCount, 2);
});
