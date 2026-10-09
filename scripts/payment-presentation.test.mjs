import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { readFileSync } from 'node:fs';
const outfile = resolve('node_modules/.cache/payment-presentation.mjs');
await build({ stdin: { resolveDir: process.cwd(), contents: `
export * from './src/utils/paymentState'; export * from './src/utils/orderReporting';
import React from 'react'; import {renderToStaticMarkup} from 'react-dom/server';
import {OrderStatusBadge} from './src/components/common/OrderStatusBadge';
import {PageLoading,ButtonProgress} from './src/components/common/Loading';
export {LoadingFeedback} from './src/components/common/Loading';
import {PrivateLoading,DetailsSkeleton,ProductGridSkeleton,AdminSkeleton} from './src/components/common/Skeleton';
import {AdminOrders} from './src/components/admin/AdminOrders';
import {CustomerAccountPage} from './src/components/account/CustomerAccountPage';
export const account=(orders,selectedId=null)=>{globalThis.presentationStateSlot=0;globalThis.presentationSelectedId=selectedId;globalThis.presentationStore={orders,customer:{fullName:'Fixture customer',email:'fixture@example.com',phone:'9999999999',savedAddresses:[]},wishlist:[],products:[],formatPrice:String};return renderToStaticMarkup(React.createElement(CustomerAccountPage));};
export const badge=order=>renderToStaticMarkup(React.createElement(OrderStatusBadge,{order}));
export const admin=orders=>renderToStaticMarkup(React.createElement(AdminOrders,{orders,formatPrice:String,error:null,onUpdate:async()=>{}}));
export const loader=()=>renderToStaticMarkup(React.createElement(PageLoading));
export const skeleton=variant=>renderToStaticMarkup(React.createElement(PrivateLoading,{variant}));
export const products=()=>renderToStaticMarkup(React.createElement(ProductGridSkeleton));
export const details=()=>renderToStaticMarkup(React.createElement(DetailsSkeleton));
export const dashboard=()=>renderToStaticMarkup(React.createElement(AdminSkeleton,{dashboard:true}));
export const button=()=>renderToStaticMarkup(React.createElement(ButtonProgress,null,'Saving changes'));
` }, outfile, bundle: true, format: 'esm', platform: 'node', packages: 'external', plugins: [{name:'read-only-presentation-fixtures',setup(b){
  b.onResolve({filter:/context\/StoreContext$/},()=>({path:'context',namespace:'fixture'}));
  b.onResolve({filter:/firebase\/config$/},()=>({path:'firebase',namespace:'fixture'}));
  b.onResolve({filter:/^react$/},args=>/CustomerAccountPage/.test(args.importer)?{path:'account-hooks',namespace:'fixture'}:/common[\\/]Loading/.test(args.importer)?{path:'loading-hooks',namespace:'fixture'}:undefined);
  b.onLoad({filter:/.*/,namespace:'fixture'},({path})=>({resolveDir:process.cwd(),contents:{
    context:'export const useStore=()=>globalThis.presentationStore;',
    firebase:'export const firebaseAuth={currentUser:null};',
    'account-hooks':`import React from 'react'; export default React; export const useRef=React.useRef;export const useEffect=React.useEffect;export const useState=initial=>{const slot=globalThis.presentationStateSlot++;return React.useState(slot===0?'orders':slot===6?globalThis.presentationSelectedId:initial)};`,
    'loading-hooks':`import React from 'react';export default React;export const useState=v=>globalThis.loadingHooks?globalThis.loadingHooks.state(v):React.useState(v);export const useEffect=(f,d)=>globalThis.loadingHooks?globalThis.loadingHooks.effect(f):React.useEffect(f,d);`,
  }[path]}));
}}] });
const api = await import(pathToFileURL(outfile).href);
const pending = {id:'fixture-order',orderNumber:'AB-FIXTURE',orderStatus:'Order Placed',paymentMethod:'razorpay',paymentProvider:'razorpay',paymentStatus:'PAYMENT_PENDING',shippingAddress:{fullName:'Fixture customer',email:'fixture@example.com'},items:[],totalINR:1350,subtotalINR:1350,charges:[],createdAt:new Date().toISOString(),timeline:[]};
const paid = {...pending,paymentStatus:'PAID',razorpayOrderId:'order_fixture',razorpayPaymentId:'pay_fixture',amountPaise:135000,currency:'INR',paidAt:new Date().toISOString(),paymentVerifiedAt:new Date().toISOString(),paymentReviewRequired:false};

test('customer badges and admin summaries consistently gate unpaid fulfilment presentation',()=>{
  for(const [status,label] of [['PAYMENT_PENDING','Verifying Payment'],['AUTHORIZED','Verifying Payment'],['FAILED','Payment Failed'],['EXPIRED','Payment Expired'],['CREATED','Payment Incomplete']]){
    const order={...pending,paymentStatus:status,orderStatus:'Delivered'};
    assert.equal(api.fulfilmentEligible(order),false); assert.equal(api.completedSale(order),false); assert.equal(api.capturedRevenue(order),0);
    assert.match(api.badge(order),new RegExp(label));
    const admin=api.admin([order]); assert.match(admin,new RegExp(label));
    assert.doesNotMatch(admin,/<span[^>]*>Delivered<\/span>|>Order Placed<\/span>|PAYMENT_PENDING/);
    assert.match(admin,/<select disabled=""/);
  }
});

test('captured success, review holds, and refunds have distinct truthful labels and revenue',()=>{
  assert.equal(api.paymentPresentation(paid).label,'Payment Successful'); assert.equal(api.orderDisplayStatus(paid),'Order Confirmed');
  assert.equal(api.fulfilmentEligible(paid),true); assert.equal(api.completedSale({...paid,orderStatus:'Delivered'}),true);
  assert.equal(api.capturedRevenue(paid),1350);
  for(const [status,label,refunded] of [['REFUND_PENDING','Refund Processing',0],['PARTIALLY_REFUNDED','Partially Refunded',50000],['REFUNDED','Refunded',135000]]){
    const order={...paid,paymentStatus:status,refundedAmountPaise:refunded};
    assert.equal(api.paymentPresentation(order).label,label); assert.equal(api.fulfilmentEligible(order),false);
    assert.equal(api.capturedRevenue(order),(135000-refunded)/100); assert.equal(api.paymentGroup(order),'refund');
  }
  assert.equal(api.paymentPresentation({...paid,paymentReviewRequired:true}).label,'Payment Under Review');
  assert.equal(api.fulfilmentEligible({...paid,paymentReviewRequired:true}),false);
});

test('dismissal is feedback only; delayed trusted capture overrides unpaid evidence without rewriting it',()=>{
  const snapshot=JSON.stringify(pending);
  const result=api.checkoutFeedback({kind:'dismissed',order:pending}); assert.equal(result.title,'Payment Cancelled'); assert.equal(result.navigate,false);
  assert.match(result.message,/may still arrive/); assert.equal(api.orderDisplayStatus(pending),'Verifying Payment'); assert.equal(JSON.stringify(pending),snapshot);
  assert.equal(api.preferPaymentOrder(paid,pending),paid); assert.equal(api.orderDisplayStatus(api.preferPaymentOrder(pending,paid)),'Order Confirmed');
});

test('older unpaid records stay unconfirmed and historical COD remains distinct',()=>{
  const older={...pending,paymentProvider:undefined}; assert.notEqual(api.orderDisplayStatus(older),'Order Placed'); assert.equal(api.fulfilmentEligible(older),false);
  const cod={...pending,paymentMethod:'cod',paymentProvider:undefined,paymentStatus:'Pending'};
  assert.equal(api.orderDisplayStatus(cod),'Cash on Delivery'); assert.equal(api.completedSale({...cod,orderStatus:'Delivered'}),false);
  assert.equal(api.capturedRevenue(cod),0);
});

test('admin search/filters and exports use shared labels, safe CSV, and current snapshots',()=>{
  const failed={...pending,id:'failed',paymentStatus:'FAILED'},refund={...paid,id:'refund',paymentStatus:'REFUNDED',refundedAmountPaise:135000};
  const orders=[pending,paid,failed,refund];
  assert.deepEqual(api.filterOrders(orders,'','paid'),[paid]); assert.deepEqual(api.filterOrders(orders,'','unpaid'),[pending,failed]);
  assert.deepEqual(api.filterOrders(orders,'Verifying Payment','all'),[pending]); assert.deepEqual(api.filterOrders(orders,'','refund'),[refund]);
  const csv=api.ordersCsv([{...pending,shippingAddress:{...pending.shippingAddress,fullName:'=malicious()'}}]);
  assert.match(csv,/Verifying Payment/); assert.doesNotMatch(csv,/PAYMENT_PENDING|Order Placed/); assert.match(csv,/'=malicious\(\)/);
});

test('initialization, product/order/detail loading and buttons render accessible nonblank feedback',()=>{
  assert.match(api.loader(),/AB Collection by Aadya|Opening the boutique/); assert.match(api.loader(),/role="status"/);
  for(const variant of ['account','orders','cart','wishlist','checkout']) {const html=api.skeleton(variant);assert.match(html,/Loading/);assert.match(html,/aria-busy="true"/);assert.match(html,/aria-hidden="true"/);}
  for(const html of [api.products(),api.details(),api.dashboard()])assert.match(html,/boutique-pulse/);
  assert.match(api.button(),/Saving changes/);assert.match(api.button(),/aria-hidden="true"/);
});

test('CSS provides moderate transitions and reduced-motion overrides without blocking layout',()=>{
  const css=readFileSync('src/index.css','utf8'); assert.match(css,/boutique-enter 200ms/); assert.match(css,/boutique-spin 900ms/);
  assert.match(css,/@media \(prefers-reduced-motion: reduce\)[\s\S]*animation: none !important/);
});

test('account history and open order details use current listener records, including delayed capture and missing IDs',()=>{
  const initial=api.account([pending],pending.id);assert.match(initial,/Verifying Payment/);assert.doesNotMatch(initial,/PAYMENT_PENDING|>Order Placed</);
  const captured=api.account([paid],paid.id);assert.match(captured,/Payment Successful/);assert.match(captured,/Order Confirmed/);
  const missing=api.account([paid],'missing-order');const dialog=missing.slice(missing.indexOf('role="dialog"'));assert.match(dialog,/no longer available/);assert.doesNotMatch(dialog,/Payment Successful|AB-FIXTURE/);
});

test('slow loading offers recovery and navigation/unmount clears its feedback timer',t=>{
  t.mock.timers.enable({apis:['setTimeout']});let state=false,cleanup;
  globalThis.loadingHooks={state:()=>[state,value=>state=value],effect:fn=>cleanup=fn()};
  try{api.LoadingFeedback({label:'Loading orders'});t.mock.timers.tick(15000);assert.equal(state,true);cleanup();state=false;api.LoadingFeedback({label:'Loading orders'});cleanup();t.mock.timers.tick(15000);assert.equal(state,false);}
  finally{delete globalThis.loadingHooks;t.mock.timers.reset();}
});
