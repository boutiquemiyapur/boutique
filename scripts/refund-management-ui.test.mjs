import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
const outfile=resolve('node_modules/.cache/refund-management-ui.mjs');
await build({stdin:{resolveDir:process.cwd(),contents:"export {AdminRefundSettings} from './src/components/admin/AdminRefundSettings';export {AdminRefundActions} from './src/components/admin/AdminRefundActions';"},outfile,bundle:true,format:'esm',platform:'node',packages:'external',plugins:[{name:'ui-fixtures',setup(b){
 b.onResolve({filter:/^react$/},args=>args.importer.replaceAll('\\','/').includes('src/components/')?{path:'hooks',namespace:'fixture'}:undefined);
 b.onResolve({filter:/services\/refundManagementClient$/},()=>({path:'client',namespace:'fixture'}));
 b.onLoad({filter:/.*/,namespace:'fixture'},({path})=>({resolveDir:process.cwd(),contents:path==='hooks'?'import React from "react";export default React;export const useState=v=>globalThis.refundHooks.state(v);export const useRef=v=>globalThis.refundHooks.ref(v);export const useEffect=(f,d)=>globalThis.refundHooks.effect(f,d);':`export const loadRefundSettings=()=>globalThis.refundUi.load();export const saveRefundSettings=(...v)=>globalThis.refundUi.save(...v);export const reviewApprovedRefund=(...v)=>globalThis.refundUi.review(...v);export const confirmApprovedRefund=(...v)=>globalThis.refundUi.confirm(...v);`}));
}}]});
const api=await import(pathToFileURL(outfile).href);const tick=()=>new Promise(r=>setImmediate(r));
function hooks(){const slots=[];let index=0;const effects=[];globalThis.refundHooks={state(v){const i=index++;if(!(i in slots))slots[i]=v;return [slots[i],v=>slots[i]=typeof v==='function'?v(slots[i]):v];},ref(v){const i=index++;return slots[i]??={current:v};},effect(f,d){const i=index++;if(!slots[i]||JSON.stringify(slots[i])!==JSON.stringify(d)){slots[i]=d;effects.push(f);}}};return {render(fn){index=0;return fn();},effects(){effects.splice(0).forEach(f=>f());}};}
function find(tree,predicate){if(!tree||typeof tree!=='object')return null;if(predicate(tree))return tree;return [tree.props?.children].flat(Infinity).map(c=>find(c,predicate)).find(Boolean)||null;}
function text(tree){if(tree==null||typeof tree==='boolean')return '';if(typeof tree==='string'||typeof tree==='number')return String(tree);if(Array.isArray(tree))return tree.map(text).join(' ');return text(tree.props?.children);}
const locked={codeEnabled:false,adminEnabled:false,effectiveEnabled:false,revision:0,updatedAt:null,updatedBy:null};
const enabled={...locked,codeEnabled:true,adminEnabled:true,effectiveEnabled:true,revision:1};
function fixture(settings=locked,state='PENDING') {const calls={save:[],review:[],confirm:[]};globalThis.refundUi={load:async()=>({settings,history:[]}),save:async(...args)=>{calls.save.push(args);return {settings:{...settings,adminEnabled:args[0],effectiveEnabled:args[0]},history:[]};},review:async(...args)=>{calls.review.push(args);return {review:{orderId:args[0],amountPaise:100,paymentId:'pay_fixture',state:'AWAITING_ENABLEMENT',currency:'INR',canExecute:settings.effectiveEnabled,reviewId:settings.effectiveEnabled?'nonce-fixture':undefined,settings,reason:settings.codeEnabled?'ADMIN_REFUNDS_DISABLED':'LIVE_REFUNDS_DISABLED'}};},confirm:async(...args)=>{calls.confirm.push(args);return {order:{id:args[0],refund:{state}}};}};return calls;}
test('settings show locked OFF and disable enablement without exposing execution controls',async()=>{
 const calls=fixture();const h=hooks();let tree=h.render(api.AdminRefundSettings);assert.match(text(tree),/Loading/);h.effects();await tick();tree=h.render(api.AdminRefundSettings);
 assert.match(text(tree),/locked pending security approval/);assert.match(text(tree),/DISABLED/);assert.equal(find(tree,n=>n.props?.role==='switch').props.disabled,true);assert.equal(calls.save.length,0);
});
test('future enablement requires a separate dialog confirmation; toggle alone starts no refunds',async()=>{
 const calls=fixture({...locked,codeEnabled:true});const h=hooks();h.render(api.AdminRefundSettings);h.effects();await tick();let tree=h.render(api.AdminRefundSettings);
 find(tree,n=>n.props?.role==='switch').props.onClick();tree=h.render(api.AdminRefundSettings);const dialog=find(tree,n=>n.props?.title==='Enable LIVE refund execution?');assert.ok(dialog);assert.equal(calls.save.length,0);
 dialog.props.onCancel();tree=h.render(api.AdminRefundSettings);assert.equal(find(tree,n=>n.props?.title==='Enable LIVE refund execution?'),null);
 find(tree,n=>n.props?.role==='switch').props.onClick();tree=h.render(api.AdminRefundSettings);find(tree,n=>n.props?.title==='Enable LIVE refund execution?').props.onConfirm();await tick();tree=h.render(api.AdminRefundSettings);
 assert.deepEqual(calls.save,[[true,0]]);assert.match(text(tree),/No refunds were started/);assert.equal(calls.confirm.length,0);
});
test('locked individual refund is disabled; review remains available and does not execute',async()=>{
 const calls=fixture();const h=hooks();const order={id:'one',refund:{amountPaise:100,state:'AWAITING_ENABLEMENT'}};h.render(()=>api.AdminRefundActions({order}));h.effects();await tick();let tree=h.render(()=>api.AdminRefundActions({order}));
 assert.equal(find(tree,n=>n.type==='button'&&text(n).startsWith('Refund')).props.disabled,true);
 find(tree,n=>n.type==='button'&&text(n).startsWith('Review')).props.onClick();await tick();tree=h.render(()=>api.AdminRefundActions({order}));assert.match(text(tree),/pay_fixture/);assert.equal(calls.confirm.length,0);
});
test('individual refund dialog uses trusted amount/order/payment, cancel sends nothing and duplicate confirmation is single-flight',async()=>{
 const calls=fixture(enabled);const h=hooks();const order={id:'one',refund:{amountPaise:200,state:'AWAITING_ENABLEMENT'}};const render=()=>h.render(()=>api.AdminRefundActions({order}));render();h.effects();await tick();let tree=render();
 find(tree,n=>n.type==='button'&&text(n).startsWith('Refund')).props.onClick();await tick();tree=render();let dialog=find(tree,n=>n.props?.confirmLabel==='Confirm refund now');assert.ok(dialog);assert.match(text(dialog),/one/);assert.match(text(dialog),/pay_fixture/);assert.match(dialog.props.title,/1\.00/);assert.equal(calls.confirm.length,0);
 dialog.props.onCancel();tree=render();assert.equal(find(tree,n=>n.props?.confirmLabel==='Confirm refund now'),null);
 find(tree,n=>n.type==='button'&&text(n).startsWith('Refund')).props.onClick();await tick();tree=render();dialog=find(tree,n=>n.props?.confirmLabel==='Confirm refund now');dialog.props.onConfirm();dialog.props.onConfirm();await tick();tree=render();assert.deepEqual(calls.confirm,[['one','nonce-fixture']]);assert.match(text(tree),/processing/);assert.doesNotMatch(text(tree),/refund successful/i);
});
test('processed, failed and unknown responses display truthful provider outcomes',async()=>{
 for(const [state,expected] of [['PROCESSED',/reports this refund processed/],['FAILED',/reports the refund failed/],['UNKNOWN',/outcome is unknown/],['MANUAL_REVIEW',/requires manual review/]]){
  fixture(enabled,state);const h=hooks();const order={id:'one',refund:{amountPaise:100,state:'AWAITING_ENABLEMENT'}};const render=()=>h.render(()=>api.AdminRefundActions({order}));render();h.effects();await tick();let tree=render();find(tree,n=>n.type==='button'&&text(n).startsWith('Refund')).props.onClick();await tick();tree=render();find(tree,n=>n.props?.confirmLabel==='Confirm refund now').props.onConfirm();await tick();assert.match(text(render()),expected);
 }
});
