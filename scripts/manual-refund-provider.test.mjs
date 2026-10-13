import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {fixture} from './payment-fixture.ts';
async function provider(emergencyDisabled=false){
 const outfile=resolve(`node_modules/.cache/manual-provider-${emergencyDisabled}.mjs`);
 await build({entryPoints:['server/payments/provider.ts'],outfile,bundle:true,format:'esm',platform:'node',packages:'external',plugins:[{name:'local-boundaries',setup(b){
  b.onResolve({filter:/http\.js$/},()=>({path:'http',namespace:'fixture'}));
  b.onResolve({filter:/environment\.js$/},()=>({path:'env',namespace:'fixture'}));
  if(emergencyDisabled)b.onResolve({filter:/refundPolicy\.js$/},()=>({path:'policy',namespace:'fixture'}));
  b.onLoad({filter:/.*/,namespace:'fixture'},({path})=>({contents:{http:'export const database=()=>globalThis.manualProviderFixture.db;',env:"export const validatePaymentEnvironment=()=>({keyId:'mock-public-key',secret:'synthetic-only-secret'});",policy:'export const LIVE_REFUND_EXECUTION_ENABLED=false;'}[path]}));
 }}]});
 return (await import(pathToFileURL(outfile).href)).razorpayProvider({});
}
test('actual adapter enforces private OFF settings and retains exact idempotency/body only on permitted manual transport',async t=>{
 globalThis.manualProviderFixture=fixture();let calls=0;const requests=[];
 t.mock.method(globalThis,'fetch',async(url,request)=>{calls++;requests.push({url,body:JSON.parse(request.body),key:request.headers['X-Refund-Idempotency']});return {ok:true,json:async()=>({id:'rfnd_fixture',payment_id:'pay_fixture',amount:100,status:'pending',currency:'INR'})};});
 const p=await provider();await assert.rejects(p.createRefund('pay_fixture',100,'abr-fixture-key-12345'),/ADMIN_REFUNDS_DISABLED/);assert.equal(calls,0);
 manualProviderFixture.docs.set('refundSettings/control',{enabled:true,revision:1,updatedBy:'admin',updatedAt:new Date().toISOString()});
 await p.createRefund('pay_fixture',100,'abr-fixture-key-12345');assert.equal(calls,1);
 assert.deepEqual(requests[0],{url:'https://api.razorpay.com/v1/payments/pay_fixture/refund',key:'abr-fixture-key-12345',body:{amount:100,speed:'normal',receipt:'abr-fixture-key-12345'}});
 manualProviderFixture.docs.get('refundSettings/control').enabled=false;
 await assert.rejects(p.createRefund('pay_fixture',100,'abr-fixture-key-12345'),/ADMIN_REFUNDS_DISABLED/);assert.equal(calls,1);
});
test('emergency-disabled adapter rejects before any database or provider transport access, even with persisted ON',async t=>{
 let calls=0;t.mock.method(globalThis,'fetch',async()=>{calls++;throw Error('must not send');});
 globalThis.manualProviderFixture={get db(){throw Error('must not read');}};
 const p=await provider(true);assert.throws(()=>p.createRefund('pay_fixture',100,'abr-fixture-key-12345'),/LIVE_REFUNDS_DISABLED/);assert.equal(calls,0);
});
test('actual provider binds saved payment configuration without changing trusted order creation fields',async t=>{
 const calls=[];
 t.mock.method(globalThis,'fetch',async(url,request)=>{calls.push({url,method:request.method,body:JSON.parse(request.body)});return {ok:true,json:async()=>({id:'order_fixture',amount:141000,currency:'INR',receipt:'receipt-fixture',notes:{checkoutId:'business-fixture'}})};});
 const p=await provider();await p.createOrder(141000,'receipt-fixture','business-fixture');
 assert.deepEqual(calls,[{url:'https://api.razorpay.com/v1/orders',method:'POST',body:{amount:141000,currency:'INR',receipt:'receipt-fixture',partial_payment:false,notes:{checkoutId:'business-fixture'},checkout_config_id:'config_TnT66HkFpG4oK4'}}]);
});
