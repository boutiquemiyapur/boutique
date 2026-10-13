import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
const outfile=resolve('node_modules/.cache/refund-management-client.mjs');
await build({entryPoints:['src/services/refundManagementClient.ts'],outfile,bundle:true,format:'esm',platform:'node',packages:'external',plugins:[{name:'auth-fixture',setup(b){
 b.onResolve({filter:/firebase\/config$/},()=>({path:'firebase',namespace:'fixture'}));
 b.onLoad({filter:/.*/,namespace:'fixture'},()=>({contents:'export const firebaseAuth={get currentUser(){return globalThis.refundClientUser;}};'}));
}}]});
const api=await import(pathToFileURL(outfile).href);
const tick=()=>new Promise(r=>setImmediate(r));
function user(uid='admin'){globalThis.refundClientUser={uid,getIdToken:async()=> 'synthetic-admin-token'};}
test('concurrent order panels share only the in-flight settings read; later refresh fetches again',async()=>{
 user();let release,calls=0;globalThis.fetch=async()=>{calls++;return new Promise(r=>release=()=>r({ok:true,json:async()=>({settings:{effectiveEnabled:false},history:[]})}));};
 const first=api.loadRefundSettings();const second=api.loadRefundSettings();assert.equal(first,second);await tick();assert.equal(calls,1);release();await first;
 const refreshed=api.loadRefundSettings();await tick();assert.equal(calls,2);release();await refreshed;
});
test('account switching before token or response and wrong order responses cannot authorize UI confirmation',async()=>{
 user();refundClientUser.getIdToken=async()=>{user('other');return 'synthetic-admin-token';};globalThis.fetch=()=>{throw Error('must not send after account change');};await assert.rejects(api.reviewApprovedRefund('one'),/account changed/);
 user();globalThis.fetch=async()=>{user('other');return {ok:true,json:async()=>({review:{orderId:'one'}})};};await assert.rejects(api.reviewApprovedRefund('one'),/account changed/);
 user();globalThis.fetch=async()=>({ok:true,json:async()=>({review:{orderId:'other'},order:{id:'other'}})});await assert.rejects(api.reviewApprovedRefund('one'),/did not match/);await assert.rejects(api.confirmApprovedRefund('one','review'),/did not match/);
});
