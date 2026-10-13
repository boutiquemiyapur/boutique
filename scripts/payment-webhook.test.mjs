import test from 'node:test';
import assert from 'node:assert/strict';
import {createHmac,createHash} from 'node:crypto';
import {PassThrough} from 'node:stream';
import {build} from 'esbuild';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
const out=resolve('node_modules/.cache/webhook-handler-tests.mjs');
await build({entryPoints:['api/payments/webhook.ts'],outfile:out,bundle:true,platform:'node',format:'esm',packages:'external',plugins:[{name:'isolated-handler',setup(b){
 b.onResolve({filter:/orders\/cancellation\.js$/},()=>({path:'cancellation',namespace:'fixture'}));
 b.onResolve({filter:/payments\/http\.js$/},()=>({path:'http',namespace:'fixture'}));
 b.onResolve({filter:/payments\/environment\.js$/},()=>({path:'env',namespace:'fixture'}));
 b.onResolve({filter:/payments\/provider\.js$/},()=>({path:'provider',namespace:'fixture'}));
 b.onResolve({filter:/payments\/service\.js$/},()=>({path:'service',namespace:'fixture'}));
 b.onLoad({filter:/.*/,namespace:'fixture'},({path})=>({resolveDir:process.cwd(),contents:{
 cancellation:"export class CancellationService { async syncRefund(){ globalThis.refundObserverCalls++; if(globalThis.refundObserverFailure) throw Error('fixture observer failure'); } }",
 http:"export {rawBody,prepare,failure} from './server/payments/http'; export const database=()=>globalThis.webhookDb;",
 env:"export const validatePaymentEnvironment=()=>{};",
 provider:"export {validSignature} from './server/payments/provider'; export const razorpayProvider=()=>globalThis.webhookProvider;",
 service:"export class PaymentService {async attach(id,order){globalThis.webhookCalls.push(['attach',id,order.id]);} async syncPayment(id,paymentId,event){globalThis.webhookCalls.push(['sync',id,paymentId]);globalThis.webhookDocs.set(globalThis.eventHash(event.id),{...event,orderId:id,refundObserverStatus:'PENDING'});}}"
 }[path]}));
}}]});
const {default:handler}=await import(pathToFileURL(out).href);
const secret='fixture-only-webhook-secret';
function reset(){globalThis.eventHash=id=>createHash('sha256').update(id).digest('hex');globalThis.refundObserverFailure=false;globalThis.refundCompletionFailure=false;globalThis.refundObserverCalls=0;globalThis.webhookCalls=[];globalThis.webhookDocs=new Map();globalThis.webhookDb={collection:()=>({doc:id=>({get:async()=>({exists:webhookDocs.has(id),data:()=>webhookDocs.get(id)}),update:async patch=>{if(refundCompletionFailure)throw Error('fixture completion failure');Object.assign(webhookDocs.get(id),patch);}})}),runTransaction:async fn=>fn({get:async ref=>ref.get(),set:()=>{}})};globalThis.webhookProvider={payment:async id=>{webhookCalls.push(['provider',id]);return {id,order_id:'order_fixture'};},order:async()=>({id:'order_fixture',notes:{checkoutId:'pay_internal'}})};}

async function invoke(raw,mode='lazy',signature=createHmac('sha256',secret).update(raw).digest('hex')){
 const req=new PassThrough();req.method='POST';req.headers={'content-type':'application/json','x-razorpay-signature':signature};
 if(mode==='lazy')Object.defineProperty(req,'body',{get(){throw Error('Lazy body getter executed');}});
 if(mode==='parsed')req.body=JSON.parse(raw.toString());
 let status=0,result;const previous=process.env.RAZORPAY_WEBHOOK_SECRET;process.env.RAZORPAY_WEBHOOK_SECRET=secret;
 try{const work=handler(req,{setHeader(){},status(code){status=code;return this;},json(data){result=data;}});req.end(raw);await work;return {status,result};}
 finally{if(previous===undefined)delete process.env.RAZORPAY_WEBHOOK_SECRET;else process.env.RAZORPAY_WEBHOOK_SECRET=previous;}
}
test('real webhook handler consumes signed wire bytes without invoking the lazy getter for all seven events',async()=>{
 for(const event of ['payment.authorized','payment.captured','payment.failed','order.paid','refund.created','refund.processed','refund.failed']){reset();const raw=Buffer.from(JSON.stringify({event,payload:event.startsWith('refund')?{refund:{entity:{payment_id:'pay_fixture'}}}:{payment:{entity:{id:'pay_fixture'}}}}));assert.equal((await invoke(raw)).status,200);assert.deepEqual(webhookCalls.at(-1),['sync','pay_internal','pay_fixture']);assert.equal(refundObserverCalls,1);}
});
test('signature mismatch, parsed body and signed malformed payloads never call provider or database processing',async()=>{
 for(const [raw,mode,signature,code] of [[Buffer.from('{ "event": "payment.captured" }'),'lazy','0'.repeat(64),'SIGNATURE_INVALID'],[Buffer.from('{"event":"payment.captured"}'),'parsed',undefined,'RAW_BODY_REQUIRED'],[Buffer.from('{'),'lazy',undefined,'INVALID_JSON'],[Buffer.from('{"event":"payment.captured","payload":{}}'),'lazy',undefined,'INVALID_TEXT']]){
 reset();const result=await invoke(raw,mode,signature);assert.equal(result.status,400);assert.equal(result.result.code,code);assert.equal(webhookCalls.length,0);
 }
});
test('duplicate identical webhook acknowledges without provider calls; conflicting delivery stays rejected',async()=>{
 const raw=Buffer.from('{ "event": "payment.captured", "payload": {} }');const {createHash}=await import('node:crypto');const hash=createHash('sha256').update(raw).digest('hex');
 for(const [stored,status] of [[hash,200],['different',409]]){reset();webhookDb.collection=()=>({doc:()=>({get:async()=>({exists:true,data:()=>({hash:stored})})})});assert.equal((await invoke(raw)).status,status);assert.equal(webhookCalls.length,0);}
});
test('M4: pending refund observer survives failure and completes on signed retry without reapplying payment',async()=>{
 reset();const raw=Buffer.from(JSON.stringify({event:'refund.processed',payload:{refund:{entity:{payment_id:'pay_fixture'}}}}));
 globalThis.refundObserverFailure=true;assert.equal((await invoke(raw)).status,503);assert.equal(refundObserverCalls,1);
 const stored=webhookDocs.get(eventHash(eventHash(raw)));assert.equal(stored.refundObserverStatus,'PENDING');
 globalThis.refundObserverFailure=false;assert.equal((await invoke(raw)).status,200);assert.equal(refundObserverCalls,2);
 assert.equal(stored.refundObserverStatus,'DONE');assert.equal(webhookCalls.filter(call=>call[0]==='sync').length,1);
 assert.equal((await invoke(raw)).status,200);assert.equal(refundObserverCalls,2);
});

 test('M4: legacy mapped events without an observer marker recover safely',async()=>{
 reset();const raw=Buffer.from(JSON.stringify({event:'refund.failed',payload:{refund:{entity:{payment_id:'pay_fixture'}}}}));
 const hash=eventHash(raw);const key=eventHash(hash);webhookDocs.set(key,{hash,orderId:'pay_internal'});
 assert.equal((await invoke(raw)).status,200);assert.equal(refundObserverCalls,1);assert.equal(webhookDocs.get(key).refundObserverStatus,'DONE');
 assert.equal(webhookCalls.length,0);
});

test('M4: completion-write failure keeps observer pending for a safe later delivery',async()=>{
 reset();const raw=Buffer.from(JSON.stringify({event:'refund.created',payload:{refund:{entity:{payment_id:'pay_fixture'}}}}));
 refundCompletionFailure=true;assert.equal((await invoke(raw)).status,503);
 const stored=webhookDocs.get(eventHash(eventHash(raw)));assert.equal(stored.refundObserverStatus,'PENDING');
 refundCompletionFailure=false;assert.equal((await invoke(raw)).status,200);
 assert.equal(stored.refundObserverStatus,'DONE');assert.equal(refundObserverCalls,2);
 assert.equal(webhookCalls.filter(call=>call[0]==='sync').length,1);
});
