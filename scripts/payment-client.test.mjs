import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
const outfile = resolve('node_modules/.cache/payment-client-tests.mjs');
await build({ absWorkingDir: process.cwd(), stdin: { resolveDir: process.cwd(), contents: `export * from './src/services/paymentClient'; import React from 'react'; import {renderToStaticMarkup} from 'react-dom/server'; import {OrderConfirmationPage} from './src/components/checkout/OrderConfirmationPage'; export const confirmation=()=>renderToStaticMarkup(React.createElement(OrderConfirmationPage));` }, outfile, bundle: true, format: 'esm', platform: 'node', packages: 'external', plugins: [{ name: 'payment-client-fixtures', setup(b) {
  b.onResolve({ filter: /firebase\/config$/ }, () => ({ path: 'firebase', namespace: 'fixture' }));
  b.onResolve({ filter: /context\/StoreContext$/ }, () => ({ path: 'context', namespace: 'fixture' }));
  b.onLoad({ filter: /.*/, namespace: 'fixture' }, ({ path }) => ({ contents: path === 'firebase' ? `export const firebaseAuth={currentUser:{uid:'client-user',getIdToken:async()=> 'mock-token'}};` : `export const useStore=()=>globalThis.paymentStore;` }));
} }] });
const { stableCheckout, openPayment, confirmedPayment, confirmation } = await import(pathToFileURL(outfile).href);
const storage = new Map(); globalThis.localStorage = { getItem: k => storage.get(k) || null, setItem: (k,v) => storage.set(k,v) };
Object.defineProperty(globalThis, 'navigator', { value: { locks: { request: async (_key, fn) => fn() } }, configurable: true });
const order = { id: 'pay-business', orderNumber: 'AB-TEST', createdAt: new Date().toISOString(), shippingAddress: { fullName: 'Test', email: 'test@example.com', phone: '9999999999' }, items: [], charges: [], paymentMethod: 'razorpay', paymentProvider: 'razorpay', paymentStatus: 'PAYMENT_PENDING', timeline: [], totalINR: 100 };
const response = { order, checkout: { keyId: 'public-fixture', orderId: 'order_fixture', amount: 10000, currency: 'INR' } };
let options;
globalThis.window = { Razorpay: class { constructor(value) { options = value; } open() {} } };
test('checkout intent survives repeated calls and refresh-equivalent state', async () => {
  const request = { items: [], shippingAddress: {}, couponCode: null };
  const [a,b] = await Promise.all([stableCheckout('user',request), stableCheckout('user',request)]);
  assert.equal(a.intentId,b.intentId); assert.equal((await stableCheckout('user',JSON.parse(JSON.stringify(request)))).intentId,a.intentId);
  assert.notEqual((await stableCheckout('other',request)).intentId,a.intentId);
});
test('Checkout dismissal never fabricates failure or payment success', async () => {
  const pending = openPayment(response); await new Promise(r => setImmediate(r)); options.modal.ondismiss();
  const result = await pending; assert.equal(result.paymentStatus,'PAYMENT_PENDING'); assert.equal(confirmedPayment(result),false);
});
test('browser callback waits for trusted verification; dismissal cannot race it', async () => {
  let release; globalThis.fetch = async () => new Promise(resolve => { release=()=>resolve({ok:true,json:async()=>({order:{...order,paymentStatus:'PAID'}})}); });
  const pending = openPayment(response); await new Promise(r=>setImmediate(r));
  const handler = options.handler({razorpay_order_id:'order_fixture',razorpay_payment_id:'pay_fixture',razorpay_signature:'fixture-only'});
  await new Promise(r=>setImmediate(r)); options.modal.ondismiss(); release(); await handler;
  assert.equal((await pending).paymentStatus,'PAID');
});
test('confirmation distinguishes pending online payments and historical COD', () => {
  globalThis.paymentStore={currentOrder:order,formatPrice:v=>String(v),navigate:()=>{}};
  assert.match(confirmation(), /Confirming your payment/); assert.doesNotMatch(confirmation(), /Payment received/);
  globalThis.paymentStore.currentOrder={...order,paymentMethod:'cod',paymentProvider:undefined,paymentStatus:'Pending'};
  assert.match(confirmation(), /historical Cash on Delivery/);
});
