import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
const outfile=resolve('node_modules/.cache/product-gallery-unit.mjs');
await build({stdin:{resolveDir:process.cwd(),contents:"export * from './src/utils/productData';export {ProductDetailPage} from './src/components/product/ProductDetailPage';export {ProductEditor} from './src/components/admin/ProductEditor';"},outfile,bundle:true,format:'esm',platform:'node',packages:'external',plugins:[{name:'gallery-fixtures',setup(b){
 b.onResolve({filter:/^react$/},args=>/ProductDetailPage|ProductEditor/.test(args.importer)?{path:'hooks',namespace:'fixture'}:undefined);
 b.onResolve({filter:/context\/StoreContext$/},()=>({path:'context',namespace:'fixture'}));
 b.onResolve({filter:/MediaUploader$/},()=>({path:'upload',namespace:'fixture'}));
 b.onLoad({filter:/.*/,namespace:'fixture'},({path})=>({resolveDir:process.cwd(),contents:{hooks:'import React from "react";export default React;export const useState=v=>globalThis.galleryHooks.state(v);export const useEffect=(f,d)=>globalThis.galleryHooks.effect(f,d);',context:'export const useStore=()=>globalThis.galleryStore;',upload:'export const MediaUploader=()=>null;'}[path]}));
}}]});
const api=await import(pathToFileURL(outfile).href);
const image=name=>`https://res.cloudinary.com/example/image/upload/${name}.jpg`;
const product=extra=>api.normalizeProduct({id:'ab-1789628934256',title:'Cotton Handloom With Print Dress Material',sku:'MEDIA-FIXTURE',category:'Dress Material',stockCount:5,priceINR:1410,...extra});
const affected=()=>product({images:['general1','general2','general3','general4'].map(image),colors:['Navy Blue','Yellow','Green','Safron'].map((colorName,i)=>({colorName,colorHex:'',images:[image(`color${i}`)]}))});
function hooks(){const slots=[];let index=0;globalThis.galleryHooks={state(v){const i=index++;if(!(i in slots))slots[i]=typeof v==='function'?v():v;return [slots[i],v=>slots[i]=typeof v==='function'?v(slots[i]):v];},effect(){index++;}};return {render(fn){index=0;return fn();}};}
function find(tree,p){if(!tree||typeof tree!=='object')return null;if(p(tree))return tree;return [tree.props?.children].flat(Infinity).map(c=>find(c,p)).find(Boolean)||null;}
function store(p){globalThis.galleryStore={products:[p],selectedProductId:p.id,catalogStatus:'ready',categories:[],customer:{},isInWishlist:()=>false,formatPrice:String,cms:{lowStockThreshold:3,contact:{},content:{}}};}
const preview=tree=>find(tree,n=>n.props?.alt==='Cotton Handloom With Print Dress Material'&&n.props?.src);
test('observed existing four-general/four-color record exposes five images for each selected color without mutation',()=>{
 const p=affected(),before=structuredClone(p);
 for(const color of p.colors)assert.deepEqual(api.productImages(p,color.colorName),[...color.images,...p.images]);
 assert.deepEqual(api.productImages(p),p.images);assert.deepEqual(p,before);
});
test('legacy string/newline/upload-object images normalize in order without resave and duplicate URLs are removed',()=>{
 const p=api.productFromDocument('legacy',{data:{images:` ${image('main')}\n${image('other')} `,colors:[{colorName:'Blue',images:[{secure_url:image('blue')},{url:image('other')},{src:image('blue')}]}]}});
 assert.deepEqual(p.images,[image('main'),image('other')]);assert.deepEqual(api.productImages(p,' blue '),[image('blue'),image('other'),image('main')]);
 const single=product({images:{url:image('single')}});assert.deepEqual(single.images,[image('single')]);
});
test('URL validation rejects empty/malformed/unsafe sources while preserving case-sensitive paths and local image assets',()=>{
 assert.deepEqual(api.normalizeImageUrls(['','broken','javascript:alert(1)','data:image/svg+xml,test','//unknown/image.jpg','https://user:password@example.com/a.jpg',null,{},image('A'),image('a'),' /media/a.jpg ','a.jpg',image('A')]),[image('A'),image('a'),'/media/a.jpg','a.jpg']);
});
test('color-only, general+color, duplicate shades, working Payment Test Product and single-image records remain compatible',()=>{
 assert.deepEqual(api.productImages(product({images:[],colors:[{colorName:'Blue',images:[image('blue')]}]})),[image('blue')]);
 assert.deepEqual(api.productImages(product({images:[image('main')],colors:[{colorName:'Blue',images:[]}]}),'Blue'),[image('main')]);
 assert.deepEqual(api.productImages(product({images:[],colors:[{colorName:'Red',images:[image('red')]},{colorName:'Blue',images:[]}]}),'Blue'),[]);
 const duplicate=product({colors:[{colorName:'Blue',images:[image('one')]},{colorName:'blue',images:[image('two')]}]});assert.equal(duplicate.colors.length,1);assert.deepEqual(duplicate.colors[0].images,[image('one'),image('two')]);
 const working=product({id:'ab-1791569135102',title:'Payment Test Product',images:['one','two','three'].map(image),colors:[]});assert.deepEqual(api.productImages(working),working.images);
 assert.deepEqual(api.productImages(product({images:[image('one')],colors:[]})),[image('one')]);
});
test('real product page thumbnail/color selection changes preview and failed URLs are excluded',()=>{
 const p=affected();store(p);const h=hooks();const render=()=>h.render(api.ProductDetailPage);let tree=render();assert.equal(preview(tree).props.src,image('color0'));
 find(tree,n=>n.props?.id==='pdp-thumb-4').props.onClick();tree=render();assert.equal(preview(tree).props.src,image('general4'));assert.equal(find(tree,n=>n.props?.id==='pdp-thumb-4').props['aria-pressed'],true);
 find(tree,n=>typeof n.props?.onColor==='function').props.onColor('Yellow');tree=render();assert.equal(preview(tree).props.src,image('color1'));
 preview(tree).props.onError();tree=render();assert.equal(preview(tree).props.src,image('general1'));assert.equal(find(tree,n=>n.props?.src===image('color1')),null);
 const strip=find(tree,n=>typeof n.props?.className==='string'&&n.props.className.includes('overflow-x-auto'));assert.ok(strip);assert.match(find(tree,n=>n.props?.id==='pdp-thumb-0').props.className,/w-20 sm:w-24/);
});
test('single-image real page has no thumbnail strip and empty imagery stays neutral',()=>{
 for(const images of [[image('single')],[]]){store(product({images,colors:[]}));const h=hooks();const tree=h.render(api.ProductDetailPage);assert.equal(find(tree,n=>n.props?.id==='pdp-thumb-0'),null);}
});
test('actual Admin edit-submit and storage round-trip preserve general/color URLs separately and non-media fields',async()=>{
 const p=affected();p.customField={preserved:true};const h=hooks();let saved;
 const tree=h.render(()=>api.ProductEditor({product:p,categories:[],onCreateCategory:async()=>{},onClose(){},onSave:async v=>{saved=v;}}));
 await find(tree,n=>n.type==='form').props.onSubmit({preventDefault(){}});
 const stored=api.productForStorage(saved),restored=api.productFromDocument(p.id,{data:stored,status:'active'});
 assert.deepEqual(restored.images,p.images);assert.deepEqual(restored.colors,p.colors);assert.equal(restored.priceINR,p.priceINR);assert.equal(restored.stockCount,p.stockCount);assert.equal(restored.category,p.category);assert.deepEqual(restored.customField,p.customField);
});
