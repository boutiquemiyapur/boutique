// Local real-browser fixtures only: no Firebase, external images or payment SDK.
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {createServer} from 'node:http';
import {spawn} from 'node:child_process';
import {readFileSync,writeFileSync,readdirSync,mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {setTimeout as delay} from 'node:timers/promises';
const cache=resolve('node_modules/.cache/gallery-browser');mkdirSync(cache,{recursive:true});
await build({stdin:{resolveDir:process.cwd(),loader:'tsx',contents:`
 import React from 'react';import {createRoot} from 'react-dom/client';import {ProductDetailPage} from './src/components/product/ProductDetailPage';import {normalizeProduct} from './src/utils/productData';
 const kind=new URLSearchParams(location.search).get('kind');
 const product=normalizeProduct({id:'browser-'+kind,title:'Gallery browser fixture',sku:'FIXTURE',category:'Dress Material',priceINR:1410,stockCount:5,images:kind==='single'?['/image/one.svg']:kind==='broken'?['/image/broken.svg','/image/general2.svg']:kind==='empty'?['/image/broken.svg']:['/image/general1.svg','/image/general2.svg','/image/general3.svg','/image/general4.svg'],colors:kind==='colors'?[{colorName:'Navy Blue',colorHex:'#000080',images:['/image/navy.svg']},{colorName:'Yellow',colorHex:'#ffff00',images:['/image/yellow.svg']}]:[]});
 globalThis.galleryStore={products:[product],selectedProductId:product.id,catalogStatus:'ready',categories:[],customer:{},isInWishlist:()=>false,formatPrice:v=>'INR '+v,cms:{lowStockThreshold:3,contact:{},content:{}},loadProductReviews:async()=>[],toggleWishlist(){},navigate(){},showToast(){},addToCart(){},buyNow(){}};
 createRoot(document.getElementById('root')).render(<ProductDetailPage/>);
 `},outfile:resolve(cache,'fixture.js'),bundle:true,platform:'browser',format:'esm',plugins:[{name:'local-store',setup(b){b.onResolve({filter:/context\/StoreContext$/},()=>({path:'store',namespace:'fixture'}));b.onLoad({filter:/.*/,namespace:'fixture'},()=>({contents:'export const useStore=()=>globalThis.galleryStore;'}));}}]});
const css=readdirSync('dist/assets').find(name=>name.endsWith('.css'));assert.ok(css,'Run Production build before browser checks');
const server=createServer((req,res)=>{
 if(req.url==='/image/broken.svg'){res.statusCode=404;return res.end();}
 if(req.url.startsWith('/image/')){res.setHeader('Content-Type','image/svg+xml');return res.end(`<svg xmlns="http://www.w3.org/2000/svg" width="600" height="800"><rect width="600" height="800" fill="${req.url.includes('yellow')?'#f3cd48':req.url.includes('navy')?'#223f75':'#b9aba1'}"/><text x="30" y="70" font-size="30">${req.url.slice(7)}</text></svg>`);}
 if(req.url==='/fixture.js'){res.setHeader('Content-Type','text/javascript');return res.end(readFileSync(resolve(cache,'fixture.js')));}
 if(req.url==='/style.css'){res.setHeader('Content-Type','text/css');return res.end(readFileSync(resolve('dist/assets',css)));}
 res.setHeader('Content-Type','text/html');res.end('<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/style.css"><div id="root"></div><script type="module" src="/fixture.js"></script>');
});await new Promise(r=>server.listen(9033,'127.0.0.1',r));
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
 for(const width of [1280,390]){
  await command('Emulation.setDeviceMetricsOverride',{width,height:960,deviceScaleFactor:1,mobile:width<500});
  await command('Page.navigate',{url:'http://127.0.0.1:9033/?kind=colors'});await wait("document.querySelectorAll('[id^=pdp-thumb-]').length===5 && [...document.images].every(i=>i.complete)");
  assert.equal(await evaluate('document.documentElement.scrollWidth<=innerWidth'),true);
  await evaluate("document.querySelector('#pdp-thumb-4').click()");await wait("document.querySelector('img[alt=\"Gallery browser fixture\"]').getAttribute('src')==='/image/general4.svg'");
  await evaluate("[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Yellow').click()");await wait("document.querySelector('img[alt=\"Gallery browser fixture\"]').getAttribute('src')==='/image/yellow.svg'");
  assert.equal(await evaluate("document.querySelectorAll('[id^=pdp-thumb-]').length"),5);
  if(width===390)assert.equal(await evaluate("(()=>{const row=document.querySelector('#pdp-thumb-0').parentElement;return row.scrollWidth>row.clientWidth&&getComputedStyle(row).overflowX==='auto';})()"),true);
  const screenshot=await command('Page.captureScreenshot',{format:'png'});writeFileSync(resolve(cache,`gallery-${width}.png`),Buffer.from(screenshot.data,'base64'));
  await command('Page.navigate',{url:'http://127.0.0.1:9033/?kind=single'});await wait("document.querySelector('img[alt=\"Gallery browser fixture\"]')?.getAttribute('src')==='/image/one.svg'");assert.equal(await evaluate("document.querySelectorAll('[id^=pdp-thumb-]').length"),0);
  await command('Page.navigate',{url:'http://127.0.0.1:9033/?kind=broken'});await wait("document.querySelector('img[alt=\"Gallery browser fixture\"]')?.getAttribute('src')==='/image/general2.svg' && !document.querySelector('[id^=pdp-thumb-]')");
  await command('Page.navigate',{url:'http://127.0.0.1:9033/?kind=empty'});await wait("document.body.textContent.includes('Image unavailable') && !document.querySelector('img[alt=\"Gallery browser fixture\"]')");
 }
 console.log('Desktop 1280px and mobile 390px real-browser gallery, thumbnail/color switching, single image, broken-image fallback, empty image and overflow checks passed.');
 await command('Browser.close');
}finally{socket?.close();browser.kill();await new Promise(r=>server.close(r));}
