import { AsyncLocalStorage } from 'node:async_hooks';
import assert from 'node:assert/strict';
import { PaymentService } from '../server/payments/service.js';
import { parseCheckout } from '../server/payments/validation.js';
import type { PaymentProvider, ProviderPayment, ProviderOrder, ProviderRefund } from '../server/payments/provider.js';
import type { Firestore } from 'firebase-admin/firestore';
export function fixture(stock = 2) {
  const docs = new Map<string, any>(); let tail = Promise.resolve(); const context = new AsyncLocalStorage<boolean>();
  const clone = (v: any) => v === undefined ? v : structuredClone(v);
  const ref = (path: string): any => ({ path, id: path.split('/').at(-1), collection: (name: string) => ({ doc: (id: string) => ref(`${path}/${name}/${id}`) }), get: async () => snap(path), update: async (v: any) => update(path, v) });
  const snap = (path: string): any => ({ id: path.split('/').at(-1), ref: ref(path), exists: docs.has(path), data: () => clone(docs.get(path)) });
  const update = (path: string, data: any) => { const out = clone(docs.get(path)); assert.ok(out); for (const [k, v] of Object.entries(data)) { const keys = k.split('.'); let target = out; for (const part of keys.slice(0, -1)) target = target[part]; target[keys.at(-1)!] = clone(v); } docs.set(path, out); };
  const db = { collection: (name: string) => ({ doc: (id: string) => ref(`${name}/${id}`) }), runTransaction: async (fn: any) => {
    const previous = tail; let unlock!: () => void; tail = new Promise<void>(r => { unlock = r; }); await previous;
    const writes: (() => void)[] = []; let writing = false;
    try { const result = await context.run(true, () => fn({ get: async (r: any) => { assert.equal(writing, false); return snap(r.path); }, getAll: async (...refs: any[]) => { assert.equal(writing, false); return refs.map(r => snap(r.path)); }, set: (r: any, v: any) => { writing = true; writes.push(() => docs.set(r.path, clone(v))); }, update: (r: any, v: any) => { if (failCartWrites && r.path.startsWith('carts/')) throw Error('fixture cart failure'); writing = true; writes.push(() => update(r.path, v)); } })); writes.forEach(w => w()); return result; } finally { unlock(); }
  } } as unknown as Firestore;
  const product = { id: 'dress', title: 'Dress', sku: 'D1', priceINR: 1499, stockCount: stock, colors: [{ colorName: 'Red', images: [], colorHex: '' }], availableSizes: ['S'], variantInventory: [{ key: 'red::s', colorName: 'Red', size: 'S', stock }], customStitchingAvailable: false, customStitchingFeeINR: 0, isActive: true };
  docs.set('products/dress', { data: product, status: 'active', inventoryVersion: 0 });
  docs.set('settings/admin', { data: { checkoutCharges: [] } });
  const orders: ProviderOrder[] = []; let calls = 0; let refundCalls = 0; const refunds: ProviderRefund[] = []; const keys = new Map<string, ProviderRefund>(); let refundTimeout = false; let failCartWrites = false;
  let evidence: ProviderPayment = { id: 'pay_test1', order_id: 'order_test1', amount: 149900, currency: 'INR', status: 'captured', captured: true, amount_refunded: 0 };
  const provider: PaymentProvider = { keyId: 'mock-public-id', createOrder: async (amount, receipt, checkoutId) => { assert.notEqual(context.getStore(), true); calls++; const order = { id: 'order_test1', amount, receipt, currency: 'INR', notes: { checkoutId } }; orders.push(order); return order; }, findOrders: async () => { assert.notEqual(context.getStore(), true); return orders; }, payment: async () => { assert.notEqual(context.getStore(), true); return evidence; }, order: async () => orders[0], payments: async () => evidence.status === 'created' ? [] : [evidence], refunds: async () => refunds, createRefund: async (paymentId, amount, key) => { assert.notEqual(context.getStore(), true); refundCalls++; if (!keys.has(key)) { const r = { id: 'rfnd_test'+keys.size, payment_id: paymentId, amount, status: 'pending', receipt: key }; refunds.push(r); keys.set(key,r); } if (refundTimeout) throw Error('fixture ambiguous timeout'); return keys.get(key)!; } };
  let clock = 1_800_000_000_000;
  const service = new PaymentService(db, provider, () => clock);
  const request = parseCheckout({ intentId: 'intent-1234567890', items: [{ productId: 'dress', selectedColor: 'Red', selectedSize: 'S', quantity: 1 }], shippingAddress: { fullName: 'Test Customer', phone: '9999999999', email: 'test@example.com', addressLine1: 'Test Street', city: 'Hyderabad', state: 'Telangana', pincode: '500001', country: 'India' } });
  return { docs, db, service, request, provider, orders, refunds, get refundCalls() { return refundCalls; }, set refundTimeout(v: boolean) { refundTimeout=v; }, set failCartWrites(v: boolean) { failCartWrites=v; }, get calls() { return calls; }, advance: (n = 900001) => { clock += n; }, evidence: (v: Partial<ProviderPayment>) => { evidence = { ...evidence, ...v }; } };
}
