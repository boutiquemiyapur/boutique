import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const outfile = resolve('node_modules/.cache/inventory-management-tests.mjs');
await build({
  stdin: { contents: `
    import React from 'react';
    import { renderToStaticMarkup } from 'react-dom/server';
    import { InventoryManager } from './src/components/admin/InventoryManager';
    export * from './src/utils/inventoryData';
    export * from './src/utils/productData';
    export { cmsRepository } from './src/services/cmsRepository';
    export const renderInventory = (props) => renderToStaticMarkup(<InventoryManager {...props} />);
  `, resolveDir: process.cwd(), sourcefile: 'inventory-fixture.tsx', loader: 'tsx' },
  outfile, bundle: true, platform: 'node', format: 'esm', packages: 'external',
  plugins: [{ name: 'inventory-boundaries', setup(builder) {
    builder.onResolve({ filter: /firebase\/config$/ }, () => ({ path: 'config', namespace: 'fixture' }));
    builder.onResolve({ filter: /^firebase\/firestore$/ }, () => ({ path: 'firestore', namespace: 'fixture' }));
    builder.onLoad({ filter: /.*/, namespace: 'fixture' }, ({ path }) => ({ loader: 'js', contents: path === 'config'
      ? 'export const firestore={}; export const firebaseAuth=null;'
      : `
        const snap = (ref, value) => ({ id: ref.path.split('/').pop(), ref, exists: () => value !== undefined, data: () => value });
        const pathOf = (collection) => typeof collection === 'string' ? collection : collection.path;
        const applyFields = (current, fields) => { const next = structuredClone(current || {}); for (const [key, value] of Object.entries(fields)) { const parts = key.split('.'); let target = next; while (parts.length > 1) { const part = parts.shift(); target[part] ||= {}; target = target[part]; } target[parts[0]] = value; } return next; };
        export const collection = (_db, name) => ({ path: name });
        export const collectionGroup = collection;
        export const doc = (_db, collection, id) => ({ path: pathOf(collection) + '/' + id });
        export const serverTimestamp = () => 'server-time';
        export const getDoc = async (ref) => snap(ref, globalThis.inventoryDb.get(ref.path));
        export const getDocs = async (ref) => ({ docs: [...globalThis.inventoryDb.entries()].filter(([key]) => key.startsWith(ref.path + '/') && !key.slice(ref.path.length + 1).includes('/')).map(([key, value]) => snap({ path: key }, value)) });
        export const setDoc = async (ref, value) => globalThis.inventoryDb.set(ref.path, value);
        export const deleteDoc = async (ref) => globalThis.inventoryDb.delete(ref.path);
        export const onSnapshot = () => () => {};
        export const runTransaction = async (_db, callback) => callback({
          get: async (ref) => snap(ref, globalThis.inventoryDb.get(ref.path)),
          set: (ref, value, options) => globalThis.inventoryDb.set(ref.path, options?.merge ? { ...(globalThis.inventoryDb.get(ref.path) || {}), ...value } : value),
          update: (ref, value) => globalThis.inventoryDb.set(ref.path, applyFields(globalThis.inventoryDb.get(ref.path), value)),
          delete: (ref) => globalThis.inventoryDb.delete(ref.path),
        });
      ` }));
  } }],
});

const api = await import(pathToFileURL(outfile).href);
const product = (id, extra = {}) => api.normalizeProduct({ id, title: `Product ${id}`, sku: `SKU-${id}`, category: 'Sarees', priceINR: 1000, stockCount: 10, images: [`${id}.jpg`], isActive: true, ...extra });
const sizeProduct = product('size', { colors: [], availableSizes: ['S', 'M'], variantInventory: [{ key: '::s', colorName: '', size: 'S', stock: 2 }, { key: '::m', colorName: '', size: 'M', stock: 1 }] });
const colorProduct = product('color', { colors: [{ colorName: 'Red', colorHex: '#ff0000', images: ['red.jpg'] }, { colorName: 'Blue', colorHex: '#0000ff', images: [] }], availableSizes: [], variantInventory: [{ key: 'red::', colorName: 'Red', size: '', stock: 4 }, { key: 'blue::', colorName: 'Blue', size: '', stock: 0 }] });
const matrixProduct = product('matrix', { colors: [{ colorName: 'Red', colorHex: '#ff0000', images: ['red.jpg'] }, { colorName: 'Blue', colorHex: '#0000ff', images: [] }], availableSizes: ['S', 'M'], variantInventory: [{ key: 'red::s', colorName: 'Red', size: 'S', stock: 5 }, { key: 'red::m', colorName: 'Red', size: 'M', stock: 2 }, { key: 'blue::s', colorName: 'Blue', size: 'S', stock: 0 }, { key: 'blue::m', colorName: 'Blue', size: 'M', stock: 7 }] });
const props = (products, selected = null) => ({ products, categories: [{ id: 'sarees', name: 'Sarees', slug: 'sarees', isActive: true, sortOrder: 0 }], threshold: 3, versions: Object.fromEntries(products.map((item) => [item.id, 2])), loading: false, loadError: null, initialProductId: selected, onSave: async () => 3, onRefresh: async () => null, onEditProduct: () => {} });

test('inventory mode selects simple, size, color, and color by size editors', () => {
  assert.equal(api.inventoryMode(product('simple')), 'simple');
  assert.equal(api.inventoryMode(sizeProduct), 'size');
  assert.equal(api.inventoryMode(colorProduct), 'color');
  assert.equal(api.inventoryMode(matrixProduct), 'matrix');
});

test('derived totals and low or zero variant classifications are accurate', () => {
  assert.deepEqual(api.inventoryStats(product('healthy', { stockCount: 9 }), 3), { total: 9, variantCount: 0, lowVariants: 0, zeroVariants: 0, status: 'healthy' });
  assert.equal(api.inventoryStats(product('low', { stockCount: 2 }), 3).status, 'attention');
  assert.equal(api.inventoryStats(product('out', { stockCount: 0 }), 3).status, 'out');
  assert.deepEqual(api.inventoryStats(matrixProduct, 3), { total: 14, variantCount: 4, lowVariants: 1, zeroVariants: 1, status: 'attention' });
});

test('search prioritizes an exact SKU before name and partial SKU matches', () => {
  const exact = product('exact', { title: 'Other Saree', sku: 'NEW-2' });
  const title = product('title', { title: 'NEW-2 Wedding Saree', sku: 'ZZZ' });
  const partial = product('partial', { title: 'Another', sku: 'NEW-20' });
  const result = api.inventoryProducts([title, partial, exact], { query: 'new-2', category: 'all', stock: 'all', visibility: 'all', sort: 'name' }, 3);
  assert.deepEqual(result.map((item) => item.id), ['exact', 'partial', 'title']);
});

test('category, stock, visibility filters and useful sorting work together', () => {
  const hidden = product('hidden', { category: 'Jewellery', stockCount: 0, isActive: false });
  const low = product('low', { category: 'Sarees', stockCount: 2 });
  const healthy = product('healthy', { category: 'Sarees', stockCount: 20 });
  assert.deepEqual(api.inventoryProducts([healthy, hidden, low], { query: '', category: 'Sarees', stock: 'attention', visibility: 'active', sort: 'stock' }, 3).map((item) => item.id), ['low']);
  assert.deepEqual(api.inventoryProducts([healthy, hidden, low], { query: '', category: 'all', stock: 'all', visibility: 'all', sort: 'attention' }, 3).map((item) => item.id), ['hidden', 'low', 'healthy']);
  assert.deepEqual(api.inventoryCategories([hidden, low], [{ name: 'Sarees', sortOrder: 0 }, { name: 'Dresses', sortOrder: 1 }]), ['Sarees', 'Dresses', 'Jewellery']);
});

test('image-led browser renders identity, summary controls, filters and responsive cards', () => {
  const html = api.renderInventory(props([product('one', { title: 'New Lady Saree', sku: 'G032-3' }), product('two', { title: 'New Lady Saree 2', sku: '2A93WJ' })]));
  for (const value of ['New Lady Saree', 'SKU: G032-3', 'Sarees', 'All products', 'Needs attention', 'Fully out', 'Search product name or SKU', 'Active and hidden']) assert.ok(html.includes(value));
  assert.match(html, /sm:grid-cols-2/);
  assert.match(html, /loading="lazy"/);
});

test('dedicated simple, size, color, and matrix views render responsive stock controls', () => {
  const simple = api.renderInventory(props([product('simple')], 'simple'));
  assert.match(simple, /Shared product stock/); assert.match(simple, /aria-label="Shared product stock"/); assert.match(simple, /Edit full product details/);
  const size = api.renderInventory(props([sizeProduct], 'size'));
  assert.match(size, /Stock by size/); assert.match(size, /Stock for all colors S/);
  const color = api.renderInventory(props([colorProduct], 'color'));
  assert.match(color, /Stock by color/); assert.match(color, /Stock for Red all sizes/);
  const matrix = api.renderInventory(props([matrixProduct, product('next')], 'matrix'));
  assert.match(matrix, /Stock by color and size/); assert.match(matrix, /hidden overflow-x-auto md:block/); assert.match(matrix, /md:hidden/); assert.match(matrix, /<th[^>]*>Total<\/th>/); assert.match(matrix, /Save changes/); assert.match(matrix, /Save &amp; next/);
});

const firestoreDocument = (p, version = 0) => ({ data: p, category: p.category, sku: p.sku, status: p.isActive === false ? 'inactive' : 'active', inventoryVersion: version, untouched: 'keep-me' });

test('inventory save updates only stock fields and rejects stale simple-stock writes', async () => {
  const simple = product('simple', { stockCount: 8 });
  globalThis.inventoryDb = new Map([['products/simple', firestoreDocument(simple, 4)]]);
  await assert.rejects(api.cmsRepository.saveInventory({ productId: 'simple', expectedVersion: 3, stockCount: 12 }), api.StaleInventoryError);
  assert.equal(globalThis.inventoryDb.get('products/simple').data.stockCount, 8);
  const version = await api.cmsRepository.saveInventory({ productId: 'simple', expectedVersion: 4, stockCount: 12 });
  const saved = globalThis.inventoryDb.get('products/simple');
  assert.equal(version, 5); assert.equal(saved.inventoryVersion, 5); assert.equal(saved.data.stockCount, 12);
  assert.equal(saved.data.title, simple.title); assert.equal(saved.untouched, 'keep-me'); assert.equal(saved.data.variantInventory, undefined);
});

test('full product editing also rejects an inventory revision changed by an order', async () => {
  const simple = product('simple', { stockCount: 8 });
  globalThis.inventoryDb = new Map([['products/simple', firestoreDocument(simple, 4)]]);
  await assert.rejects(api.cmsRepository.saveProduct({ ...simple, description: 'Stale editor copy' }, 3), api.StaleInventoryError);
  assert.equal(globalThis.inventoryDb.get('products/simple').data.description, '');
  assert.equal(globalThis.inventoryDb.get('products/simple').data.stockCount, 8);
});

test('variant inventory save derives the total and rejects a stale variant shape', async () => {
  globalThis.inventoryDb = new Map([['products/matrix', firestoreDocument(matrixProduct, 2)]]);
  const changed = matrixProduct.variantInventory.map((row, index) => ({ ...row, stock: index + 1 }));
  const version = await api.cmsRepository.saveInventory({ productId: 'matrix', expectedVersion: 2, stockCount: 999, variantInventory: changed });
  const saved = globalThis.inventoryDb.get('products/matrix');
  assert.equal(version, 3); assert.equal(saved.data.stockCount, 10); assert.deepEqual(saved.data.variantInventory.map((row) => row.stock), [1, 2, 3, 4]);
  await assert.rejects(api.cmsRepository.saveInventory({ productId: 'matrix', expectedVersion: 3, stockCount: 1, variantInventory: changed.slice(1) }), api.StaleInventoryError);
});

test('size-only and color-only inventory edits preserve their variant identities', async () => {
  for (const current of [sizeProduct, colorProduct]) {
    globalThis.inventoryDb = new Map([[`products/${current.id}`, firestoreDocument(current, 1)]]);
    const changed = current.variantInventory.map((row, index) => ({ ...row, stock: index + 6 }));
    await api.cmsRepository.saveInventory({ productId: current.id, expectedVersion: 1, stockCount: 0, variantInventory: changed });
    const saved = globalThis.inventoryDb.get(`products/${current.id}`).data;
    assert.deepEqual(saved.variantInventory.map((row) => [row.colorName, row.size]), changed.map((row) => [row.colorName, row.size]));
    assert.equal(saved.stockCount, changed.reduce((sum, row) => sum + row.stock, 0));
  }
});

test('SKU uniqueness rejects existing and reserved duplicates and creates an atomic reservation', async () => {
  const existing = product('existing', { title: 'Existing Saree', sku: 'AB-100' });
  const duplicate = product('duplicate', { sku: ' ab-100 ' });
  globalThis.inventoryDb = new Map([['products/existing', firestoreDocument(existing, 1)]]);
  await assert.rejects(api.cmsRepository.saveProduct(duplicate), /already used by Existing Saree/);

  globalThis.inventoryDb = new Map([['productSkus/ab-200', { productId: 'another', sku: 'AB-200' }]]);
  await assert.rejects(api.cmsRepository.saveProduct(product('new', { sku: 'AB-200' })), /already assigned/);

  const unique = product('unique', { sku: 'AB-300' });
  globalThis.inventoryDb = new Map();
  await api.cmsRepository.saveProduct(unique);
  assert.equal(globalThis.inventoryDb.get('products/unique').inventoryVersion, 1);
  assert.deepEqual(globalThis.inventoryDb.get('productSkus/ab-300').productId, 'unique');
});
