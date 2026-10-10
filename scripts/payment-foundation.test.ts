import { AsyncLocalStorage } from 'node:async_hooks';
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { PaymentService } from '../server/payments/service.js';
import { parseCheckout, paise, checkoutId, fingerprint } from '../server/payments/validation.js';
import { validSignature, razorpayProvider, type PaymentProvider, type ProviderPayment, type ProviderOrder } from '../server/payments/provider.js';
import type { Firestore } from 'firebase-admin/firestore';
import { rawBody, rateLimit } from '../server/payments/http.js';
import { Readable, PassThrough } from 'node:stream';

// Serializable in-memory transactions with staged writes, rollback and a
// reads-before-writes assertion. Provider calls assert they are outside them.
function fixture(stock = 2) {
  const docs = new Map<string, any>(); let tail = Promise.resolve(); const context = new AsyncLocalStorage<boolean>();
  const clone = (v: any) => v === undefined ? v : structuredClone(v);
  const ref = (path: string): any => ({ path, id: path.split('/').at(-1), get: async () => snap(path), update: async (v: any) => update(path, v) });
  const snap = (path: string): any => ({ id: path.split('/').at(-1), ref: ref(path), exists: docs.has(path), data: () => clone(docs.get(path)) });
  const update = (path: string, data: any) => { const out = clone(docs.get(path)); assert.ok(out); for (const [k, v] of Object.entries(data)) { const keys = k.split('.'); let target = out; for (const part of keys.slice(0, -1)) target = target[part]; target[keys.at(-1)!] = clone(v); } docs.set(path, out); };
  const db = { collection: (name: string) => ({ doc: (id: string) => ref(`${name}/${id}`) }), runTransaction: async (fn: any) => {
    const previous = tail; let unlock!: () => void; tail = new Promise<void>(r => { unlock = r; }); await previous;
    const writes: (() => void)[] = []; let writing = false;
    try { const result = await context.run(true, () => fn({ get: async (r: any) => { assert.equal(writing, false); return snap(r.path); }, getAll: async (...refs: any[]) => { assert.equal(writing, false); return refs.map(r => snap(r.path)); }, set: (r: any, v: any) => { writing = true; writes.push(() => docs.set(r.path, clone(v))); }, update: (r: any, v: any) => { writing = true; writes.push(() => update(r.path, v)); } })); writes.forEach(w => w()); return result; } finally { unlock(); }
  } } as unknown as Firestore;
  const product = { id: 'dress', title: 'Dress', sku: 'D1', priceINR: 1499, stockCount: stock, colors: [{ colorName: 'Red', images: [], colorHex: '' }], availableSizes: ['S'], variantInventory: [{ key: 'red::s', colorName: 'Red', size: 'S', stock }], customStitchingAvailable: false, customStitchingFeeINR: 0, isActive: true };
  docs.set('products/dress', { data: product, status: 'active', inventoryVersion: 0 });
  docs.set('settings/admin', { data: { checkoutCharges: [] } });
  const orders: ProviderOrder[] = []; let calls = 0;
  let evidence: ProviderPayment = { id: 'pay_test1', order_id: 'order_test1', amount: 149900, currency: 'INR', status: 'captured', captured: true, amount_refunded: 0 };
  const provider: PaymentProvider = { keyId: 'mock-public-id', createOrder: async (amount, receipt, checkoutId) => { assert.notEqual(context.getStore(), true); calls++; const order = { id: 'order_test1', amount, receipt, currency: 'INR', notes: { checkoutId } }; orders.push(order); return order; }, findOrders: async () => { assert.notEqual(context.getStore(), true); return orders; }, payment: async () => { assert.notEqual(context.getStore(), true); return evidence; }, order: async () => orders[0], payments: async () => evidence.status === 'created' ? [] : [evidence], refunds: async () => [] };
  let clock = 1_800_000_000_000;
  const service = new PaymentService(db, provider, () => clock);
  const request = parseCheckout({ intentId: 'intent-1234567890', items: [{ productId: 'dress', selectedColor: 'Red', selectedSize: 'S', quantity: 1 }], shippingAddress: { fullName: 'Test Customer', phone: '9999999999', email: 'test@example.com', addressLine1: 'Test Street', city: 'Hyderabad', state: 'Telangana', pincode: '500001', country: 'India' } });
  return { docs, db, service, request, provider, orders, get calls() { return calls; }, advance: (n = 900001) => { clock += n; }, evidence: (v: Partial<ProviderPayment>) => { evidence = { ...evidence, ...v }; } };
}
test('strict request schema rejects browser money, malformed and oversized inputs', () => {
  const f = fixture(); assert.equal(paise(1499), 149900); assert.equal(paise(10.25), 1025);
  for (const v of [-1, NaN, Infinity, 1.001, '1499']) assert.throws(() => paise(v));
  assert.throws(() => parseCheckout({ ...f.request, totalINR: 1 }));
  assert.throws(() => parseCheckout({ ...f.request, items: [{ ...f.request.items[0], priceINR: 1 }] }));
  assert.throws(() => parseCheckout({ ...f.request, items: [{ ...f.request.items[0], productId: '../users' }] }));
  assert.throws(() => parseCheckout({ ...f.request, items: [{ ...f.request.items[0], quantity: 0 }] }));
  assert.throws(() => parseCheckout({ ...f.request, shippingAddress: { ...f.request.shippingAddress, addressLine1: 'x'.repeat(201) } }));
});
test('trusted amount, full UID identity, duplicate create and request conflicts', async () => {
  const f = fixture(); const a = await f.service.create('customer-full-one', f.request); const b = await f.service.create('customer-full-one', f.request);
  assert.equal(a.order.amountPaise, 149900); assert.equal(a.order.id, b.order.id); assert.equal(f.calls, 1);
  assert.equal(f.docs.get('products/dress').data.stockCount, 1);
  assert.notEqual(checkoutId('same-prefix-1-foo', f.request.intentId), checkoutId('same-prefix-1-bar', f.request.intentId));
  await assert.rejects(f.service.create('customer-full-one', { ...f.request, shippingAddress: { ...f.request.shippingAddress, city: 'Other' } }), /INTENT_CONFLICT/);
  await assert.rejects(f.service.owned('another-user', a.order.id), /ORDER_NOT_FOUND/);
});
test('invalid products/options/stock and malformed authoritative finances fail closed', async () => {
  for (const mutation of ['missing', 'inactive', 'negative', 'fractional', 'nonfinite', 'stock', 'variant', 'charges', 'settings']) {
    const f = fixture(); const p = f.docs.get('products/dress');
    if (mutation === 'missing') f.docs.delete('products/dress');
    if (mutation === 'inactive') p.status = 'inactive';
    if (mutation === 'negative') p.data.priceINR = -1;
    if (mutation === 'fractional') p.data.priceINR = 1.001;
    if (mutation === 'nonfinite') p.data.priceINR = Infinity;
    if (mutation === 'stock') { p.data.variantInventory[0].stock = 0; p.data.stockCount = 0; }
    if (mutation === 'variant') f.request.items[0].selectedSize = 'XL';
    if (mutation === 'charges') f.docs.get('settings/admin').data.checkoutCharges = [{ id: 'tax', name: 'Tax', value: -1, type: 'percentage', enabled: true, sortOrder: 0 }];
    if (mutation === 'settings') f.docs.delete('settings/admin');
    await assert.rejects(f.service.create('uid', f.request)); assert.equal(f.calls, 0); assert.equal([...f.docs.keys()].some(k => k.startsWith('orders/')), false);
  }
});
test('coupon validation rejects malformed expiry, eligibility and manipulated data', async () => {
  const f = fixture(); f.request.couponCode = 'SAVE';
  f.docs.set('coupons/SAVE', { status: 'active', data: { code: 'SAVE', isActive: true, discountType: 'fixed', discountValue: 100, minCartValueINR: 0, expiryDate: 'invalid' } });
  await assert.rejects(f.service.create('uid', f.request), /COUPON/);
  f.docs.get('coupons/SAVE').data.expiryDate = '2099-01-01';
  const r = await f.service.create('uid', f.request); assert.equal(r.order.amountPaise, 139900);
});
test('concurrent last-item attempts serialize; duplicate same intent reserves once', async () => {
  const f = fixture(1); const results = await Promise.allSettled([f.service.create('one', f.request), f.service.create('two', f.request)]);
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 1); assert.equal(f.docs.get('products/dress').data.stockCount, 0);
  const g = fixture(); const duplicates = await Promise.allSettled([g.service.create('one', g.request), g.service.create('one', g.request)]);
  assert.equal(g.calls, 1); assert.equal(g.docs.get('products/dress').data.stockCount, 1); assert.ok(duplicates.some(r => r.status === 'fulfilled'));
});
test('expiry releases once; retry renews same business/provider order', async () => {
  const f = fixture(); f.evidence({ status: 'created', captured: false }); const r = await f.service.create('uid', f.request);
  assert.equal(await f.service.release(r.order.id), false); f.advance(); await f.service.reconcile(r.order.id);
  assert.equal(f.docs.get('products/dress').data.stockCount, 2); assert.equal(await f.service.release(r.order.id), false);
  const retry = await f.service.create('uid', f.request); assert.equal(retry.order.id, r.order.id); assert.equal(f.calls, 1); assert.equal(f.docs.get('products/dress').data.stockCount, 1);
});
test('captured evidence consumes once, deduplicates events and never releases paid inventory', async () => {
  const f = fixture(); const r = await f.service.create('uid', f.request);
  await f.service.syncPayment(r.order.id, 'pay_test1', { id: 'event1', hash: 'hash1' });
  await f.service.syncPayment(r.order.id, 'pay_test1', { id: 'event1', hash: 'hash1' });
  await f.service.syncPayment(r.order.id, 'pay_test1');
  assert.equal(f.docs.get(`orders/${r.order.id}`).data.timeline.length, 1); assert.equal(f.docs.get(`inventoryReservations/${r.order.id}`).state, 'CONSUMED');
  f.advance(); assert.equal(await f.service.release(r.order.id), false); assert.equal(f.docs.get('products/dress').data.stockCount, 1);
  f.evidence({ status: 'failed', captured: false }); await f.service.syncPayment(r.order.id, 'pay_test1', { id: 'event2', hash: 'hash2' });
  assert.equal(f.docs.get(`orders/${r.order.id}`).data.paymentStatus, 'PAID');
});
test('mapping/amount/currency mismatch cannot confirm payment', async () => {
  for (const patch of [{ order_id: 'order_other' }, { amount: 1 }, { currency: 'USD' }]) {
    const f = fixture(); const r = await f.service.create('uid', f.request); f.evidence(patch);
    await assert.rejects(f.service.syncPayment(r.order.id, 'pay_test1'), /MISMATCH/); assert.equal(f.docs.get(`inventoryReservations/${r.order.id}`).state, 'RESERVED');
  }
});
test('late capture is recorded truthfully with fulfilment review; refund evidence is monotonic', async () => {
  const f = fixture(); const r = await f.service.create('uid', f.request); f.evidence({ status: 'created', captured: false }); f.advance(); await f.service.reconcile(r.order.id);
  f.evidence({ status: 'captured', captured: true }); const paid = await f.service.syncPayment(r.order.id, 'pay_test1');
  assert.equal(paid.paymentStatus, 'PAID'); assert.equal(paid.paymentReviewRequired, true); assert.equal(f.docs.get('products/dress').data.stockCount, 2);
  f.evidence({ amount_refunded: 100 }); assert.equal((await f.service.syncPayment(r.order.id, 'pay_test1')).paymentStatus, 'PARTIALLY_REFUNDED');
  f.evidence({ amount_refunded: 149900, status: 'refunded' }); assert.equal((await f.service.syncPayment(r.order.id, 'pay_test1')).paymentStatus, 'REFUNDED');
  f.evidence({ amount_refunded: 0, status: 'captured' }); assert.equal((await f.service.syncPayment(r.order.id, 'pay_test1')).paymentStatus, 'REFUNDED');
});
test('signature validates exact bytes, not reserialized JSON; missing credentials fail safely', async () => {
  const raw = Buffer.from('{ "event": "payment.captured" }'); const secret = 'test-fixture-only'; const signature = createHmac('sha256', secret).update(raw).digest('hex');
  assert.equal(validSignature(raw, signature, secret), true); assert.equal(validSignature(JSON.stringify(JSON.parse(raw.toString())), signature, secret), false); assert.equal(validSignature(raw, 'wrong', secret), false);
  assert.throws(() => razorpayProvider({}));
  const stream = Readable.from([raw]) as any; stream.body = undefined; assert.deepEqual(await rawBody(stream), raw);
  await assert.rejects(rawBody({ body: { event: 'payment.captured' } } as any), /RAW_BODY_REQUIRED/);
});
test('Vercel lazy body getter is never invoked; restored data/end stream retains exact signed bytes', async () => {
  const raw = Buffer.from('{ \"event\": \"payment.captured\", \"note\": \"unicode \u20b9\" }');
  const restored = new PassThrough(); const req = new PassThrough() as any;
  const originalOn = req.on.bind(req);
  req.on = (name: string, listener: (...args: any[]) => void) => ['data', 'end'].includes(name) ? restored.on(name, listener) : originalOn(name, listener);
  Object.defineProperty(req, 'body', { get() { throw new Error('Lazy JSON getter must not execute'); } });
  const reading = rawBody(req); restored.end(raw);
  const result = await reading; assert.deepEqual(result, raw);
  const signature = createHmac('sha256', 'fixture-secret').update(raw).digest('hex');
  assert.equal(validSignature(result, signature, 'fixture-secret'), true);
  assert.equal(validSignature(Buffer.from(JSON.stringify(JSON.parse(raw.toString()))), signature, 'fixture-secret'), false);
});

test('raw body rejects parsed strings/objects, oversized bytes and interrupted streams', async () => {
  for (const body of [{event:'payment.captured'}, '{"event":"payment.captured"}']) await assert.rejects(rawBody({body} as any), /RAW_BODY_REQUIRED/);
  await assert.rejects(rawBody({body:Buffer.alloc(262145)} as any), /REQUEST_TOO_LARGE/);
  await assert.rejects(rawBody(Readable.from([Buffer.alloc(262145)]) as any), /REQUEST_TOO_LARGE/);
  const req = new PassThrough(); const reading = rawBody(req as any); req.emit('aborted');
  await assert.rejects(reading, /RAW_BODY_REQUIRED/); assert.equal(req.listenerCount('data'), 0);
});

test('rate limit is durable and allows normal retry volume', async () => {
  const f = fixture(); for (let i = 0; i < 10; i++) await rateLimit(f.db, 'uid', 'create', 100000);
  await assert.rejects(rateLimit(f.db, 'uid', 'create', 100000), /RATE_LIMITED/); await rateLimit(f.db, 'uid', 'create', 160000);
});
test('provider uncertainty never triggers another external order creation', async () => {
  const f = fixture(); f.provider.createOrder = async () => { throw new Error('timeout'); };
  await assert.rejects(f.service.create('uid', f.request), /UNCERTAIN/); f.advance(31000);
  await assert.rejects(f.service.create('uid', f.request), /REQUIRES_REVIEW/); assert.equal(f.docs.get('products/dress').data.stockCount, 1);
});
test('refund pending and processed refunds synchronize without browser authority', async () => {
  const f = fixture(); const r = await f.service.create('uid', f.request);
  f.provider.refunds = async () => [{ id: 'rfnd_fixture', payment_id: 'pay_test1', amount: 100, status: 'pending' }];
  assert.equal((await f.service.syncPayment(r.order.id, 'pay_test1')).paymentStatus, 'REFUND_PENDING');
  f.provider.refunds = async () => [{ id: 'rfnd_fixture', payment_id: 'pay_test1', amount: 100, status: 'processed' }];
  assert.equal((await f.service.syncPayment(r.order.id, 'pay_test1')).refundedAmountPaise, 100);
  assert.equal((await f.service.syncPayment(r.order.id, 'pay_test1')).paymentStatus, 'PARTIALLY_REFUNDED');
});
test('event identity conflict and authorized payment are handled safely', async () => {
  const f = fixture(); const r = await f.service.create('uid', f.request); f.evidence({ status: 'authorized', captured: false });
  assert.equal((await f.service.syncPayment(r.order.id, 'pay_test1', { id: 'event', hash: 'original' })).paymentStatus, 'AUTHORIZED');
  await assert.rejects(f.service.syncPayment(r.order.id, 'pay_test1', { id: 'event', hash: 'modified' }), /EVENT_CONFLICT/);
  assert.equal(f.docs.get(`inventoryReservations/${r.order.id}`).state, 'RESERVED');
});
test('authenticated verification binds owner, stored mapping and signature before provider update', async () => {
  const f = fixture(); const r = await f.service.create('uid', f.request); const secret = 'test-fixture-only';
  const signature = createHmac('sha256', secret).update('order_test1|pay_test1').digest('hex');
  await assert.rejects(f.service.verify('other', r.order.id, 'order_test1', 'pay_test1', signature, secret), /ORDER_NOT_FOUND/);
  await assert.rejects(f.service.verify('uid', r.order.id, 'order_wrong', 'pay_test1', signature, secret), /MAPPING/);
  await assert.rejects(f.service.verify('uid', r.order.id, 'order_test1', 'pay_test1', 'invalid', secret), /SIGNATURE/);
  assert.equal((await f.service.verify('uid', r.order.id, 'order_test1', 'pay_test1', signature, secret)).paymentStatus, 'PAID');
  assert.equal((await f.service.verify('uid', r.order.id, 'order_test1', 'pay_test1', signature, secret)).timeline.length, 1);
});


test('uncaptured created/failed/authorized evidence never marks PAID or consumes reservations', async () => {
  for (const status of ['created', 'failed', 'authorized']) {
    const f = fixture(); const r = await f.service.create('uid', f.request);
    f.evidence({ status, captured: false });
    const next = await f.service.syncPayment(r.order.id, 'pay_test1');
    assert.notEqual(next.paymentStatus, 'PAID'); assert.equal(next.paidAt, undefined);
    assert.equal(f.docs.get(`inventoryReservations/${r.order.id}`).state, 'RESERVED');
    assert.equal(f.docs.has(`inventoryMovements/${r.order.id}-consume`), false);
  }
});
test('concurrent duplicate events and delayed capture after failure consume once', async () => {
  const f = fixture(); const r = await f.service.create('uid', f.request);
  f.evidence({ status: 'failed', captured: false });
  await f.service.syncPayment(r.order.id, 'pay_test1', { id: 'failure', hash: 'failure-hash' });
  f.evidence({ status: 'captured', captured: true });
  await Promise.all([f.service.syncPayment(r.order.id, 'pay_test1', { id: 'capture', hash: 'capture-hash' }), f.service.syncPayment(r.order.id, 'pay_test1', { id: 'capture', hash: 'capture-hash' })]);
  const paid = f.docs.get(`orders/${r.order.id}`).data;
  assert.equal(paid.paymentStatus, 'PAID'); assert.equal(paid.timeline.length, 1);
  assert.equal(f.docs.get('products/dress').data.stockCount, 1);
  assert.equal(f.docs.get(`inventoryReservations/${r.order.id}`).state, 'CONSUMED');
});


test('raw-body stalled streams time out and remove listeners instead of hanging verification',async t=>{
 t.mock.timers.enable({apis:['setTimeout']});const req=new PassThrough();const work=rawBody(req as any);const rejected=assert.rejects(work,/RAW_BODY_REQUIRED/);t.mock.timers.tick(15000);await rejected;assert.equal(req.listenerCount('data'),0);t.mock.timers.reset();
});
