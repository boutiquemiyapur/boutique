import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
const outfile=resolve('node_modules/.cache/cancellation-api-fixture.mjs');
await build({entryPoints:['api/orders/cancellation.ts'],outfile,bundle:true,platform:'node',format:'esm',packages:'external',plugins:[{name:'local-auth-provider',setup(b){
 b.onResolve({filter:/payments\/http\.js$/},()=>({path:'http',namespace:'fixture'}));
 b.onResolve({filter:/payments\/provider\.js$/},()=>({path:'provider',namespace:'fixture'}));
 b.onLoad({filter:/.*/,namespace:'fixture'},({path})=>({resolveDir:process.cwd(),contents:path==='http'?`export {failure,prepare,jsonBody,rateLimit} from './server/payments/http'; import {PaymentError} from './server/payments/errors'; export const database=()=>globalThis.cancelFixture.db; export const authenticate=async(req,admin=false)=>{const token=req.headers.authorization;if(!token||token==='Bearer expired')throw new PaymentError('AUTH_INVALID',401);if(admin&&token!=='Bearer admin')throw new PaymentError('ADMIN_REQUIRED',403);return token==='Bearer admin'?'admin':token==='Bearer other'?'other':'uid';};`:`export {validSignature} from './server/payments/provider'; export const razorpayProvider=()=>globalThis.cancelFixture.provider;`}));
}}]});
const {default:handler}=await import(pathToFileURL(outfile).href);
const {fixture}=await import('../scripts/payment-fixture.ts');
async function invoke(auth,body){let status,result;await handler({method:'POST',headers:{authorization:auth,'content-type':'application/json'},body},{setHeader(){},status(v){status=v;return this},json(v){result=v}});return {status,result};}
test('real cancellation endpoint enforces authentication, ownership, admin approval and strict schema',async()=>{
 globalThis.cancelFixture=fixture();const created=await cancelFixture.service.create('uid',cancelFixture.request);await cancelFixture.service.syncPayment(created.order.id,'pay_test1');const orderId=created.order.id;
 for(const auth of [undefined,'Bearer expired'])assert.equal((await invoke(auth,{orderId,action:'request',reason:'Other'})).status,401);
 assert.equal((await invoke('Bearer other',{orderId,action:'request',reason:'Other'})).status,404);
 for(const action of ['approve','reject','quote','retryRefund'])assert.equal((await invoke('Bearer uid',{orderId,action,reason:'Other'})).status,403);
 assert.equal((await invoke('Bearer admin',{orderId,action:'approve',amount:1})).status,400);
 assert.equal((await invoke('Bearer uid',{orderId,action:'request',reason:'Other'})).status,200);
 const approved=await invoke('Bearer admin',{orderId,action:'approve',reason:'Approved'});assert.equal(approved.status,200);assert.equal(approved.result.order.refund.state,'AWAITING_ENABLEMENT');assert.equal(cancelFixture.refundCalls,0);
 assert.equal((await invoke('Bearer admin',{orderId,action:'retryRefund'})).result.code,'LIVE_REFUNDS_DISABLED');
});
