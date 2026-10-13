import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { createRequire } from 'node:module';
import { fixture } from './payment-fixture.js';
import { CancellationService } from '../server/orders/cancellation.js';
import { rateLimit, jsonBody, failure } from '../server/payments/http.js';
import { LIVE_REFUND_EXECUTION_ENABLED } from '../server/orders/refundPolicy.js';

async function order(captured = false) {
  const f = fixture(5); f.evidence({ status: captured ? 'captured' : 'created', captured });
  const { order: created } = await f.service.create('uid', f.request);
  if (captured) await f.service.syncPayment(created.id, 'pay_test1');
  const service = new CancellationService(f.db, f.provider, false, () => 1_800_000_000_000);
  return { f, id: created.id, service };
}

test('HIGH regression: capture between uncaptured quote and approval aborts all cancellation writes', async () => {
  const { f, id, service } = await order(); await service.request('uid', id, 'Other');
  const quote = service.quote.bind(service);
  service.quote = async id => { const old = await quote(id); f.evidence({ captured: true, status: 'captured' }); await f.service.syncPayment(id, 'pay_test1'); return old; };
  await assert.rejects(service.review('admin', id, true, 'Approved'), /REFUND_QUOTE_CHANGED/);
  const current = f.docs.get(`orders/${id}`).data;
  assert.equal(current.cancellationRequest.status, 'REQUESTED'); assert.equal(current.orderStatus, 'Order Placed');
  assert.equal(current.refund, undefined); assert.equal(f.docs.get('products/dress').data.stockCount, 4);
  assert.equal(f.docs.get(`inventoryReservations/${id}`).state, 'CONSUMED'); assert.equal(f.refundCalls, 0);
});

test('HIGH regression: authorization appearing after an unpaid quote also requires requoting', async () => {
  const { f, id, service } = await order(); await service.request('uid', id, 'Other');
  const quote = service.quote.bind(service);
  service.quote = async id => { const old = await quote(id); f.evidence({ captured: false, status: 'authorized' }); await f.service.syncPayment(id, 'pay_test1'); return old; };
  await assert.rejects(service.review('admin', id, true, 'Approved'), /REFUND_QUOTE_CHANGED/);
  assert.equal(f.docs.get(`inventoryReservations/${id}`).state, 'RESERVED'); assert.equal(f.refundCalls, 0);
});

test('changed captured refund balance aborts approval atomically', async () => {
  const { f, id, service } = await order(true); await service.request('uid', id, 'Other');
  const quote = service.quote.bind(service);
  service.quote = async id => { const old = await quote(id); f.evidence({ amount_refunded: 100 }); await f.service.syncPayment(id, 'pay_test1'); return old; };
  await assert.rejects(service.review('admin', id, true, 'Approved'), /REFUND_QUOTE_CHANGED/);
  assert.equal(f.docs.get('products/dress').data.stockCount, 4); assert.equal(f.refundCalls, 0);
});

test('forged callback, foreign owner and mismatched provider order cannot confirm payment', async () => {
  const { f, id } = await order();
  await assert.rejects(f.service.verify('uid', id, 'order_test1', 'pay_test1', '0'.repeat(64), 'fixture-secret'), /SIGNATURE_INVALID/);
  await assert.rejects(f.service.verify('other', id, 'order_test1', 'pay_test1', '0'.repeat(64), 'fixture-secret'), /ORDER_NOT_FOUND/);
  const signature = createHmac('sha256', 'fixture-secret').update('order_wrong|pay_test1').digest('hex');
  await assert.rejects(f.service.verify('uid', id, 'order_wrong', 'pay_test1', signature, 'fixture-secret'), /PROVIDER_MAPPING_INVALID/);
  assert.equal(f.docs.get(`orders/${id}`).data.paidAt, undefined);
});

test('valid callback signature alone cannot promote uncaptured provider evidence', async () => {
  const { f, id } = await order(); const signature = createHmac('sha256', 'fixture-secret').update('order_test1|pay_test1').digest('hex');
  const result = await f.service.verify('uid', id, 'order_test1', 'pay_test1', signature, 'fixture-secret');
  assert.equal(result.paymentStatus, 'PAYMENT_PENDING'); assert.equal(result.paidAt, undefined);
});

test('wrong amount, currency, payment ID and order ID leave payment and reservation untouched', async () => {
  for (const evidence of [{ amount: 1 }, { currency: 'USD' }, { id: 'pay_foreign' }, { order_id: 'order_foreign' }]) {
    const { f, id } = await order(); f.evidence({ captured: true, status: 'captured', ...evidence });
    await assert.rejects(f.service.syncPayment(id, 'pay_test1'), /PAYMENT_EVIDENCE_MISMATCH/);
    assert.equal(f.docs.get(`inventoryReservations/${id}`).state, 'RESERVED');
  }
});

test('second captured payment cannot replace a paid order; delayed failed events cannot demote it', async () => {
  const { f, id } = await order(true); f.evidence({ id: 'pay_second' });
  await assert.rejects(f.service.syncPayment(id, 'pay_second'), /MULTIPLE_CAPTURED_PAYMENTS/);
  f.evidence({ id: 'pay_test1', captured: false, status: 'failed' });
  const result = await f.service.syncPayment(id, 'pay_test1'); assert.equal(result.paymentStatus, 'PAID'); assert.equal(result.razorpayPaymentId, 'pay_test1');
});

test('per-user create limits are atomic and recover next minute without affecting another user', async () => {
  const f = fixture(); const results = await Promise.allSettled(Array.from({ length: 11 }, () => rateLimit(f.db, 'uid', 'create', 120000)));
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 10);
  assert.match(String((results.find(r => r.status === 'rejected') as PromiseRejectedResult).reason), /RATE_LIMITED/);
  await rateLimit(f.db, 'other', 'create', 120000); await rateLimit(f.db, 'uid', 'create', 180000);
});

test('request limits reject malformed JSON, oversized UTF-8 and incorrect content type', () => {
  for (const req of [{ headers: { 'content-type': 'application/json' }, body: '{' }, { headers: { 'content-type': 'text/plain' }, body: '{}' }, { headers: { 'content-type': 'application/json' }, body: JSON.stringify({ x: '₹'.repeat(12000) }) }]) assert.throws(() => jsonBody(req as any));
});

test('failure responses and logs do not echo provider credentials or private request errors', () => {
  const messages: unknown[] = []; const old = console.error; console.error = (...args) => { messages.push(args); };
  let body: unknown; let status = 0;
  try { failure({ setHeader() {}, status(code) { status = code; return this; }, json(v) { body = v; } }, Error('secret-fixture-card-number-and-token')); }
  finally { console.error = old; }
  assert.equal(status, 503); assert.equal(JSON.stringify({ messages, body }).includes('secret-fixture'), false);
});

// Regression tests for the audited findings; independent intents remain an explicit policy limit.
test('M1: malformed refund entities preserve all last trusted state', async () => {
  const base={id:'rfnd_valid',payment_id:'pay_test1',amount:100,status:'processed',currency:'INR'};
  const cases=[[base,{...base}], [{...base,id:'bad'}], [{...base,currency:'USD'}], [{...base,currency:undefined}], [{...base,status:'invented'}], [{...base,status:'created'}], [{...base,amount:-1}], [{...base,amount:1.5}], [{...base,amount:0}], [{...base,payment_id:'pay_foreign'}], [{...base,amount:100000},{...base,id:'rfnd_second',amount:100000}]];
  for(const rows of cases){const {f,id}=await order(true);const before=structuredClone([...f.docs]);f.refunds.push(...rows as any);
    await assert.rejects(f.service.syncPayment(id,'pay_test1'),/REFUND_EVIDENCE_INVALID/);assert.deepEqual([...f.docs],before);
  }
});

 test('M2: corrupt raw expiry inventory fails atomically without normalization',async()=>{
  for(const mutate of [(p:any)=>p.variantInventory[0].key='invalid',(p:any)=>p.stockCount=NaN,(p:any)=>p.variantInventory[0].stock=-1,(p:any)=>p.variantInventory.push({...p.variantInventory[0]}),(p:any)=>p.stockCount=100,(p:any)=>p.variantInventory=false]){
    const {f,id}=await order();mutate(f.docs.get('products/dress').data);f.advance();const before=structuredClone([...f.docs]);
    await assert.rejects(f.service.release(id),/RESERVATION_INVENTORY_CHANGED/);assert.deepEqual([...f.docs],before);
  }
});

test('M3: independent repeat purchase intents remain distinct and are not automatically merged', async () => {
  const { f } = await order(); f.provider.createOrder = async (amount, receipt, checkoutId) => ({ id: 'order_second', amount, currency: 'INR', receipt, notes: { checkoutId } });
  const second = await f.service.create('uid', { ...f.request, intentId: 'intent-second-1234567890' });
  assert.equal(second.order.razorpayOrderId, 'order_second'); assert.equal(f.docs.get('products/dress').data.stockCount, 3);
});

test('M5: invalid or future approval/retry timestamps require manual review without refund POST', async () => {
  for(const patch of [{approvedAt:'invalid-date'}, {approvedAt:undefined}, {updatedAt:'invalid-date'}, {updatedAt:'2099-01-01T00:00:00.000Z'}, {approvedAt:'2027-02-31T00:00:00.000Z'}]) {
    const {f,id,service}=await order(true);await service.request('uid',id,'Other');await service.review('admin',id,true,'Approved');
    Object.assign(f.docs.get(`orders/${id}`).data.refund,{state:'UNKNOWN',...patch});
    await new CancellationService(f.db,f.provider,true,()=>1_800_000_000_000).recoverRefund(id);
    assert.equal(f.refundCalls,0);assert.equal(f.docs.get(`orders/${id}`).data.refund.state,'MANUAL_REVIEW');
  }
});

test('LIVE refund gate remains disabled throughout the audit', () => assert.equal(LIVE_REFUND_EXECUTION_ENABLED, false));

test('M5: timestamp corruption after provider inspection is rechecked in the initiation transaction', async () => {
  const {f,id,service}=await order(true);await service.request('uid',id,'Other');await service.review('admin',id,true,'Approved');
  const enabled=new CancellationService(f.db,f.provider,true,()=>1_800_000_000_000);
  const inspect=enabled.quote.bind(enabled);
  enabled.quote=async id=>{const quote=await inspect(id);f.docs.get(`orders/${id}`).data.refund.updatedAt='invalid-date';return quote;};
  await enabled.execute(id);assert.equal(f.refundCalls,0);assert.equal(f.docs.get(`orders/${id}`).data.refund.state,'MANUAL_REVIEW');
});

test('patched proxy trust rejects an arbitrary IPv4 attacker for a malformed mapped IPv6 subnet', () => {
  const proxyAddress = createRequire(import.meta.url)('proxy-addr');
  assert.equal(proxyAddress.compile('::ffff:10.0.0.0/8')('203.0.113.42'), false);
  assert.equal(proxyAddress.compile('10.0.0.0/8')('10.1.2.3'), true);
  assert.equal(proxyAddress.compile('10.0.0.0/8')('203.0.113.42'), false);
});
