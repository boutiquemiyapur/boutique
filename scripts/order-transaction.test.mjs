import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const outfile = resolve('node_modules/.cache/order-transaction-tests.mjs');
await build({
  entryPoints: ['api/orders/create.ts'],
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
        : 'export const getFirestore=()=>globalThis.testDatabase; export const FieldValue={serverTimestamp:()=>"server-time"};' }));
  } }],
});
const { default: handler } = await import(pathToFileURL(outfile).href);

const response = () => {
  const result = { code: 0, body: null };
  return { result, api: { status(code) { result.code = code; return { json(value) { result.body = value; } }; } } };
};
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
        update: (ref, value) => pending.push(() => documents.set(ref.path, { ...documents.get(ref.path), ...value })),
        set: (ref, value) => pending.push(() => documents.set(ref.path, value)),
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
    'products/dress': { data: product, category: 'Dresses', sku: 'D-1', status: 'active' },
    'settings/admin': { data: { checkoutCharges: [{ id: 'gst', name: 'GST', type: 'percentage', value: 5, enabled: true, sortOrder: 0 }, { id: 'delivery', name: 'Delivery', type: 'fixed', value: 50, enabled: true, sortOrder: 1 }] } },
  });
  const first = response();
  await handler({ method: 'POST', headers: { authorization: 'Bearer token' }, body: validBody }, first.api);
  assert.equal(first.result.code, 200);
  assert.equal(first.result.body.order.totalINR, 1100);
  assert.deepEqual(first.result.body.order.charges.map((charge) => [charge.name, charge.amountINR]), [['GST', 50], ['Delivery', 50]]);
  assert.equal(globalThis.testDatabase.documents.get('products/dress').data.variantInventory[0].stock, 1);
  assert.equal(globalThis.testDatabase.documents.get('products/dress').data.stockCount, 1);

  const retry = response();
  await handler({ method: 'POST', headers: { authorization: 'Bearer token' }, body: validBody }, retry.api);
  assert.equal(retry.result.code, 200);
  assert.equal(retry.result.body.order.id, first.result.body.order.id);
  assert.equal(globalThis.testDatabase.documents.get('products/dress').data.stockCount, 1);
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
