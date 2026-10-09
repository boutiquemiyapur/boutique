import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

// Execute the real provider, repository and image component with deterministic
// hook/auth/Firestore boundaries. No remote account or database is contacted.
const outfile=resolve('node_modules/.cache/shopping-ux-tests.mjs');
await build({stdin:{resolveDir:process.cwd(),contents:`
export {StoreProvider} from './src/context/StoreContext';
export {commerceRepository} from './src/services/commerceRepository';
export {ProductImage} from './src/components/common/ProductImage';
export {positionNavigation,useNavigationScroll} from './src/hooks/useNavigationScroll';
import React from 'react'; import {renderToStaticMarkup} from 'react-dom/server';
import {HomeSkeleton,ProductGridSkeleton,PrivateLoading} from './src/components/common/Skeleton';
import {Header} from './src/components/layout/Header';
export const header=()=>renderToStaticMarkup(React.createElement(Header));
import {StorefrontHomePage} from './src/components/home/StorefrontHomePage';
export const skeleton=()=>renderToStaticMarkup(React.createElement(HomeSkeleton));
export const privateError=()=>renderToStaticMarkup(React.createElement(PrivateLoading,{error:true}));
export const home=()=>renderToStaticMarkup(React.createElement(StorefrontHomePage));
`},outfile,bundle:true,format:'esm',platform:'node',packages:'external',plugins:[{name:'shopping-boundaries',setup(b){
b.onResolve({filter:/^react$/},args=> /StoreContext|ProductImage|useNavigationScroll/.test(args.importer)?{path:'hooks',namespace:'fixture'}:undefined);
b.onResolve({filter:/context\/StoreContext$/},args=> /StorefrontHomePage|FeaturedGrid|HeroBanner|CustomTailoringBanner|Header/.test(args.importer)?{path:'context',namespace:'fixture'}:undefined);
b.onResolve({filter:/firebase\/auth$/},()=>({path:'auth',namespace:'fixture'}));
b.onResolve({filter:/firebase\/config$/},()=>({path:'config',namespace:'fixture'}));
b.onResolve({filter:/services\/paymentClient$/},()=>({path:'payments',namespace:'fixture'}));
b.onResolve({filter:/services\/cmsRepository$/},()=>({path:'cms',namespace:'fixture'}));
b.onResolve({filter:/^firebase\/firestore$/},()=>({path:'db',namespace:'fixture'}));
b.onLoad({filter:/.*/,namespace:'fixture'},({path})=>({resolveDir:process.cwd(),contents:({
hooks:`export const createContext=()=>({Provider:'provider'}); export const useState=(v)=>globalThis.hooks.state(v); export const useRef=(v)=>globalThis.hooks.ref(v); export const useEffect=(f,d)=>globalThis.hooks.effect(f,d); export const useLayoutEffect=(f,d)=>globalThis.hooks.effect(f,d); export const useMemo=(f)=>{globalThis.hooks.index++;return f()}; export const useContext=()=>{}; export default {createContext,useState,useRef,useEffect,useMemo,useContext};`,
context:`export const useStore=()=>globalThis.viewStore;`,
auth:`export const startAuthSession=(fn)=>{globalThis.authCallback=fn;return ()=>{}}; export const logoutFirebaseUser=async()=>{globalThis.authCallback(null)}; export const authErrorMessage=(e)=>e.message; export const signInWithEmail=async()=>{}; export const registerWithEmail=async()=>{}; export const requestPasswordReset=async()=>{};`,
payments:`export {confirmedPayment} from './src/utils/paymentState'; export const stableCheckout=(uid,r)=>globalThis.paymentMock.stableCheckout(uid,r); export const checkoutBusinessRequest=(...args)=>globalThis.paymentMock.checkoutBusinessRequest(...args); export const paymentApi=(...args)=>globalThis.paymentMock.paymentApi(...args); export const openPayment=(...args)=>globalThis.paymentMock.openPayment(...args);`,
config:`export const firestore={}; export const firebaseAuth={currentUser:null};`,
cms:`export const DEFAULT_CMS={checkoutCharges:[],lowStockThreshold:3,banners:[],content:{},contact:{}}; export const cmsRepository={loadPublicCms:async()=>DEFAULT_CMS,subscribeToStoreSettings:()=>()=>{},subscribeToCategories:()=>()=>{},};`,
db:`export const doc=(_, ...parts)=>({path:parts.join('/')}); export const collection=doc; export const collectionGroup=doc; export const query=(ref)=>ref; export const where=()=>{}; export const serverTimestamp=()=>null;
export const getDoc=async(ref)=>globalThis.database.snapshot(ref.path); export const getDocs=async()=>({docs:[]});
export const onSnapshot=(ref,fn,error)=>globalThis.database.listen(ref.path,fn,error);
export const runTransaction=(_,fn)=>globalThis.database.transaction(fn);
export const setDoc=async(ref,data)=>globalThis.database.put(ref.path,data);
export const deleteDoc=()=>{}; export const updateDoc=()=>{};`
})[path]}));}}]});
const api=await import(pathToFileURL(outfile).href);
const product=(id)=>({id,sku:id,title:id,priceINR:100,category:'Sarees',images:[],colors:[],availableSizes:[],stockCount:25,isActive:true,tags:[],specifications:[],reviews:[],fabric:'',occasion:'',rating:0,reviewCount:0,customStitchingFeeINR:0});
const line=(id,quantity=1)=>({cartItemId:id,product:product(id),selectedColor:'',selectedSize:'',quantity,isCustomTailored:false,tailoringFeeINR:0});
function initialize(){
 const slots=[]; const cleanups=[]; let effects=[];
 globalThis.hooks={index:0,state(initial){const i=this.index++;if(!(i in slots))slots[i]=typeof initial==='function'?initial():initial;return [slots[i],v=>{slots[i]=typeof v==='function'?v(slots[i]):v}];},ref(initial){const i=this.index++;return slots[i]??=( {current:initial});},effect(fn,deps){const i=this.index++;const prior=slots[i];if(!prior||!deps||deps.some((v,n)=>v!==prior[n])){slots[i]=deps;effects.push(()=>{cleanups[i]?.();cleanups[i]=fn();});}}};
 const records=new Map(); const listeners=new Map(); let tail=Promise.resolve();
 globalThis.database={records,listeners,fail:false,snapshot(path){return {data:()=>records.get(path),exists:()=>records.has(path),metadata:{hasPendingWrites:false},docs:path==='products'?[{id:'a',data:()=>({data:product('a')})},{id:'b',data:()=>({data:product('b')})}]:[]};},listen(path,fn,error){const entry={fn,error};const entries=listeners.get(path)||new Set();entries.add(entry);listeners.set(path,entries);queueMicrotask(()=>{if(entries.has(entry))fn(this.snapshot(path))});return ()=>entries.delete(entry);},put(path,data){if(this.fail)throw Error('fixture denied');records.set(path,{...records.get(path),...data});for(const entry of listeners.get(path)||[])entry.fn(this.snapshot(path));},transaction(fn){const execute=async()=>{if(this.fail)throw Error('fixture denied');const staged=[];const result=await fn({get:async ref=>this.snapshot(ref.path),set:(ref,data)=>staged.push([ref.path,data])});for(const [path,data] of staged)this.put(path,data);return result;};const pending=tail.then(execute);tail=pending.catch(()=>{});return pending;}};
 globalThis.window={location:{pathname:'/'},history:{pushState(){},replaceState(){}},scrollTo(){}};
 globalThis.document={documentElement:{style:{}},querySelector:()=>null};
 let store;
 const render=()=>{hooks.index=0;store=api.StoreProvider({children:null}).props.value;const run=effects;effects=[];run.forEach(fn=>fn());return store;};
 const flush=async()=>{for(let i=0;i<6;i++){await new Promise(r=>setImmediate(r));render();}return store;};
 render();
 return {render,flush,runEffects:()=>{const run=effects;effects=[];run.forEach(fn=>fn());},session:async uid=>{authCallback(uid?{uid,email:uid+'@example.com',displayName:uid,isAdmin:false}:null);return flush();},cleanup:()=>cleanups.forEach(fn=>fn?.())};
}
test('auth initialization and guests have no private counts; shopping actions require login',async()=>{
 const h=initialize();let s=await h.flush();assert.equal(s.authStatus,'loading');assert.deepEqual(s.cart,[]);assert.deepEqual(s.wishlist,[]);
 s=await h.session(null);assert.equal(await s.addToCart(product('a'),'',''),false);s=h.render();assert.equal(s.activeView,'login');assert.equal(s.cart.length,0);
 assert.equal(await s.toggleWishlist('a'),false);assert.equal(await s.buyNow(product('a'),'',''),false);assert.equal(database.records.size,0);h.cleanup();
});
test('login resumes one intended add with current auth; refresh restores normalized quantities',async()=>{
 let h=initialize();let s=await h.session(null);await s.addToCart(product('a'),'','',2);s=await h.session('A');await h.flush();s=h.render();assert.equal(s.cart.reduce((n,i)=>n+i.quantity,0),2);assert.equal(database.records.get('carts/A').items.length,1);
 assert.equal(await s.addToCart(product('a'),'',''),false);s=await h.flush();assert.equal(s.cart[0].quantity,2);
 await s.updateCartQuantity(s.cart[0].cartItemId,3);s=await h.flush();assert.equal(s.cart[0].quantity,3);
 const saved=structuredClone(database.records.get('carts/A'));h.cleanup();h=initialize();database.records.set('carts/A',saved);s=await h.session('A');assert.equal(s.cart[0].quantity,3);await s.removeFromCart(s.cart[0].cartItemId);s=await h.flush();assert.equal(s.cart.length,0);h.cleanup();
});
test('concurrent additions and different hearts preserve both Firestore changes',async()=>{
 const h=initialize();let s=await h.session('A');await Promise.all([s.addToCart(product('a'),'','',2),s.addToCart(product('b'),'','',1)]);s=await h.flush();assert.equal(s.cart.reduce((n,i)=>n+i.quantity,0),3);
 await Promise.all([s.toggleWishlist('a'),s.toggleWishlist('b'),s.toggleWishlist('a')]);s=await h.flush();assert.deepEqual([...s.wishlist].sort(),['a','b']);assert.equal(database.records.get('wishlists/A').productIds.length,2);
 await s.toggleWishlist('a');s=await h.flush();assert.deepEqual(s.wishlist,['b']);await s.clearCart();s=await h.flush();assert.equal(s.cart.length,0);h.cleanup();
});
test('write failures never leave false UI counts or selected hearts',async()=>{
 const h=initialize();let s=await h.session('A');database.fail=true;assert.equal(await s.addToCart(product('a'),'',''),false);assert.equal(await s.toggleWishlist('a'),false);s=await h.flush();assert.deepEqual(s.cart,[]);assert.deepEqual(s.wishlist,[]);assert.ok(s.toasts.some(t=>t.type==='error'));h.cleanup();
});
test('logout clears immediately; Account B and stale callbacks cannot see Account A',async()=>{
 const h=initialize();let s=await h.session('A');await s.addToCart(product('a'),'','',2);await s.toggleWishlist('a');s=await h.flush();const stale=[...database.listeners.get('carts/A')][0].fn;
 const promise=s.logout();s=h.render();assert.deepEqual(s.cart,[]);assert.deepEqual(s.wishlist,[]);await promise;s=await h.session('B');assert.deepEqual(s.cart,[]);assert.deepEqual(s.wishlist,[]);stale(database.snapshot('carts/A'));s=h.render();assert.deepEqual(s.cart,[]);assert.equal(database.listeners.get('carts/A').size,0);h.cleanup();
});
test('confirmed external shopping snapshots update counts; listener failure produces retry state',async()=>{
 const h=initialize();let s=await h.session('A');database.put('carts/A',{items:[line('a',2),line('b',1)]});database.put('wishlists/A',{productIds:['a','a','b']});s=await h.flush();assert.equal(s.cart.reduce((n,i)=>n+i.quantity,0),3);assert.equal(s.wishlist.length,2);
 [...database.listeners.get('carts/A')][0].error(Error('offline'));s=h.render();assert.equal(s.privateDataError,true);assert.equal(s.isCustomerDataReady,false);assert.deepEqual(s.cart,[]);assert.match(api.privateError(),/Retry/);h.cleanup();
});
test('checkout positioning subtracts current sticky header on desktop and mobile, immediately',()=>{
 for(const height of [104,64]){let result;window.scrollY=900;window.scrollTo=value=>result=value;document.querySelector=()=>({getBoundingClientRect:()=>({height})});api.positionNavigation({getBoundingClientRect:()=>({top:-500})});assert.deepEqual(result,{top:400-height-12,behavior:'auto'});api.positionNavigation();assert.deepEqual(result,{top:0,behavior:'auto'});}
});
test('checkout step forward/back and route navigation schedule one committed immediate reposition',()=>{
 const h=initialize();let pending;globalThis.requestAnimationFrame=fn=>{pending=fn;return 1};globalThis.cancelAnimationFrame=()=>{pending=null};let scroll;window.scrollY=900;window.scrollTo=v=>scroll=v;document.querySelector=selector=>selector==='[data-store-header]'?{getBoundingClientRect:()=>({height:64})}:{getBoundingClientRect:()=>({top:-500})};
 for(const step of [1,2,3,2,1]){hooks.index=100;api.useNavigationScroll(step,'[data-checkout-top]');h.runEffects();pending();assert.deepEqual(scroll,{top:324,behavior:'auto'});}
 h.cleanup();
});
test('image loading clears placeholder, source changes reset it, failures show neutral fallback',()=>{
 const slots=[];globalThis.hooks={index:0,state(initial){const i=this.index++;if(!(i in slots))slots[i]=typeof initial==='function'?initial():initial;return [slots[i],v=>{slots[i]=typeof v==='function'?v(slots[i]):v}];}};const render=props=>{hooks.index=0;return api.ProductImage(props)};
 let image=render({src:'one',alt:'Product',className:'aspect-[3/4]'});assert.match(image.props.className,/boutique-pulse/);image.props.onLoad({});image=render({src:'one',alt:'Product'});assert.doesNotMatch(image.props.className,/boutique-pulse/);image=render({src:'two',alt:'Product'});assert.match(image.props.className,/boutique-pulse/);image.props.onError({});image=render({src:'two',alt:'Product'});assert.equal(image.props.children,'Image unavailable');image=render({src:'one',alt:'Product'});assert.doesNotMatch(image.props.className,/boutique-pulse/);
});
test('home loading, ready-empty and error are distinct; skeletons respect reduced motion',()=>{
 globalThis.viewStore={products:[],categories:[],navigate(){},setFilters(){},showToast(){},catalogStatus:'loading'};assert.match(api.home(),/Loading the boutique/);assert.match(api.skeleton(),/boutique-pulse/);assert.match(api.skeleton(),/aria-hidden="true"/);
 viewStore.catalogStatus='error';assert.match(api.home(),/Retry/);assert.doesNotMatch(api.home(),/Loading the boutique/);
 viewStore.catalogStatus='ready';viewStore.cms={banners:[],content:{},contact:{}};assert.match(api.home(),/No products are available/);assert.doesNotMatch(api.home(),/Loading the boutique/);
});

test('desktop and mobile header badges derive total quantity and unique saved products',()=>{
 globalThis.viewStore={authStatus:'authenticated',cart:[line('a',2),line('b',1)],wishlist:['a','a','b'],products:[],categories:[],navigate(){},setFilters(){},requireAuth(){}};
 const html=api.header();assert.equal((html.match(/Shopping bag, 3 items/g)||[]).length,2);assert.equal((html.match(/Wishlist, 2 saved products/g)||[]).length,2);
 viewStore.authStatus='unauthenticated';viewStore.cart=[];viewStore.wishlist=[];const guest=api.header();assert.match(guest,/Shopping bag, 0 items/);assert.doesNotMatch(guest,/bg-\[#17335c\]/);
});

test('guest heart and Buy Now each open login independently; heart resumes once',async()=>{
 let h=initialize();let s=await h.session(null);assert.equal(await s.toggleWishlist('a'),false);s=h.render();assert.equal(s.activeView,'login');assert.equal(s.isInWishlist('a'),false);s=await h.session('A');s=await h.flush();assert.deepEqual(s.wishlist,['a']);h.cleanup();
 h=initialize();s=await h.session(null);assert.equal(await s.buyNow(product('a'),'',''),false);s=h.render();assert.equal(s.activeView,'login');s=await h.session('A');s=await h.flush();assert.equal(s.activeView,'checkout');assert.equal(s.cart.length,1);assert.equal(await s.buyNow(product('a'),'',''),true);s=await h.flush();assert.equal(s.cart.length,1);h.cleanup();
});
test('direct Account A to B switch clears UI before B hydration and rejects stale action handlers',async()=>{
 const h=initialize();let s=await h.session('A');await s.addToCart(product('a'),'','');await s.toggleWishlist('a');s=await h.flush();const stale=s;
 authCallback({uid:'B',email:'B@example.com',isAdmin:false});s=h.render();assert.equal(s.isCustomerDataReady,false);assert.deepEqual(s.cart,[]);assert.deepEqual(s.wishlist,[]);assert.equal(await stale.addToCart(product('b'),'',''),false);s=await h.flush();assert.equal(s.authSession.uid,'B');assert.deepEqual(s.cart,[]);assert.deepEqual(s.wishlist,[]);h.cleanup();
});
test('pending local Firestore snapshots do not expose an unconfirmed wishlist count',async()=>{
 const h=initialize();let s=await h.session('A');const listener=[...database.listeners.get('wishlists/A')][0].fn;listener({data:()=>({productIds:['a']}),metadata:{hasPendingWrites:true}});s=h.render();assert.deepEqual(s.wishlist,[]);h.cleanup();
});

const pendingPayment={id:'pay-integration',orderNumber:'AB-INTEGRATION',createdAt:new Date().toISOString(),shippingAddress:{fullName:'Fixture'},items:[],charges:[],timeline:[],paymentMethod:'razorpay',paymentProvider:'razorpay',paymentStatus:'PAYMENT_PENDING',totalINR:100};
const capturedPayment={...pendingPayment,paymentStatus:'PAID',currency:'INR',amountPaise:10000,razorpayOrderId:'order_integration',razorpayPaymentId:'pay_integration',paidAt:new Date().toISOString(),paymentVerifiedAt:new Date().toISOString(),paymentReviewRequired:false};
function paymentFixture(openPayment){globalThis.localStorage={length:0};globalThis.paymentMock={stableCheckout:async(_uid,r)=>({...r,intentId:'integration-intent'}),checkoutBusinessRequest:()=>({}),paymentApi:async()=>({order:pendingPayment,checkout:{}}),openPayment};}
function emitPayment(value){for(const entry of database.listeners.get('orders')||[])entry.fn({docs:[{data:()=>({data:value})}]});}
test('real store dismissal preserves cart and newer delayed webhook capture without client financial writes',async()=>{
 const h=initialize();let s=await h.session('A');await s.addToCart(product('a'),'','');s=await h.flush();let release;paymentFixture(()=>new Promise(r=>release=r));
 const promise=s.createOrder({},'standard','razorpay');await new Promise(r=>setImmediate(r));emitPayment(capturedPayment);s=h.render();assert.equal(s.currentOrder.paymentStatus,'PAID');release({kind:'dismissed',order:pendingPayment});assert.equal((await promise).kind,'dismissed');s=await h.flush();assert.equal(s.currentOrder.paymentStatus,'PAID');assert.equal(s.cart.length,1);assert.equal(database.records.has('orders/pay-integration'),false);h.cleanup();
});
test('real store receives webhook confirmation after dismissal and does not clear the preserved bag',async()=>{
 const h=initialize();let s=await h.session('A');await s.addToCart(product('a'),'','');s=await h.flush();paymentFixture(async()=>({kind:'dismissed',order:pendingPayment}));await s.createOrder({},'standard','razorpay');s=await h.flush();assert.equal(s.currentOrder.paymentStatus,'PAYMENT_PENDING');emitPayment(capturedPayment);s=await h.flush();assert.equal(s.currentOrder.paymentStatus,'PAID');assert.equal(s.cart.length,1);h.cleanup();
});
test('real store clears cart only for captured server evidence; pending/error preserve it',async()=>{
 for(const outcome of [{kind:'pending',order:pendingPayment},{kind:'error',order:pendingPayment,message:'failed'},{kind:'confirmed',order:capturedPayment}]){
 const h=initialize();let s=await h.session('A');await s.addToCart(product('a'),'','');s=await h.flush();paymentFixture(async()=>outcome);const result=await s.createOrder({},'standard','razorpay');assert.equal(result.kind,outcome.kind);s=await h.flush();assert.equal(s.cart.length,outcome.kind==='confirmed'?0:1);h.cleanup();}
});

test('profile save waits for persistence, reports no false success on failure, and ignores a stale account completion',async()=>{
 const h=initialize();let s=await h.session('A');const original=api.commerceRepository.saveProfile;let reject,resolve;
 try{
  api.commerceRepository.saveProfile=()=>new Promise((ok,no)=>{resolve=ok;reject=no;});
  const name=s.customer.fullName;const failed=s.updateCustomerProfile({fullName:'New name'});const assertion=assert.rejects(failed,/fixture write denied/);
  assert.equal(h.render().customer.fullName,name);reject(Error('fixture write denied'));await assertion;
  assert.equal(h.render().customer.fullName,name);assert.equal(h.render().toasts.some(t=>t.title==='Profile Updated'),false);
  const stale=s.updateCustomerProfile({fullName:'Account A update'});await h.session('B');const other=h.render().customer.fullName;resolve();await stale;assert.equal(h.render().customer.fullName,other);
 }finally{api.commerceRepository.saveProfile=original;h.cleanup();}
});
