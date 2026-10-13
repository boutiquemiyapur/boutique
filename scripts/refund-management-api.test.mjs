import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {fixture} from './payment-fixture.ts';
import {createHmac} from 'node:crypto';
const outfile=resolve('node_modules/.cache/refund-management-api.mjs');
await build({stdin:{resolveDir:process.cwd(),contents:"export {default as settings} from './api/admin/refund-settings'; export {default as cancellation} from './api/orders/cancellation'; export {default as reconcile} from './api/payments/reconcile'; export {default as webhook} from './api/payments/webhook';"},outfile,bundle:true,platform:'node',format:'esm',packages:'external',plugins:[{name:'synthetic-sdk',setup(b){
 b.onResolve({filter:/^firebase-admin\/(auth|app|firestore)$/},args=>({path:args.path,namespace:'fixture'}));
 b.onResolve({filter:/environment\.js$/},()=>({path:'environment',namespace:'fixture'}));
 b.onResolve({filter:/payments\/provider\.js$/},()=>({path:'provider',namespace:'fixture'}));
 b.onLoad({filter:/.*/,namespace:'fixture'},({path})=>({contents:{
  'firebase-admin/app':"export const getApps=()=>[{options:{projectId:'demo-ab-payments'}}]; export const initializeApp=()=>{}; export const cert=()=>{};",
  'firebase-admin/firestore':"export const getFirestore=()=>globalThis.refundFixture.db;",
  'firebase-admin/auth':"export const getAuth=()=>({verifyIdToken:async(token,checkRevoked)=>{globalThis.revocationChecks.push(checkRevoked);if(token==='revoked'||token==='expired')throw Error('synthetic invalid token');return {uid:token,admin:token==='admin'};}});",
  environment:"export const validateServerFirebase=()=> 'demo-ab-payments'; export const validatePaymentEnvironment=()=>({});",
  provider:"import {createHmac} from 'node:crypto';export const validSignature=(bytes,signature,secret)=>createHmac('sha256',secret).update(bytes).digest('hex')===signature;export const razorpayProvider=()=>globalThis.refundFixture.provider;"
 }[path]}));
}}]});
const api=await import(pathToFileURL(outfile).href);
async function invoke(handler,body,auth='admin',method='POST') {let status,result;await handler({method,headers:{...(auth?{authorization:`Bearer ${auth}`} :{}),'content-type':'application/json'},body},{setHeader(){},status(v){status=v;return this;},json(v){result=v;}});return {status,result};}
function reset(){globalThis.refundFixture=fixture();globalThis.revocationChecks=[];}
test('actual shared authentication checks revocation for settings and refund endpoints',async()=>{
 reset();
 for(const [handler,body] of [[api.settings,{action:'status'}],[api.cancellation,{action:'executeRefund',orderId:'order-fixture',reviewId:'review-fixture',confirmed:true}]]) {
  for(const auth of ['', 'expired','revoked','customer'])assert.equal((await invoke(handler,body,auth)).status,auth==='customer'?403:401);
 }
 assert.ok(revocationChecks.length>=6);assert.ok(revocationChecks.every(v=>v===true));assert.equal(refundFixture.refundCalls,0);
});
test('real scheduled reconciliation and signed webhooks observe an unknown confirmed attempt without submitting a refund',async t=>{
 reset();const f=refundFixture;const {order}=await f.service.create('uid',f.request);await f.service.syncPayment(order.id,'pay_test1');const orderId=order.id;
 await invoke(api.cancellation,{orderId,action:'request',reason:'Other'},'uid');await invoke(api.settings,{action:'set',enabled:true,revision:0,confirmed:true});await invoke(api.cancellation,{orderId,action:'approve',reason:'Approved'});
 const r=f.docs.get(`orders/${orderId}`).data.refund;r.state='UNKNOWN';
 r.executionAuthorization={adminUid:'admin',reviewId:'historical-confirmation',confirmedAt:r.approvedAt,settingsRevision:1,paymentId:r.paymentId,amountPaise:r.amountPaise,idempotencyKey:r.idempotencyKey,approvedAt:r.approvedAt};
 const collection=f.db.collection.bind(f.db);
 f.db.collection=name=>{const result=collection(name);if(name==='paymentAttempts')result.where=()=>({orderBy:()=>({limit:()=>({get:async()=>({docs:[{id:orderId,ref:collection(name).doc(orderId)}]})})})});return result;};
 const oldCron=process.env.CRON_SECRET,oldWebhook=process.env.RAZORPAY_WEBHOOK_SECRET;process.env.CRON_SECRET='synthetic-cron-only';process.env.RAZORPAY_WEBHOOK_SECRET='synthetic-webhook-only';
 t.after(()=>{if(oldCron===undefined)delete process.env.CRON_SECRET;else process.env.CRON_SECRET=oldCron;if(oldWebhook===undefined)delete process.env.RAZORPAY_WEBHOOK_SECRET;else process.env.RAZORPAY_WEBHOOK_SECRET=oldWebhook;});
 const scheduled=await invoke(api.reconcile,null,'synthetic-cron-only','GET');assert.equal(scheduled.status,200);assert.equal(f.refundCalls,0);
 async function event(eventType,eventId){const body=Buffer.from(JSON.stringify({event:eventType,payload:{payment:{entity:{id:'pay_test1'}},refund:{entity:{payment_id:'pay_test1'}}}}));let status;
  await api.webhook({method:'POST',headers:{'x-razorpay-event-id':eventId,'x-razorpay-signature':createHmac('sha256','synthetic-webhook-only').update(body).digest('hex')},body},{setHeader(){},status(v){status=v;return this;},json(){}});return status;
 }
 assert.equal(await event('payment.captured','manual-status-payment'),200);assert.equal(f.refundCalls,0);
 f.refunds.push({id:'rfnd_existing',payment_id:'pay_test1',amount:r.amountPaise,status:'processed',currency:'INR',receipt:r.idempotencyKey});
 assert.equal(await event('refund.processed','manual-status-refund'),200);assert.equal(await event('refund.processed','manual-status-refund'),200);
 assert.equal(f.docs.get(`orders/${orderId}`).data.refund.state,'PROCESSED');assert.equal(f.refundCalls,0);assert.equal(f.docs.get('products/dress').data.stockCount,2);
});
test('real admin settings toggle supports ON/OFF, strict schema and audited history without sending funds',async()=>{
 reset();const current=await invoke(api.settings,{action:'status'});assert.equal(current.status,200);assert.equal(current.result.settings.effectiveEnabled,false);assert.deepEqual(current.result.history,[]);
 for(const body of [{action:'set',enabled:true,revision:0,confirmed:true,codeEnabled:true},{action:'set',enabled:'true',revision:0,confirmed:true},{action:'set',enabled:false,revision:-1,confirmed:false},{action:'status',enabled:true}])assert.equal((await invoke(api.settings,body)).status,400);
 assert.equal((await invoke(api.settings,{action:'set',enabled:true,revision:0,confirmed:false})).result.code,'REFUND_ENABLE_CONFIRMATION_REQUIRED');
 const on=await invoke(api.settings,{action:'set',enabled:true,revision:0,confirmed:true});assert.equal(on.status,200);assert.equal(on.result.settings.effectiveEnabled,true);assert.equal(refundFixture.refundCalls,0);
 const off=await invoke(api.settings,{action:'set',enabled:false,revision:1,confirmed:false});assert.equal(off.status,200);assert.equal(off.result.settings.effectiveEnabled,false);assert.equal(off.result.history.length,2);assert.equal(off.result.history[0].by,'admin');assert.equal(refundFixture.refundCalls,0);
 assert.equal((await invoke(api.settings,{action:'status'},'admin','GET')).status,405);
});
test('settings API rate limits repeated authenticated requests without granting financial access',async()=>{
 reset();const outcomes=await Promise.all(Array.from({length:31},()=>invoke(api.settings,{action:'status'})));
 assert.equal(outcomes.filter(v=>v.status===200).length,30);assert.equal(outcomes.filter(v=>v.status===429).length,1);assert.equal(refundFixture.refundCalls,0);
});
test('refund execution rejects unconfirmed and amount-injected requests',async()=>{
 reset();for(const body of [{action:'executeRefund',orderId:'order-fixture',reviewId:'review-fixture',confirmed:false},{action:'executeRefund',orderId:'order-fixture',reviewId:'review-fixture',confirmed:true,amountPaise:1}])assert.equal((await invoke(api.cancellation,body)).status,400);
 const locked=await invoke(api.cancellation,{action:'executeRefund',orderId:'order-fixture',reviewId:'review-fixture',confirmed:true});assert.equal(locked.result.code,'ADMIN_REFUNDS_DISABLED');assert.equal(refundFixture.refundCalls,0);
});
test('only a fresh authorized admin review and confirmation can execute; direct customer and legacy retry requests cannot',async()=>{
 reset();const f=refundFixture;const {order}=await f.service.create('uid',f.request);await f.service.syncPayment(order.id,'pay_test1');const orderId=order.id;
 await invoke(api.cancellation,{orderId,action:'request',reason:'Other'},'uid');
 await invoke(api.settings,{action:'set',enabled:true,revision:0,confirmed:true});
 const approval=await invoke(api.cancellation,{orderId,action:'approve',reason:'Approved'});assert.equal(approval.status,200);assert.equal(f.refundCalls,0);
 const review=await invoke(api.cancellation,{orderId,action:'reviewRefund'});assert.equal(review.result.review.canExecute,true);const reviewId=review.result.review.reviewId;
 assert.equal((await invoke(api.cancellation,{orderId,action:'executeRefund',reviewId,confirmed:true},'uid')).status,403);
 assert.equal((await invoke(api.cancellation,{orderId,action:'executeRefund',reviewId:'wrong-review',confirmed:true})).status,409);
 assert.equal((await invoke(api.cancellation,{orderId,action:'retryRefund'})).result.code,'REFUND_CONFIRMATION_REQUIRED');assert.equal(f.refundCalls,0);
 const confirmed=await invoke(api.cancellation,{orderId,action:'executeRefund',reviewId,confirmed:true});assert.equal(confirmed.status,200);assert.equal(confirmed.result.order.refund.state,'PENDING');assert.equal(f.refundCalls,1);
 await invoke(api.cancellation,{orderId,action:'executeRefund',reviewId,confirmed:true});assert.equal(f.refundCalls,1);
});
