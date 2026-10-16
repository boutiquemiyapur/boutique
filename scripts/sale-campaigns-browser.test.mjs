// Isolated real Chrome UI fixtures; no Firebase, uploads or payment SDK.
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {createServer} from 'node:http';
import {spawn} from 'node:child_process';
import {readFileSync,writeFileSync,readdirSync,mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {setTimeout as delay} from 'node:timers/promises';
const cache=resolve('node_modules/.cache/campaign-browser');mkdirSync(cache,{recursive:true});
await build({stdin:{resolveDir:process.cwd(),loader:'tsx',contents:`
 import React,{useState} from 'react';import {createRoot} from 'react-dom/client';
 import {SaleCampaignPage} from './src/components/sales/SaleCampaignPage';import {HeroBanner} from './src/components/home/HeroBanner';import {SaleCampaignManager} from './src/components/admin/SaleCampaignManager';import {ProductDetailPage} from './src/components/product/ProductDetailPage';import {CartPage} from './src/components/cart/CartPage';
 import {useCampaignCatalog} from './src/hooks/useCampaignCatalog';import {normalizeProduct} from './src/utils/productData';import {resolveSalePrice,withSalePrice} from './src/utils/saleCampaigns';import {calculateCheckoutTotals} from './src/utils/checkoutTotals';
 const now=Date.now();const image='/image/general1.svg';
 const diwali={id:'diwali',name:'Diwali Special Sale',slug:'diwali-2026',description:'A selected festival collection.',desktopImage:'http://127.0.0.1:9035/image/general1.svg',mobileImage:'http://127.0.0.1:9035/image/navy.svg',ctaText:'Explore Diwali Offers',startsAt:now-1000,endsAt:now+3600000,status:'published',mode:'percentage',percentage:20,categoryNames:[],displayOrder:0,homepage:true,featured:true,revision:1,assignedCount:2};
 const dussehra={...diwali,id:'dussehra',name:'Dussehra Festive Sale',slug:'dussehra-2026',ctaText:'Shop Dussehra Collection',displayOrder:2,percentage:10};
 const regular=[normalizeProduct({id:'dress',title:'Festive dress',sku:'SALE-A',category:'Dresses',priceINR:1800,originalPriceINR:2000,stockCount:5,images:[image,'/image/general2.svg'],colors:[{colorName:'Red',colorHex:'#ff0000',images:[image]}],availableSizes:['S']}),normalizeProduct({id:'saree',title:'Cotton saree',sku:'SALE-B',category:'Sarees',priceINR:1000,originalPriceINR:1500,stockCount:0,images:[image]})];
 const products=regular.map(p=>withSalePrice(p,resolveSalePrice(p,[diwali,dussehra],{diwali:{},...(p.id==='dress'?{dussehra:{}}:{})},now)));
 globalThis.campaignActions=[];let savedCampaign;let assignments=[];
 globalThis.campaignAdminMock=async body=>{campaignActions.push(body);if(body.action==='list')return {campaigns:savedCampaign?[savedCampaign]:[],cursor:null,now};if(body.action==='assignments')return {assignments,cursor:null};if(body.action==='save'){savedCampaign={...body.campaign,id:body.id,status:'draft',revision:body.revision+1,assignedCount:assignments.length};return {campaign:savedCampaign};}if(body.action==='assign'){for(const row of body.changes){assignments=assignments.filter(a=>a.productId!==row.productId);if(!row.remove)assignments.push(row);}savedCampaign={...savedCampaign,revision:body.revision+1,assignedCount:assignments.length};return {campaign:savedCampaign};}if(body.action==='transition'){savedCampaign={...savedCampaign,status:body.status,revision:body.revision+1};return {campaign:savedCampaign};}throw Error('Unexpected fixture action');};
 function Fixture(){const initial=new URLSearchParams(location.search).get('kind')||'home';const [view,setView]=useState(initial);const [slug,setSlug]=useState(initial==='sale'?'diwali-2026':null);const [status,setStatus]=useState('ready');const [saved,setSaved]=useState(false);const [selected,setSelected]=useState('dress');const [priceTick,setPriceTick]=useState(0);globalThis.refreshPrice=()=>setPriceTick(v=>v+1);
 const navigate=(view,id)=>{setView(view==='product-detail'?'detail':view);if(view==='sale'){setSlug(id||null);history.pushState({},'',id?'/sale/'+id:'/sale');}if(view==='product-detail')setSelected(id);};
 globalThis.fixtureStatus=setStatus;globalThis.fixtureNavigate=navigate;
 const displayed=products.map(p=>({...p,priceINR:p.priceINR+priceTick}));const cart=[{cartItemId:'one',product:displayed[0],selectedColor:'Red',selectedSize:'S',quantity:2,isCustomTailored:false,tailoringFeeINR:0}];const totals=calculateCheckoutTotals(cart,null,[{id:'delivery',name:'Delivery',type:'fixed',value:50,enabled:true,sortOrder:0}]);
 globalThis.galleryStore={products:displayed,saleCampaigns:[diwali,dussehra],saleSlug:slug,catalogStatus:status,categories:[],selectedProductId:selected,customer:{},cms:{lowStockThreshold:3,content:{homeEyebrow:'Festival collections'},contact:{},banners:[]},navigate,formatPrice:v=>'INR '+v,isInWishlist:()=>saved,toggleWishlist:()=>setSaved(v=>!v),loadProductReviews:async()=>[],showToast(){},authStatus:'authenticated',isCustomerDataReady:true,requireAuth(){},setQuickViewProduct:p=>navigate('product-detail',p.id),addToCart:async(p,color,size)=>{globalThis.addedProduct={p,color,size};return true;},buyNow(){},cart,cartIssue:null,cartSubtotalINR:totals.subtotalINR,cartTailoringTotalINR:0,cartDiscountINR:0,cartCharges:totals.charges,cartTotalINR:totals.totalINR,removeFromCart(){},adjustCartQuantity(){},shoppingStatus:'ready'};
 return view==='home'?<HeroBanner/>:view==='sale'?<SaleCampaignPage key={slug}/>:view==='detail'?<ProductDetailPage/>:view==='cart'?<CartPage/>:<SaleCampaignManager products={regular} categories={[{id:'dresses',name:'Dresses',isActive:true}]}/>;}
 function HookFixture(){const data=useCampaignCatalog(regular);return <div role='status'>{data.status}:{data.products[0].priceINR}:{data.campaigns.length}</div>;}
 createRoot(document.getElementById('root')).render(new URLSearchParams(location.search).get('kind')==='hook'?<HookFixture/>:<Fixture/>);
 `},outfile:resolve(cache,'fixture.js'),bundle:true,platform:'browser',format:'esm',plugins:[{name:'local-store',setup(b){
 b.onResolve({filter:/firebase\/config$/},()=>({path:'firebase',namespace:'fixture'}));b.onResolve({filter:/context\/StoreContext$/},()=>({path:'store',namespace:'fixture'}));b.onResolve({filter:/services\/saleCampaignClient$/},()=>({path:'campaigns',namespace:'fixture'}));b.onResolve({filter:/services\/cmsRepository$/},()=>({path:'cms',namespace:'fixture'}));
 b.onLoad({filter:/.*/,namespace:'fixture'},({path})=>({contents:path==='firebase'?'export const isFirebaseEnabled=true;export const firebaseAuth=null;':path==='store'?'export const useStore=()=>globalThis.galleryStore;':path==='campaigns'?'export const campaignAdmin=body=>globalThis.campaignAdminMock(body);':'export const cmsRepository={};'}));
 }}]});
const css=readdirSync('dist/assets').find(name=>name.endsWith('.css'));assert.ok(css,'Run Production build before browser checks');
let hookEnds=Date.now()+1500,hookError=false;
const server=createServer((req,res)=>{
 if(req.url.startsWith('/fixture/reset')){hookEnds=Date.now()+1500;hookError=false;return res.end('ok');}
 if(req.url.startsWith('/fixture/error')){hookError=true;return res.end('ok');}
 if(req.url==='/api/sales'){
  res.setHeader('Content-Type','application/json');if(hookError){res.statusCode=503;return res.end('{}');}
  const active=Date.now()<hookEnds;const campaign={id:'hook',name:'Timed offer',slug:'timed-offer',startsAt:0,endsAt:hookEnds,status:'published'};
  if(req.method==='GET')return res.end(JSON.stringify({campaigns:active?[campaign]:[],now:Date.now()}));
  return res.end(JSON.stringify({prices:{dress:{priceINR:active?1440:1800,regularPriceINR:1800,saleCampaignIds:active?['hook']:[],...(active?{saleCampaign:{id:'hook',name:'Timed offer',slug:'timed-offer',endsAt:hookEnds}}:{})},saree:{priceINR:1000,regularPriceINR:1000,saleCampaignIds:[]}},now:Date.now()}));
 }

 if(req.url==='/image/broken.svg'){res.statusCode=404;return res.end();}
 if(req.url.startsWith('/image/')){res.setHeader('Content-Type','image/svg+xml');return res.end(`<svg xmlns="http://www.w3.org/2000/svg" width="600" height="800"><rect width="600" height="800" fill="${req.url.includes('yellow')?'#f3cd48':req.url.includes('navy')?'#223f75':'#b9aba1'}"/><text x="30" y="70" font-size="30">${req.url.slice(7)}</text></svg>`);}
 if(req.url==='/fixture.js'){res.setHeader('Content-Type','text/javascript');return res.end(readFileSync(resolve(cache,'fixture.js')));}
 if(req.url==='/style.css'){res.setHeader('Content-Type','text/css');return res.end(readFileSync(resolve('dist/assets',css)));}
 res.setHeader('Content-Type','text/html');res.end('<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/style.css"><div id="root"></div><script type="module" src="/fixture.js"></script>');
});await new Promise(r=>server.listen(9035,'127.0.0.1',r));
const executable=process.env.GALLERY_BROWSER_EXECUTABLE||'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const profile=resolve(cache,`profile-${Date.now()}`);
const browser=spawn(executable,['--headless=new','--remote-debugging-port=0',`--user-data-dir=${profile}`,'--disable-background-networking','--disable-extensions','--no-first-run','--no-default-browser-check','about:blank'],{windowsHide:true,stdio:'ignore'});
let socket;const pending=new Map();let seq=0;
try{
 let targets;for(let i=0;i<60;i++){try{const port=Number(readFileSync(resolve(profile,'DevToolsActivePort'),'utf8').split('\n')[0]);targets=await(await fetch(`http://127.0.0.1:${port}/json/list`)).json();break;}catch{await delay(100);}}assert.ok(targets,'Isolated browser did not start');
 socket=new WebSocket(targets.find(t=>t.type==='page').webSocketDebuggerUrl);await new Promise((r,j)=>{socket.addEventListener('open',r,{once:true});socket.addEventListener('error',j,{once:true});});
 socket.addEventListener('message',event=>{const m=JSON.parse(String(event.data));const p=pending.get(m.id);if(p){pending.delete(m.id);m.error?p.reject(Error(m.error.message)):p.resolve(m.result);}});
 const command=(method,params={})=>new Promise((resolve,reject)=>{const id=++seq;pending.set(id,{resolve,reject});socket.send(JSON.stringify({id,method,params}));});
 const evaluate=async expression=>{const result=await command('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});assert.equal(result.exceptionDetails,undefined);return result.result.value;};
 await command('Page.enable');await command('Network.enable');await command('Network.setBlockedURLs',{urls:['https://*']});
 const wait=async expression=>{for(let i=0;i<100;i++){if(await evaluate(expression))return;await delay(50);}assert.fail('Fixture condition did not settle: '+expression);};


 const click=async label=>{await evaluate(`(()=>{const button=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()===${JSON.stringify(label)});if(!button)throw Error('Missing button: '+${JSON.stringify(label)});button.click();})()`);await delay(80);};
 const field=label=>`[...document.querySelectorAll('label')].find(e=>e.firstChild.textContent.trim()===${JSON.stringify(label)}).querySelector('input,select,textarea')`;
 const setField=async(label,value)=>{await evaluate(`(()=>{const input=${field(label)};Object.getOwnPropertyDescriptor(input.tagName==='SELECT'?HTMLSelectElement.prototype:input.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:HTMLInputElement.prototype,'value').set.call(input,${JSON.stringify(value)});input.dispatchEvent(new Event(input.tagName==='SELECT'?'change':'input',{bubbles:true}));})()`);await delay(80);};
 for(const width of [1280,390]){
  await command('Emulation.setDeviceMetricsOverride',{width,height:960,deviceScaleFactor:1,mobile:width<500});
  await fetch('http://127.0.0.1:9035/fixture/reset');await command('Page.navigate',{url:'http://127.0.0.1:9035/?kind=hook'});await wait("document.body.textContent.includes('ready:1440:1')");await wait("document.body.textContent.includes('ready:1800:0')");
  await fetch('http://127.0.0.1:9035/fixture/error');await evaluate("document.dispatchEvent(new Event('visibilitychange'))");await wait("document.body.textContent.includes('error:1800:0')");
  await command('Page.navigate',{url:'http://127.0.0.1:9035/?kind=home'});await wait("document.body.textContent.includes('Explore Diwali Offers')");
  await evaluate("document.querySelector('button[aria-label=\"Open Diwali Special Sale collection\"]').click()");await wait("location.pathname==='/sale/diwali-2026'&&document.querySelector('input[aria-label=\"Search sale products\"]')!==null");
  assert.equal(await evaluate("document.body.textContent.includes('INR 1440')&&document.body.textContent.includes('28%')"),true);
  assert.equal(await evaluate('document.documentElement.scrollWidth<=innerWidth'),true);
  await evaluate("document.querySelector('button[aria-label=\"Save Festive dress to wishlist\"]').click()");await wait("document.querySelector('button[aria-label=\"Remove Festive dress from wishlist\"]')?.getAttribute('aria-pressed')==='true'");
  let shot=await command('Page.captureScreenshot',{format:'png'});writeFileSync(resolve(cache,`sale-${width}.png`),Buffer.from(shot.data,'base64'));
  await evaluate("(()=>{const input=document.querySelector('input[aria-label=\"Search sale products\"]');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,'SALE-B');input.dispatchEvent(new Event('input',{bubbles:true}));})()");await wait("document.body.textContent.includes('1 products')&&!document.body.textContent.includes('Festive dress')");
  await evaluate("document.querySelector('label input[type=checkbox]').click()");await wait("document.body.textContent.includes('No products match these filters.')");
  await evaluate("fixtureNavigate('sale','dussehra-2026')");await wait("document.querySelector('h1')?.textContent==='Dussehra Festive Sale'");assert.equal(await evaluate("document.body.textContent.includes('INR 1440')"),true);
  await click('Festive dress');await wait("document.body.textContent.includes('You save INR 560')");
  await evaluate("document.querySelector('#pdp-thumb-1').click()");await wait("document.querySelector('img[alt=\"Festive dress\"]').getAttribute('src')==='/image/general2.svg'");await evaluate("refreshPrice()");await delay(80);assert.equal(await evaluate("document.querySelector('img[alt=\"Festive dress\"]').getAttribute('src')"),'/image/general2.svg');await evaluate("refreshPrice()");
  await click('Red');await click('S');await evaluate("document.querySelector('#pdp-add-to-cart-btn').click()");await wait("globalThis.addedProduct?.p.priceINR===1442&&globalThis.addedProduct.size==='S'");
  await evaluate("fixtureNavigate('cart')");await wait("document.body.textContent.includes('INR 2934')");assert.equal(await evaluate("document.body.textContent.includes('INR 2884')"),true);
  await evaluate("fixtureNavigate('sale','missing')");await wait("document.body.textContent.includes('ended or is unavailable')");
  await evaluate("fixtureStatus('error')");await wait("document.querySelector('[role=alert]')!==null");await evaluate("fixtureStatus('loading')");await wait("document.body.textContent.includes('Loading festival')");
  await command('Page.navigate',{url:'http://127.0.0.1:9035/?kind=admin'});await wait("document.body.textContent.includes('Create campaign')");await click('Create campaign');
  await setField('Campaign name','Future Festival');await setField('Unique URL slug','future-festival');await setField('Desktop banner URL','https://fixtures.invalid/banner.jpg');
  await setField('Pricing mode','percentage');await setField('Campaign discount %','20');
  await evaluate("document.querySelector('input[aria-label=\"Select Festive dress\"]').click()");await delay(80);await click('Preview campaign');assert.equal(await evaluate("document.body.textContent.includes('Private preview')&&document.body.textContent.includes('INR 1440')"),true);
  await click('Save and publish');await wait("document.body.textContent.includes('Campaign published.')");
  assert.equal(await evaluate("campaignActions.some(a=>a.action==='assign'&&a.changes[0].productId==='dress')&&campaignActions.some(a=>a.action==='transition'&&a.status==='published')"),true);
  assert.equal(await evaluate('document.documentElement.scrollWidth<=innerWidth'),true);
  shot=await command('Page.captureScreenshot',{format:'png'});writeFileSync(resolve(cache,`admin-${width}.png`),Buffer.from(shot.data,'base64'));
 }
 console.log('Desktop/mobile campaign browser checks passed (including actual catalog-hook API hydration, expiry and failure): banner image routing, Dussehra/Diwali collections, overlap price/MRP badge, search, variants, cart totals, unavailable/error/loading states, admin selection/preview/save/publish and overflow.');
 await command('Browser.close');
}finally{socket?.close();browser.kill();await new Promise(r=>server.close(r));}
