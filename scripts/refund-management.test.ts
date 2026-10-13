import test from 'node:test';
import assert from 'node:assert/strict';
import { fixture } from './payment-fixture.js';
import { CancellationService } from '../server/orders/cancellation.js';
import { RefundSettingsService } from '../server/orders/refundSettings.js';
import { LIVE_REFUND_EXECUTION_ENABLED } from '../server/orders/refundPolicy.js';

const start = 1_800_000_000_000;
test('remaining balance below Razorpay INR 1 minimum is held for manual review, never rounded or submitted', async () => {
  const f=fixture(5);const service=new CancellationService(f.db,f.provider,true,()=>start);
  const {order}=await f.service.create('uid',f.request);await f.service.syncPayment(order.id,'pay_test1');
  f.refunds.push({id:'rfnd_prior',payment_id:'pay_test1',amount:149899,status:'processed',currency:'INR'});
  await service.request('uid',order.id,'Other');await service.review('admin',order.id,true,'Approved');
  const review=await service.prepareRefundReview('admin',order.id);assert.equal(review.amountPaise,1);assert.equal(review.state,'MANUAL_REVIEW');assert.equal(review.canExecute,false);assert.equal(f.refundCalls,0);
});
async function approved() {
  const f = fixture(5); let clock = start;
  const service = new CancellationService(f.db, f.provider, true, () => clock);
  const settings = new RefundSettingsService(f.db, true, () => clock);
  const { order } = await f.service.create('uid', f.request);
  await f.service.syncPayment(order.id, 'pay_test1');
  await service.request('uid', order.id, 'Other');
  await service.review('admin', order.id, true, 'Approved');
  return { f, service, settings, id: order.id, advance(n: number) { clock += n; } };
}
test('both gates default OFF; actual code gate rejects ON even with a stored enabled setting', async () => {
  const f = fixture(); const locked = new RefundSettingsService(f.db);
  assert.equal(LIVE_REFUND_EXECUTION_ENABLED, false);
  assert.deepEqual(await locked.read(), {codeEnabled:false,adminEnabled:false,effectiveEnabled:false,revision:0,updatedAt:null,updatedBy:null});
  await assert.rejects(locked.set('admin',true,0,true), /LIVE_REFUNDS_DISABLED/);
  assert.equal(f.docs.has('refundSettings/control'), false);
  await new RefundSettingsService(f.db,true).set('admin',true,0,true);
  assert.equal((await locked.read()).effectiveEnabled, false);
  await locked.set('admin',false,1,false);
  assert.equal((await locked.read()).adminEnabled, false);
});
test('settings updates require explicit enable confirmation, revision checks and retain actor history', async () => {
  const f=fixture(); const settings=new RefundSettingsService(f.db,true,()=>start);
  await assert.rejects(settings.set('admin',true,0,false),/CONFIRMATION_REQUIRED/);
  const results=await Promise.allSettled([settings.set('one',true,0,true),settings.set('two',false,0,false)]);
  assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
  assert.equal((await settings.history()).length,1);
  assert.equal((await settings.history())[0].by,'one');
  await settings.set('one',true,1,true); assert.equal((await settings.history()).length,1);
  await settings.set('two',false,1,false); assert.equal((await settings.read()).revision,2);
  assert.equal((await settings.history()).length,2);
});
test('malformed persisted settings fail closed', async () => {
  for(const raw of [{enabled:'true'},{enabled:true,revision:-1},{enabled:true,revision:1,updatedBy:'admin',updatedAt:'bad'}]) {
    const f=fixture();f.docs.set('refundSettings/control',raw);
    await assert.rejects(new RefundSettingsService(f.db,true).read(),/REFUND_SETTINGS_REVIEW_REQUIRED/);
  }
});
test('enabling settings never executes approved cancellations and cron cannot authorize legacy refunds', async () => {
  const {f,service,settings,id}=await approved();
  assert.equal((await service.prepareRefundReview('admin',id)).canExecute,false);
  await settings.set('admin',true,0,true); await service.recoverRefund(id);
  assert.equal(f.refundCalls,0);assert.equal(f.docs.get('products/dress').data.stockCount,5);
  assert.equal(f.docs.get(`orders/${id}`).data.refund.state,'AWAITING_ENABLEMENT');
  await assert.rejects(service.retryApprovedRefund('admin',id),/REFUND_CONFIRMATION_REQUIRED/);
});
test('review is bound to admin/order and requires explicit confirmation; concurrent admin and cron cannot duplicate refund', async () => {
  const {f,service,settings,id}=await approved(); await settings.set('admin',true,0,true);
  const review=await service.prepareRefundReview('admin',id);
  assert.equal(review.canExecute,true); assert.equal(review.amountPaise,149900);assert.equal(f.refundCalls,0);
  await assert.rejects(service.confirmReviewedRefund('other',id,review.reviewId!,true),/EXPIRED_OR_INVALID/);
  await assert.rejects(service.confirmReviewedRefund('admin',id,review.reviewId!,false),/CONFIRMATION_REQUIRED/);
  const second=await service.prepareRefundReview('second',id);
  await Promise.allSettled([service.confirmReviewedRefund('admin',id,review.reviewId!,true),service.confirmReviewedRefund('second',id,second.reviewId!,true),service.recoverRefund(id)]);
  await service.recoverRefund(id);
  assert.equal(f.refundCalls,1);assert.equal(f.refunds.length,1);assert.equal(f.docs.get('products/dress').data.stockCount,5);
  assert.equal(f.docs.get(`orders/${id}`).data.refund.state,'PENDING');
  assert.ok([...f.docs.keys()].some(k=>k.includes('-confirmed-')));
});
test('short-lived review expires without renewing original approval or initiating funds', async () => {
  const {f,service,settings,id,advance}=await approved(); await settings.set('admin',true,0,true);
  const original=f.docs.get(`orders/${id}`).data.refund.approvedAt;
  const review=await service.prepareRefundReview('admin',id);advance(300001);
  await assert.rejects(service.confirmReviewedRefund('admin',id,review.reviewId!,true),/EXPIRED_OR_INVALID/);
  assert.equal(f.refundCalls,0);assert.equal(f.docs.get(`orders/${id}`).data.refund.approvedAt,original);
});
test('OFF and subsequent ON invalidate outstanding reviews and cannot revive old authorization', async () => {
  const {f,service,settings,id}=await approved();await settings.set('admin',true,0,true);
  const review=await service.prepareRefundReview('admin',id);
  await settings.set('admin',false,1,false);
  await assert.rejects(service.confirmReviewedRefund('admin',id,review.reviewId!,true),/ADMIN_REFUNDS_DISABLED/);
  await settings.set('admin',true,2,true);
  await assert.rejects(service.confirmReviewedRefund('admin',id,review.reviewId!,true),/REFUND_QUOTE_CHANGED/);
  await service.recoverRefund(id);assert.equal(f.refundCalls,0);
});
test('old approvals beyond 24h require manual review; original immutable key/time remain unchanged', async () => {
  const {f,service,settings,id,advance}=await approved();await settings.set('admin',true,0,true);
  const before=structuredClone(f.docs.get(`orders/${id}`).data.refund);advance(86400001);
  const review=await service.prepareRefundReview('admin',id);
  assert.equal(review.canExecute,false);assert.equal(review.state,'MANUAL_REVIEW');assert.equal(f.refundCalls,0);
  const after=f.docs.get(`orders/${id}`).data.refund;assert.equal(after.approvedAt,before.approvedAt);assert.equal(after.idempotencyKey,before.idempotencyKey);
});
test('provider amount/capture/history changes after review abort execution', async () => {
  for(const kind of ['amount','capture','external']) {
    const {f,service,settings,id}=await approved();await settings.set('admin',true,0,true);
    const review=await service.prepareRefundReview('admin',id);
    if(kind==='amount')f.evidence({amount:1});
    if(kind==='capture')f.evidence({captured:false,status:'authorized'});
    if(kind==='external')f.refunds.push({id:'rfnd_external',payment_id:'pay_test1',amount:1,status:'pending',currency:'INR'});
    await assert.rejects(service.confirmReviewedRefund('admin',id,review.reviewId!,true));assert.equal(f.refundCalls,0);
  }
});
test('confirmed attempt lost before transport is durable; scheduler resumes only its immutable authorized refund', async () => {
  const {f,service,settings,id}=await approved();await settings.set('admin',true,0,true);
  const review=await service.prepareRefundReview('admin',id);const execute=service.execute.bind(service);
  service.execute=async()=>{throw Error('synthetic process lost before transport');};
  await assert.rejects(service.confirmReviewedRefund('admin',id,review.reviewId!,true));assert.equal(f.refundCalls,0);
  assert.equal(f.docs.get(`paymentAttempts/${id}`).nextCheckAt,start+60000);
  service.execute=execute;await service.recoverRefund(id);assert.equal(f.refundCalls,1);
  const approval=f.docs.get(`orders/${id}`).data.refund;
  assert.equal(approval.executionAuthorization.reviewId,review.reviewId);
});
test('turning OFF then ON does not revive a confirmed but unsent authorization', async () => {
  const {f,service,settings,id}=await approved();await settings.set('admin',true,0,true);
  const review=await service.prepareRefundReview('admin',id);const execute=service.execute.bind(service);
  service.execute=async()=>{throw Error('synthetic process lost');};
  await assert.rejects(service.confirmReviewedRefund('admin',id,review.reviewId!,true));service.execute=execute;
  await settings.set('admin',false,1,false);await settings.set('admin',true,2,true);
  await service.recoverRefund(id);assert.equal(f.refundCalls,0);
  const fresh=await service.prepareRefundReview('admin',id);await service.confirmReviewedRefund('admin',id,fresh.reviewId!,true);assert.equal(f.refundCalls,1);
});
test('OFF blocks recovery sends but existing provider outcomes still synchronize truthfully', async () => {
  const {f,service,settings,id}=await approved();await settings.set('admin',true,0,true);
  const review=await service.prepareRefundReview('admin',id);f.refundTimeout=true;
  await service.confirmReviewedRefund('admin',id,review.reviewId!,true);assert.equal(f.refundCalls,1);
  await settings.set('admin',false,1,false);f.refunds[0].status='processed';
  await service.recoverRefund(id);await f.service.syncPayment(id,'pay_test1');
  assert.equal(f.docs.get(`orders/${id}`).data.refund.state,'PROCESSED');assert.equal(f.docs.get(`orders/${id}`).data.paymentStatus,'REFUNDED');assert.equal(f.refundCalls,1);
});
