import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

// Compile the real components/repositories with test-only Firebase and context
// adapters. No Firebase connection, browser database or production write occurs.
const outfile = resolve('node_modules/.cache/admin-driven-catalog-tests.mjs');
await build({
  stdin: { contents: `
    import React from 'react';
    import { renderToStaticMarkup } from 'react-dom/server';
    import { ProductDetailPage } from './src/components/product/ProductDetailPage';
    import { ProductOptions } from './src/components/common/ProductOptions';
    import { ProductEditor } from './src/components/admin/ProductEditor';
    import { ProductListingPage } from './src/components/shop/ProductListingPage';
    import { CartPage } from './src/components/cart/CartPage';
    import { OrderConfirmationPage } from './src/components/checkout/OrderConfirmationPage';
    export * from './src/utils/productData';
    export * from './src/utils/checkoutTotals';
    export * from './src/utils/categoryData';
    export { commerceRepository, cartLineKey, normalizeCartItems } from './src/services/commerceRepository';
    export { cmsRepository } from './src/services/cmsRepository';
    export const renderProduct = () => renderToStaticMarkup(<ProductDetailPage />);
    export const renderShop = () => renderToStaticMarkup(<ProductListingPage />);
    export const renderOptions = (product) => renderToStaticMarkup(<ProductOptions product={product} color="" size="" onColor={() => {}} onSize={() => {}} />);
    export const renderEditor = (product = null) => renderToStaticMarkup(<ProductEditor product={product} categories={[]} onCreateCategory={async () => ({})} onSave={async () => {}} onClose={() => {}} />);
    export const renderCart = () => renderToStaticMarkup(<CartPage />);
    export const renderConfirmation = () => renderToStaticMarkup(<OrderConfirmationPage />);
  `, resolveDir: process.cwd(), sourcefile: 'catalog-fixture.tsx', loader: 'tsx' },
  outfile, bundle: true, platform: 'node', format: 'esm', packages: 'external',
  plugins: [{ name: 'test-boundaries', setup(builder) {
    builder.onResolve({ filter: /context\/StoreContext$/ }, () => ({ path: 'store', namespace: 'fixture' }));
    builder.onResolve({ filter: /firebase\/config$/ }, () => ({ path: 'config', namespace: 'fixture' }));
    builder.onResolve({ filter: /^firebase\/firestore$/ }, () => ({ path: 'firestore', namespace: 'fixture' }));
    builder.onLoad({ filter: /.*/, namespace: 'fixture' }, ({ path }) => ({ contents: path === 'store'
      ? 'export const useStore = () => globalThis.catalogStore;'
      : path === 'config' ? 'export const firestore = {}; export const firebaseAuth = null; export const isFirebaseEnabled = false;'
      : `
        export const collection = (_db, name) => name;
        export const collectionGroup = collection;
        export const doc = (_db, collection, id) => ({ path: collection + '/' + id });
        export const query = (...args) => args;
        export const where = (...args) => args;
        export const serverTimestamp = () => 'server-timestamp';
        export const getDocs = async () => { if (globalThis.catalogReadError) throw new Error('offline'); return { docs: globalThis.catalogDocs || [] }; };
        export const getDoc = async () => ({ exists: () => true });
        export const setDoc = async (...args) => { globalThis.catalogWrites.push(args); };
        export const updateDoc = setDoc;
        export const deleteDoc = async () => {};
        export const runTransaction = async (_db, callback) => callback({
          get: async (ref) => { const value = globalThis.catalogTransactionDocs?.[ref.path]; return { id: ref.path.split('/').pop(), exists: () => value !== undefined, data: () => value }; },
          set: (...args) => { globalThis.catalogWrites.push(args); },
          update: (...args) => { globalThis.catalogWrites.push(args); },
          delete: (...args) => { globalThis.catalogWrites.push(args); },
        });
        export const onSnapshot = (_ref, next, error) => {
          globalThis.emitCatalog = (docs) => next({ docs }); globalThis.failCatalog = error;
          return () => { globalThis.catalogUnsubscribed = true; };
        };
      `, loader: 'js' }));
  } }],
});
const api = await import(pathToFileURL(outfile).href);
const product = (extra = {}) => api.normalizeProduct({ id: 'cotton', title: 'Cotton Dress Material', category: 'Dress Material', sku: 'AB-DM-001', fabric: 'Cotton', priceINR: 1200, stockCount: 1, ...extra });
const line = (p, extra = {}) => ({ cartItemId: 'line-1', product: p, selectedColor: '', selectedSize: '', quantity: 1, isCustomTailored: false, tailoringFeeINR: 0, ...extra });
const document = (p, status = 'active') => ({ id: p.id, data: () => ({ data: p, status }) });
const setupStore = (p, extra = {}) => { globalThis.catalogStore = {
  products: p ? [p] : [], selectedProductId: p?.id, catalogStatus: 'ready', customer: {},
  formatPrice: (value) => `INR ${value}`, isInWishlist: () => false,
  cms: { lowStockThreshold: 3, checkoutCharges: [], contact: {}, content: {} }, categories: [], cartCharges: [],
  cartSubtotalINR: 0, cartTailoringTotalINR: 0, cartDiscountINR: 0, cartTotalINR: 0,
  filters: { category: 'All', fabrics: [], occasions: [], sizes: [], colors: [], minPriceINR: 0, maxPriceINR: 150000, searchQuery: '', sortBy: 'featured' },
  ...extra,
}; };

test('legacy products normalize safely without invented attributes or options', () => {
  const p = api.normalizeProduct({ id: 'old', title: 'Jewellery', priceINR: 0, stockCount: 0 });
  assert.equal(p.fabric, ''); assert.deepEqual(p.colors, []); assert.deepEqual(p.availableSizes, []);
  assert.deepEqual(api.productSpecifications(p), []); assert.equal(p.priceINR, 0);
  setupStore(p); const html = api.renderProduct();
  assert.doesNotMatch(html, /Raw Silk|Zari|Select size|Select color|Product description|Specifications/);
  assert.match(html, /Image unavailable/);
});
test('Cotton dress material renders only saved material and Green; no fake defaults', () => {
  const p = product({ colors: [{ colorName: 'Green', images: [], colorHex: '' }] });
  setupStore(p); const html = api.renderProduct();
  for (const expected of ['Cotton', 'Green', 'Only 1 item remaining', 'Dress Material']) assert.ok(html.includes(expected));
  assert.doesNotMatch(html, /Raw Silk|Zari Specification|Pure Tested|Default|Select size|Silk Mark|7-Day|DHL|Delivery is available/);
});
test('options show exactly saved standard and custom values', () => {
  const p = product({ availableSizes: ['S', 'M', 'L', '42'], colors: [{ colorName: 'Red' }, { colorName: 'Blue' }] });
  const html = api.renderOptions(p);
  for (const value of ['S', 'M', 'L', '42', 'Red', 'Blue']) assert.ok(html.includes(`>${value}</button>`));
  assert.doesNotMatch(html, />XS<|>XL<|Default|Unstitched/);
  assert.equal(api.renderOptions(product()), '<div class="space-y-4"></div>');
});
test('material edits/removal and removal of variants are reflected in rendered product', () => {
  setupStore(product({ fabric: 'Linen' })); assert.match(api.renderProduct(), />Linen</);
  setupStore(product({ fabric: '', availableSizes: [], colors: [] }));
  assert.doesNotMatch(api.renderProduct(), /Material<\/th>|Specifications|Select size|Select color/);
});
test('name, price, category, description and optional specifications remain authoritative', () => {
  setupStore(product({ title: 'Silver Pendant', priceINR: 340, category: 'Jewellery', fabric: 'Silver', description: 'Owner supplied description.', specifications: [{ label: 'Finish', value: 'Matte' }] }));
  const html = api.renderProduct();
  for (const value of ['Silver Pendant', 'INR 340', 'Jewellery', 'Owner supplied description.', 'Matte']) assert.ok(html.includes(value));
  assert.doesNotMatch(html, /Saree Length|Blouse Length|Zari Specification/);
});
test('stock changes and configurable low stock threshold render accurately', () => {
  for (const [stockCount, expected] of [[5, 'In stock'], [1, 'Only 1 item remaining'], [0, 'Out of stock']]) {
    setupStore(product({ stockCount })); assert.ok(api.renderProduct().includes(expected));
  }
  assert.equal(api.stockMessage(product({ stockCount: 5 }), 5), 'Only 5 items remaining');
  setupStore(product({ stockCount: 0 })); assert.match(api.renderProduct(), /id="pdp-add-to-cart-btn" disabled/);
});
test('unknown product IDs, inactive documents, empty catalog and read errors never show other products', async () => {
  setupStore(product(), { selectedProductId: 'missing' });
  assert.match(api.renderProduct(), /Product Not Found/); assert.doesNotMatch(api.renderProduct(), /Cotton Dress Material/);
  globalThis.catalogDocs = [document(product(), 'inactive'), document(product({ id: 'archived' }), 'archived')];
  assert.deepEqual(await api.commerceRepository.loadCatalog(), []);
  globalThis.catalogDocs = []; assert.deepEqual(await api.commerceRepository.loadCatalog(), []);
  globalThis.catalogReadError = true;
  await assert.rejects(api.commerceRepository.loadCatalog(), /offline/); globalThis.catalogReadError = false;
  setupStore(null); assert.match(api.renderShop(), /No pieces found/);
  setupStore(null, { catalogStatus: 'error' }); assert.match(api.renderShop(), /currently unavailable/);
});
test('live repository listener replaces catalog on edits, deletion and failure, and unsubscribes', () => {
  let received; let failure;
  const unsubscribe = api.commerceRepository.subscribeToCatalog((value) => { received = value; }, (error) => { failure = error; });
  globalThis.emitCatalog([document(product())]); assert.equal(received[0].fabric, 'Cotton');
  globalThis.emitCatalog([document(product({ fabric: 'Linen', availableSizes: ['M'] }))]); assert.equal(received[0].fabric, 'Linen');
  globalThis.emitCatalog([document(product({ fabric: '', availableSizes: [] }))]); assert.equal(received[0].fabric, '');
  globalThis.emitCatalog([]); assert.deepEqual(received, []);
  globalThis.failCatalog(new Error('offline')); assert.equal(failure.message, 'offline');
  unsubscribe(); assert.equal(globalThis.catalogUnsubscribed, true);
});
test('normalization trims and deduplicates without changing names or overwriting other properties', () => {
  const p = product({ availableSizes: [' S ', '', 's', '42'], colors: [{ colorName: ' Green ', colorHex: '#008000', images: [' a ', ''] }, { colorName: 'green' }], customField: 'preserved', weightGrams: 0 });
  assert.deepEqual(p.availableSizes, ['S', '42']); assert.equal(p.colors.length, 1);
  assert.deepEqual(p.colors[0].images, ['a']); assert.equal(p.customField, 'preserved');
  assert.ok(api.productSpecifications(p).some((row) => row.value === '0 grams'));
});
test('Admin editor starts empty and accepts category-independent optional fields', () => {
  const html = api.renderEditor();
  assert.doesNotMatch(html, /value="Raw Silk"|value="Default"|value="Festive &amp; Puja"|aria-label="Remove S"/);
  for (const label of ['Material / Fabric Composition', 'Available sizes', 'Available colors', 'Additional specifications']) assert.ok(html.includes(label));
  assert.doesNotMatch(html, /<textarea required/);
});
test('Admin save clears optional fields and keeps existing document and variant media', async () => {
  globalThis.catalogWrites = [];
  const p = product({ weightGrams: undefined, originalPriceINR: undefined, availableSizes: [], colors: [{ colorName: 'Blue', colorHex: '#0000ff', images: ['blue.jpg'] }] });
  await api.cmsRepository.saveProduct(p);
  const [ref, saved] = globalThis.catalogWrites[0];
  assert.equal(ref.path, 'products/cotton'); assert.equal(saved.data.weightGrams, null);
  assert.equal(saved.data.originalPriceINR, null); assert.deepEqual(saved.data.availableSizes, []);
  assert.deepEqual(saved.data.colors[0].images, ['blue.jpg']);
  assert.equal(api.productFromDocument('cotton', saved).weightGrams, undefined);
});
test('variant identity preserves duplicate rules and handles no-option products', () => {
  const p = product(); const a = line(p, { selectedColor: 'Red', selectedSize: 'S' });
  assert.equal(api.cartLineKey(a), api.cartLineKey({ ...a, selectedColor: ' red ' }));
  assert.notEqual(api.cartLineKey(a), api.cartLineKey({ ...a, selectedSize: 'M' }));
  assert.notEqual(api.cartLineKey(a), api.cartLineKey({ ...a, selectedColor: 'Blue' }));
  assert.equal(api.normalizeCartItems([a, { ...a, quantity: 2 }])[0].quantity, 3);
  assert.doesNotMatch(api.cartLineKey(line(p)), /Unstitched|Default/);
});
test('legacy stock is shared across variants and stale options/removed products are blocked', () => {
  const p = product({ stockCount: 1, availableSizes: ['S', 'M'] });
  assert.equal(api.cartCatalogIssue([line(p, { selectedSize: 'S' })], [p]), null);
  assert.match(api.cartCatalogIssue([line(p, { selectedSize: 'S' }), line(p, { selectedSize: 'M' })], [p]), /only 1 available/);
  assert.match(api.cartCatalogIssue([line(p, { selectedSize: 'L' })], [p]), /Options/);
  assert.match(api.cartCatalogIssue([line(p)], []), /no longer available/);
});
test('cart refresh uses current product data but leaves historical order snapshots intact', () => {
  const old = product({ priceINR: 100, title: 'Old', stockCount: 5 });
  const original = [line(old)];
  const updated = api.refreshCartProducts(original, [product({ priceINR: 200, title: 'New' })]);
  assert.equal(updated[0].product.priceINR, 200); assert.equal(updated[0].product.title, 'New');
  assert.equal(original[0].product.priceINR, 100);
});
test('selected size/color survive cart serialization', async () => {
  globalThis.catalogWrites = [];
  const items = [line(product(), { selectedSize: '42', selectedColor: 'Blue' })];
  await api.commerceRepository.saveCart('customer-test', items);
  assert.equal(globalThis.catalogWrites[0][1].items[0].selectedSize, '42');
  const saved = globalThis.catalogWrites[0][1].items[0];
  assert.equal(saved.selectedColor, 'Blue'); assert.equal(saved.selectedSize, '42');
  assert.equal(api.variantSummary(saved), 'Color: Blue · Size: 42');
});

test('variant inventory derives total stock and enforces the exact color and size combination', () => {
  const p = product({ colors: [{ colorName: 'Red' }, { colorName: 'Blue' }], availableSizes: ['S', 'M'], variantInventory: [
    { key: 'ignored', colorName: 'Red', size: 'S', stock: 2 },
    { key: 'ignored', colorName: 'Red', size: 'M', stock: 0 },
    { key: 'ignored', colorName: 'Blue', size: 'S', stock: 1 },
    { key: 'ignored', colorName: 'Blue', size: 'M', stock: 3 },
  ] });
  assert.equal(p.stockCount, 6);
  assert.equal(api.selectedVariantStock(p, 'Red', 'M'), 0);
  assert.equal(api.isVariantAvailable(p, 'Blue', 'M', 3), true);
  assert.match(api.cartCatalogIssue([line(p, { selectedColor: 'Red', selectedSize: 'M' })], [p]), /out of stock/);
  assert.equal(api.cartCatalogIssue([line(p, { selectedColor: 'Blue', selectedSize: 'M', quantity: 3 })], [p]), null);
  const updated = api.withDeductedStock(p, [{ colorName: 'Blue', size: 'M', quantity: 2 }]);
  assert.equal(api.selectedVariantStock(updated, 'Blue', 'M'), 1);
  assert.equal(updated.stockCount, 4);
});

test('variant matrix synchronization preserves matching rows and initializes new combinations at zero', () => {
  const p = product({ colors: [{ colorName: 'Red' }], availableSizes: ['S'], variantInventory: [{ key: '', colorName: 'Red', size: 'S', stock: 4 }] });
  const rows = api.syncVariantInventory({ ...p, availableSizes: ['S', 'M'] });
  assert.deepEqual(rows.map((row) => [row.colorName, row.size, row.stock]), [['Red', 'S', 4], ['Red', 'M', 0]]);
});

test('checkout charges are centralized, ordered, disabled safely, and captured with calculated amounts', () => {
  const p = product({ priceINR: 1000, stockCount: 5 });
  const items = [line(p, { quantity: 2, isCustomTailored: true, tailoringFeeINR: 100 })];
  const coupon = { code: 'SAVE10', discountType: 'percentage', discountValue: 10, minCartValueINR: 0, description: '', isActive: true, expiryDate: '2099-01-01' };
  const totals = api.calculateCheckoutTotals(items, coupon, [
    { id: 'delivery', name: 'Delivery', type: 'fixed', value: 50, enabled: true, sortOrder: 2 },
    { id: 'gst', name: 'GST', type: 'percentage', value: 5, enabled: true, sortOrder: 1 },
    { id: 'disabled', name: 'Disabled', type: 'fixed', value: 999, enabled: false, sortOrder: 0 },
  ]);
  assert.equal(totals.subtotalINR, 2000); assert.equal(totals.couponDiscountINR, 200);
  assert.equal(totals.percentageChargeBaseINR, 1800); assert.equal(totals.charges[0].amountINR, 90);
  assert.equal(totals.totalINR, 2140); assert.deepEqual(totals.charges.map((charge) => charge.name), ['GST', 'Delivery']);
});

test('category slugs normalize and duplicate category names and routes are rejected', () => {
  assert.equal(api.categorySlug('  Bridal & Festive Wear  '), 'bridal-festive-wear');
  const existing = [api.normalizeCategory({ id: 'bridal', name: 'Bridal', slug: 'bridal', isActive: true })];
  assert.match(api.categoryValidationError(api.normalizeCategory({ id: 'other', name: 'bridal', slug: 'other' }), existing), /name already exists/);
  assert.match(api.categoryValidationError(api.normalizeCategory({ id: 'other', name: 'Other', slug: 'bridal' }), existing), /slug is already/);
});
test('per-color images take priority and absent media uses a neutral placeholder', () => {
  const p = product({ images: ['main.jpg'], colors: [{ colorName: 'Blue', images: ['blue.jpg'] }] });
  assert.deepEqual(api.productImages(p, 'Blue'), ['blue.jpg']); assert.deepEqual(api.productImages(p), ['main.jpg']);
  setupStore(product()); assert.match(api.renderProduct(), /Image unavailable/);
});

test('optional numeric values are valid at zero and duplicate specification concepts are rejected', () => {
  assert.equal(api.productValidationError(product({ originalPriceINR: 0, discountPercentage: 0, weightGrams: 0 })), null);
  assert.match(api.productValidationError({ ...product(), stockCount: 1.5 }), /whole-number/);
  assert.match(api.productValidationError(product({ discountPercentage: 101 })), /100%/);
  assert.match(api.productValidationError(product({ specifications: [{ label: 'Fabric Composition', value: 'Cotton' }] })), /dedicated field/);
});

test('cart renders variant labels only when selected and order confirmation retains them', () => {
  const p = product();
  setupStore(p, { cart: [line(p)], cartIssue: null });
  assert.doesNotMatch(api.renderCart(), /Color:|Size:|Default|Unstitched/);
  const item = line(p, { selectedColor: 'Blue', selectedSize: '42' });
  setupStore(p, { cart: [item], cartIssue: null });
  assert.match(api.renderCart(), /Color: Blue/); assert.match(api.renderCart(), /Size: 42/);
  globalThis.catalogStore.currentOrder = { id: 'test', orderNumber: 'TEST', items: [item], shippingAddress: { fullName: 'Test' }, createdAt: new Date().toISOString(), paymentMethod: 'cod', paymentStatus: 'Pending', orderStatus: 'Order Placed' };
  globalThis.catalogStore.orders = [];
  const html = api.renderConfirmation(); assert.match(html, /Color: Blue/); assert.match(html, /Size: 42/);
});
