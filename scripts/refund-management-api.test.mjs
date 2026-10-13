import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {fixture} from './payment-fixture.ts';
const outfile=resolve('node_modules/.cache/refund-management-api.mjs');
await build({stdin:{resolveDir:process.cwd(),contents:"export {default as settings} from './api/admin/refund-settings'; export {default as cancellation} from './api/orders/cancellation';"},outfile,bundle:true,platform:'node',format:'esm',packages:'external',plugins:[{name:'synthetic-sdk',setup(b){
 b.onResolve({filter:/^firebase-admin\/(auth|app|firestore)$/},args=>({path:args.path,namespace:'fixture'}));
 b.onResolve({filter:/environment\.js$/},()=>({path:'environment',namespace:'fixture'}));
 b.onResolve({filter:/payments\/provider\.js$/},()=>({path:'provider',namespace:'fixture'}));
 b.onLoad({filter:/.*/,namespace:'fixture'},({path})=>({contents:{
  'firebase-admin/app':"export const getApps=()=>[{options:{projectId:'demo-ab-payments'}}]; export const initializeApp=()=>{}; export const cert=()=>{};",
  'firebase-admin/firestore':"export const getFirestore=()=>globalThis.refundFixture.db;",
  'firebase-admin/auth':"export const getAuth=()=>({verifyIdToken:async(token,checkRevoked)=>{globalThis.revocationChecks.push(checkRevoked);if(token==='revoked'||token==='expired')throw Error('synthetic invalid token');return {uid:token,admin:token==='admin'};}});",
  environment:"export const validateServerFirebase=()=> 'demo-ab-payments'; export const validatePaymentEnvironment=()=>({});",
  provider:"export const razorpayProvider=()=>globalThis.refundFixture.provider;"
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
test('settings default OFF, strict schema, code gate and private history work through the real endpoint',async()=>{
 reset();const current=await invoke(api.settings,{action:'status'});assert.equal(current.status,200);assert.equal(current.result.settings.effectiveEnabled,false);assert.deepEqual(current.result.history,[]);
 for(const body of [{action:'set',enabled:true,revision:0,confirmed:true,codeEnabled:true},{action:'set',enabled:'true',revision:0,confirmed:true},{action:'set',enabled:false,revision:-1,confirmed:false},{action:'status',enabled:true}])assert.equal((await invoke(api.settings,body)).status,400);
 assert.equal((await invoke(api.settings,{action:'set',enabled:true,revision:0,confirmed:true})).result.code,'LIVE_REFUNDS_DISABLED');
 const off=await invoke(api.settings,{action:'set',enabled:false,revision:0,confirmed:false});assert.equal(off.status,200);assert.equal(off.result.history.length,1);assert.equal(off.result.history[0].by,'admin');assert.equal(refundFixture.refundCalls,0);
 assert.equal((await invoke(api.settings,{action:'status'},'admin','GET')).status,405);
});
test('settings API rate limits repeated authenticated requests without granting financial access',async()=>{
 reset();const outcomes=await Promise.all(Array.from({length:31},()=>invoke(api.settings,{action:'status'})));
 assert.equal(outcomes.filter(v=>v.status===200).length,30);assert.equal(outcomes.filter(v=>v.status===429).length,1);assert.equal(refundFixture.refundCalls,0);
});
test('refund execution rejects unconfirmed and amount-injected requests',async()=>{
 reset();for(const body of [{action:'executeRefund',orderId:'order-fixture',reviewId:'review-fixture',confirmed:false},{action:'executeRefund',orderId:'order-fixture',reviewId:'review-fixture',confirmed:true,amountPaise:1}])assert.equal((await invoke(api.cancellation,body)).status,400);
 const locked=await invoke(api.cancellation,{action:'executeRefund',orderId:'order-fixture',reviewId:'review-fixture',confirmed:true});assert.equal(locked.result.code,'LIVE_REFUNDS_DISABLED');assert.equal(refundFixture.refundCalls,0);
});
