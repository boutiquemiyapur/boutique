import test from 'node:test';
import assert from 'node:assert/strict';
import { fixture } from './payment-fixture.js';
import { CancellationService } from '../server/orders/cancellation.js';
import { fulfilOrder } from '../server/orders/fulfil.js';
import { purchasedSnapshot, subtractPurchased } from '../server/payments/cartCleanup.js';
import { LIVE_REFUND_EXECUTION_ENABLED } from '../server/orders/refundPolicy.js';
import { preferPaymentOrder } from '../src/utils/paymentState.js';

const cartLine = (id = 'original', quantity = 2, color = 'Red', size = 'S') => ({ cartItemId: id, product: { id: 'dress' }, selectedColor: color, selectedSize: size, isCustomTailored: false, quantity });
async function checkout(captured = true) {
  const f = fixture(5); f.docs.set('carts/uid', { ownerId: 'uid', items: [cartLine(), { ...cartLine('other'), product: { id: 'other' } }] });
  f.evidence({ status: captured ? 'captured' : 'created', captured });
  const r = await f.service.create('uid', f.request);
  if (captured) await f.service.syncPayment(r.order.id, 'pay_test1');
  return { f, id: r.order.id, service: new CancellationService(f.db, f.provider, true, () => 1_800_000_000_000) };
}
test('trusted capture subtracts purchased quantity only, preserves variants and increased quantities, and replays once', async () => {
  const f = fixture(5); f.docs.set('carts/uid', { ownerId: 'uid', items: [cartLine(), cartLine('blue', 1, 'Blue')] });
  const r = await f.service.create('uid', f.request);
  f.docs.get('carts/uid').items[0].quantity = 4;
  const captured = await f.service.syncPayment(r.order.id, 'pay_test1', { id: 'evt', hash: 'hash' });
  assert.equal(captured.cartCleanupStatus, 'DONE'); assert.equal(f.docs.get('carts/uid').lastPurchasedOrderId, r.order.id); assert.deepEqual(f.docs.get('carts/uid').items.map((l: any) => l.quantity), [3, 1]);
  f.docs.get('carts/uid').items.push({ ...cartLine('later'), product: { id: 'later' } });
  await f.service.syncPayment(r.order.id, 'pay_test1', { id: 'evt', hash: 'hash' }); await f.service.reconcile(r.order.id);
  assert.equal(f.docs.get('carts/uid').items[0].quantity, 3); assert.equal(f.docs.get('carts/uid').items.length, 3);
});
test('one/multiple purchased lines and exact size/color/tailoring identity preserve unmatched lines', () => {
  const raw = [cartLine(), cartLine('blue', 2, 'Blue'), cartLine('large', 2, 'Red', 'L'), { ...cartLine('tailored'), isCustomTailored: true }];
  const purchased = purchasedSnapshot(raw, raw.slice(0, 2).map(l => ({ ...l, quantity: 1 })) as any);
  assert.equal(purchased.length, 2); assert.deepEqual(subtractPurchased(raw, purchased)!.map((l: any) => l.quantity), [1, 1, 2, 2]);
  const capped = purchasedSnapshot([cartLine('small', 1)], [cartLine('request', 3)] as any);
  assert.equal(capped[0].quantity, 3); assert.equal(capped[0].cartQuantity, 1);
  assert.equal((subtractPurchased([cartLine('small', 4)], capped)![0] as any).quantity, 3);
});
test('newly re-added line identities, ambiguous duplicates and malformed Cart are never guessed', async () => {
  const f = fixture(); f.docs.set('carts/uid', { ownerId: 'uid', items: [cartLine()] });
  const r = await f.service.create('uid', f.request); f.docs.get('carts/uid').items = [cartLine('readded')];
  await f.service.syncPayment(r.order.id, 'pay_test1'); assert.equal(f.docs.get('carts/uid').items[0].quantity, 2);
  assert.deepEqual(purchasedSnapshot([cartLine(), cartLine()], [cartLine()] as any), []);
  assert.equal(subtractPurchased({}, []), null);
});
test('Cart cleanup failure keeps paid evidence and pending receipt; reconciliation retries once', async () => {
  const f = fixture(); f.docs.set('carts/uid', { ownerId: 'uid', items: [cartLine()] }); const r = await f.service.create('uid', f.request);
  f.failCartWrites = true; const paid = await f.service.syncPayment(r.order.id, 'pay_test1');
  assert.equal(paid.paymentStatus, 'PAID'); assert.equal(paid.cartCleanupStatus, 'PENDING'); assert.equal(f.docs.get('carts/uid').items[0].quantity, 2);
  f.failCartWrites = false; await f.service.reconcile(r.order.id); await f.service.reconcile(r.order.id);
  assert.equal(f.docs.get('carts/uid').items[0].quantity, 1); assert.equal(f.docs.get(`checkoutRequests/${r.order.id}`).cartCleanup.state, 'DONE'); assert.equal(f.calls, 1);
});
test('historical requests and historical paid orders never clear later selections', async () => {
  for (const oldPaid of [false, true, 'status']) {
    const f = fixture(); f.docs.set('carts/uid', { ownerId: 'uid', items: [cartLine()] }); const r = await f.service.create('uid', f.request);
    if (oldPaid === true) f.docs.get(`orders/${r.order.id}`).data.paidAt = new Date().toISOString();
    else if (oldPaid === 'status') f.docs.get(`orders/${r.order.id}`).data.paymentStatus = 'PAID';
    else { delete f.docs.get(`checkoutRequests/${r.order.id}`).cartSnapshot; delete f.docs.get(`checkoutRequests/${r.order.id}`).cartCleanup; }
    await f.service.syncPayment(r.order.id, 'pay_test1'); assert.equal(f.docs.get('carts/uid').items[0].quantity, 2);
  }
});
test('uncaptured failed/authorized/pending outcomes preserve Cart and another account', async () => {
  for (const status of ['created', 'failed', 'authorized']) {
    const { f, id } = await checkout(false); f.evidence({ status, captured: false }); f.docs.set('carts/other', { ownerId: 'other', items: [cartLine('foreign')] });
    await f.service.syncPayment(id, 'pay_test1'); assert.equal(f.docs.get('carts/uid').items[0].quantity, 2); assert.equal(f.docs.get('carts/other').items[0].quantity, 2);
  }
});
test('duplicate capture and reconciliation race preserve Cart receipt and stock consumption', async () => {
  const { f, id } = await checkout(false); f.evidence({ captured: true, status: 'captured' });
  await Promise.all([f.service.syncPayment(id, 'pay_test1', { id: 'race', hash: 'same' }), f.service.reconcile(id)]);
  assert.equal(f.docs.get('carts/uid').items[0].quantity, 1); assert.equal(f.docs.get('products/dress').data.stockCount, 4);
});
test('customer requests have ownership checks, immutable reason and no refund or stock effect', async () => {
  const { f, id, service } = await checkout(); await assert.rejects(service.request('other', id, 'Other'), /ORDER_NOT_FOUND/);
  await assert.rejects(service.request('uid', id, 'forged'), /INVALID_CANCELLATION_REASON/);
  await service.request('uid', id, 'Other'); await service.request('uid', id, 'Ordered by mistake');
  assert.equal(f.docs.get(`orders/${id}`).data.cancellationRequest.reason, 'Other'); assert.equal(f.refundCalls, 0); assert.equal(f.docs.get('products/dress').data.stockCount, 4);
  await assert.rejects(service.execute(id), /ADMIN_APPROVAL_REQUIRED/); await assert.rejects(fulfilOrder(f.db, 'admin', id, 'Processing'), /CANCELLATION_APPROVAL_REQUIRED/);
});
test('only Order Placed/Confirmed allow requests; advanced and refunded orders reject', async () => {
  for (const status of ['Processing', 'Artisan Tailoring', 'Quality Inspection', 'Ready for Dispatch', 'Dispatched', 'Delivered', 'Cancelled']) {
    const { f, id, service } = await checkout(); f.docs.get(`orders/${id}`).data.orderStatus = status;
    await assert.rejects(service.request('uid', id, 'Other'), /CANCELLATION_INELIGIBLE/);
  }
});
test('admin rejection preserves paid order/stock and unlocks normal fulfilment', async () => {
  const { f, id, service } = await checkout(); await service.request('uid', id, 'Other');
  const rejected = await service.review('admin', id, false, 'Already arranged'); assert.equal(rejected.cancellationRequest!.status, 'REJECTED');
  await fulfilOrder(f.db, 'admin', id, 'Processing'); assert.equal(f.refundCalls, 0); assert.equal(f.docs.get('products/dress').data.stockCount, 4);
  await assert.rejects(service.review('admin', id, true, ''), /DECISION_CONFLICT/);
});
test('approval restores consumed inventory exactly once and initiates one pending refund', async () => {
  const { f, id, service } = await checkout(); await service.request('uid', id, 'Other');
  await Promise.all([service.review('admin-one', id, true, 'Approved'), service.review('admin-two', id, true, 'Approved')]);
  const order = f.docs.get(`orders/${id}`).data;
  assert.equal(order.orderStatus, 'Cancelled'); assert.equal(order.refund.state, 'PENDING'); assert.equal(order.refund.amountPaise, 149900);
  assert.equal(f.refundCalls, 1); assert.equal(f.docs.get('products/dress').data.stockCount, 5); assert.equal(f.docs.get(`inventoryReservations/${id}`).state, 'RESTORED');
  await service.review('admin', id, true, 'Replay'); assert.equal(f.docs.get('products/dress').data.stockCount, 5);
  await assert.rejects(fulfilOrder(f.db, 'admin', id, 'Delivered'), /CANCELLATION_APPROVAL_REQUIRED/);
});
test('LIVE refund execution stays disabled while approvals record a durable hold', async () => {
  assert.equal(LIVE_REFUND_EXECUTION_ENABLED, false);
  const { f, id } = await checkout(); const service = new CancellationService(f.db, f.provider, false);
  await service.request('uid', id, 'Other'); const order = await service.review('admin', id, true, 'Approved');
  assert.equal(order.refund!.state, 'AWAITING_ENABLEMENT'); assert.equal(f.refundCalls, 0); await assert.rejects(service.execute(id), /LIVE_REFUNDS_DISABLED/);
});
test('uncaptured cancellation releases reservation once and late capture holds review without cleanup/refund', async () => {
  const { f, id, service } = await checkout(false); await service.request('uid', id, 'Other'); await service.review('admin', id, true, 'Approved');
  assert.equal(f.docs.get('carts/uid').checkoutGeneration, `cancel-${id}`); assert.equal(f.docs.get(`inventoryReservations/${id}`).state, 'RELEASED'); assert.equal(f.docs.get('products/dress').data.stockCount, 5); assert.equal(f.refundCalls, 0);
  f.evidence({ captured: true, status: 'captured' }); const late = await f.service.syncPayment(id, 'pay_test1');
  assert.equal(late.paymentStatus, 'PAID'); assert.equal(late.paymentReviewRequired, true); assert.equal(f.docs.get('carts/uid').items[0].quantity, 2);
  await assert.rejects(f.service.create('uid', f.request), /ORDER_CANCELLED/);
  await service.retryApprovedRefund('admin', id); assert.equal(f.refundCalls, 1);
});
test('unknown refund response recovers existing provider reference without issuing another request', async () => {
  const { f, id, service } = await checkout(); await service.request('uid', id, 'Other'); f.refundTimeout = true;
  const order = await service.review('admin', id, true, 'Approved'); assert.equal(order.refund!.state, 'UNKNOWN');
  f.refundTimeout = false; await service.recoverRefund(id); assert.equal(f.refundCalls, 1); assert.equal(f.docs.get(`orders/${id}`).data.refund.state, 'PENDING');
});
test('refund processed/failed events use provider evidence, not request acceptance', async () => {
  for (const status of ['processed', 'failed']) {
    const { f, id, service } = await checkout(); await service.request('uid', id, 'Other'); await service.review('admin', id, true, 'Approved');
    f.refunds[0].status = status; await service.syncRefund(id); await f.service.syncPayment(id, 'pay_test1');
    const order = f.docs.get(`orders/${id}`).data; assert.equal(order.refund.state, status === 'processed' ? 'PROCESSED' : 'FAILED');
    assert.equal(order.paymentStatus, status === 'processed' ? 'REFUNDED' : 'PAID'); assert.equal(f.docs.get('products/dress').data.stockCount, 5);
  }
});
test('partial prior refund subtracts only authoritative remaining amount', async () => {
  const { f, id, service } = await checkout(); f.refunds.push({ id: 'rfnd_prior', payment_id: 'pay_test1', amount: 49900, status: 'processed' });
  await service.request('uid', id, 'Other'); const approved = await service.review('admin', id, true, 'Approved');
  assert.equal(approved.refund!.amountPaise, 100000); assert.equal(f.refunds[1].amount, 100000);
});
test('forged payment/amount or pending external refunds prevent approval and stock writes', async () => {
  for (const kind of ['payment', 'amount', 'pending']) {
    const { f, id, service } = await checkout(); await service.request('uid', id, 'Other');
    if (kind === 'payment') f.evidence({ order_id: 'order_wrong' });
    if (kind === 'amount') f.evidence({ amount: 1 });
    if (kind === 'pending') f.refunds.push({ id: 'rfnd_external', payment_id: 'pay_test1', amount: 100, status: 'pending' });
    await assert.rejects(service.review('admin', id, true, 'Approved')); assert.equal(f.refundCalls, 0); assert.equal(f.docs.get('products/dress').data.stockCount, 4);
  }
});
test('missing ledger requires manual inventory review; invalid variant fails approval atomically', async () => {
  const { f, id, service } = await checkout(); f.docs.delete(`inventoryMovements/${id}-reserve`); await service.request('uid', id, 'Other');
  const order = await service.review('admin', id, true, 'Approved'); assert.equal(order.cancellationRequest!.inventory, 'MANUAL_REVIEW'); assert.equal(f.docs.get('products/dress').data.stockCount, 4);
  const other = await checkout(); other.f.docs.get('products/dress').data.variantInventory[0].key = 'wrong'; await other.service.request('uid', other.id, 'Other');
  await assert.rejects(other.service.review('admin', other.id, true, 'Approved'), /INVENTORY_CHANGED/); assert.equal(other.f.docs.get(`orders/${other.id}`).data.cancellationRequest.status, 'REQUESTED'); assert.equal(other.f.refundCalls, 0);
});
test('fulfilment cannot roll backwards to regain cancellation eligibility or bypass approval', async () => {
  const { f, id } = await checkout(); await fulfilOrder(f.db, 'admin', id, 'Processing');
  await assert.rejects(fulfilOrder(f.db, 'admin', id, 'Order Placed'), /INVALID_FULFILMENT_TRANSITION/);
  await assert.rejects(fulfilOrder(f.db, 'admin', id, 'Cancelled'), /CANCELLATION_APPROVAL_REQUIRED/);
});
test('cancellation request racing fulfilment permits exactly one transition', async () => {
  const { f, id, service } = await checkout();
  const results = await Promise.allSettled([service.request('uid', id, 'Other'), fulfilOrder(f.db, 'admin', id, 'Processing')]);
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
  assert.equal(f.docs.get('products/dress').data.stockCount, 4); assert.equal(f.refundCalls, 0);
});
test('approval rechecks stage after provider inspection, before inventory/refund transitions', async () => {
  const { f, id, service } = await checkout(); await service.request('uid', id, 'Other');
  const original = f.provider.payment; f.provider.payment = async paymentId => { f.docs.get(`orders/${id}`).data.orderStatus = 'Processing'; return original(paymentId); };
  await assert.rejects(service.review('admin', id, true, 'Approved'), /CANCELLATION_INELIGIBLE/);
  assert.equal(f.refundCalls, 0); assert.equal(f.docs.get('products/dress').data.stockCount, 4);
});
test('unknown pre-response failure retries the immutable key/body and interrupted initiation recovers', async () => {
  const { f, id, service } = await checkout(); await service.request('uid', id, 'Other');
  const original = f.provider.createRefund!; const calls: unknown[] = []; let fail = true;
  f.provider.createRefund = async (...args) => { calls.push(args); if (fail) { fail = false; throw Error('before response'); } return original(...args); };
  await service.review('admin', id, true, 'Approved'); await service.recoverRefund(id);
  assert.equal(calls.length, 2); assert.deepEqual(calls[0], calls[1]); assert.equal(f.refundCalls, 1);
  const interrupted = await checkout(); const disabled = new CancellationService(interrupted.f.db, interrupted.f.provider, false, () => 1_800_000_000_000);
  await disabled.request('uid', interrupted.id, 'Other'); await disabled.review('admin', interrupted.id, true, 'Approved');
  const refund = interrupted.f.docs.get(`orders/${interrupted.id}`).data.refund; refund.state = 'INITIATING'; refund.updatedAt = new Date(1_800_000_000_000 - 120_000).toISOString();
  await interrupted.service.recoverRefund(interrupted.id); assert.equal(interrupted.f.refundCalls, 1);
});
test('expired ambiguous refund retry enters manual review rather than generating another refund', async () => {
  const { f, id } = await checkout(); const disabled = new CancellationService(f.db, f.provider, false, () => 1_800_000_000_000);
  await disabled.request('uid', id, 'Other'); await disabled.review('admin', id, true, 'Approved');
  f.docs.get(`orders/${id}`).data.refund.state = 'UNKNOWN';
  await new CancellationService(f.db, f.provider, true, () => 1_800_000_000_000 + 86_400_001).recoverRefund(id);
  assert.equal(f.refundCalls, 0); assert.equal(f.docs.get(`orders/${id}`).data.refund.state, 'MANUAL_REVIEW');
});
test('historical COD cancellation copies only the authenticated customer record and requires manual stock review', async () => {
  const { f, id, service } = await checkout(false); const source = structuredClone(f.docs.get(`orders/${id}`));
  source.data.paymentMethod = 'cod'; source.data.paymentProvider = 'cod'; source.data.paymentStatus = 'Pending';
  delete source.data.razorpayOrderId; f.docs.delete(`orders/${id}`); f.docs.delete(`inventoryReservations/${id}`); f.docs.set(`users/uid/orders/${id}`, source);
  await assert.rejects(service.request('other', id, 'Other'), /ORDER_NOT_FOUND/);
  await service.request('uid', id, 'Other'); const cancelled = await service.review('admin', id, true, 'Approved');
  assert.equal(cancelled.cancellationRequest!.inventory, 'MANUAL_REVIEW'); assert.equal(f.refundCalls, 0); assert.deepEqual(f.docs.get(`users/uid/orders/${id}`), source);
});
test('stale request/payment responses cannot erase a reviewed cancellation or processed refund', async () => {
  const { f, id, service } = await checkout(); const requested = await service.request('uid', id, 'Other');
  const approved = await service.review('admin', id, true, 'Approved');
  assert.equal(preferPaymentOrder(approved, requested), approved);
  f.refunds[0].status = 'processed'; await service.syncRefund(id); const processed = f.docs.get(`orders/${id}`).data;
  assert.equal(preferPaymentOrder(processed, approved), processed);
});
test('invalid provider refund response cannot mark a refund processed or alter paid evidence', async () => {
  for (const kind of ['amount', 'payment']) {
    const { f, id, service } = await checkout(); await service.request('uid', id, 'Other');
    f.provider.createRefund = async () => ({ id: 'rfnd_wrong', payment_id: kind === 'payment' ? 'pay_wrong' : 'pay_test1', amount: kind === 'amount' ? 1 : 149900, status: 'processed' });
    const result = await service.review('admin', id, true, 'Approved');
    assert.equal(result.refund!.state, 'UNKNOWN'); assert.equal(result.refund!.id, undefined); assert.equal(result.paymentStatus, 'PAID');
  }
});
test('expiry before capture preserves Cart and does not permit late capture cleanup', async () => {
  const { f, id } = await checkout(false); f.advance(); await f.service.reconcile(id);
  assert.equal(f.docs.get(`orders/${id}`).data.paymentStatus, 'EXPIRED'); assert.equal(f.docs.get('carts/uid').items[0].quantity, 2);
  f.evidence({ status: 'captured', captured: true }); const late = await f.service.syncPayment(id, 'pay_test1');
  assert.equal(late.cartCleanupStatus, 'SKIPPED'); assert.equal(f.docs.get('carts/uid').items[0].quantity, 2);
});
