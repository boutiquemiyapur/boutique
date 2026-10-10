import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
assert.equal(process.env.FIRESTORE_EMULATOR_HOST,'127.0.0.1:8189','Only the dedicated local demo emulator is allowed.');
const outfile=resolve('node_modules/.cache/shopping-emulator-tests.mjs');
await build({stdin:{resolveDir:process.cwd(),contents:`export {commerceRepository} from './src/services/commerceRepository'; export {firestore} from './src/firebase/config';`},outfile,bundle:true,format:'esm',platform:'node',packages:'external',plugins:[{name:'local-demo-only',setup(b){b.onResolve({filter:/firebase\/config$/},()=>({path:'local',namespace:'fixture'}));b.onLoad({filter:/.*/,namespace:'fixture'},()=>({resolveDir:process.cwd(),contents:`import {initializeApp} from 'firebase/app'; import {getFirestore,connectFirestoreEmulator} from 'firebase/firestore'; const app=initializeApp({projectId:'demo-ab-payments',apiKey:'demo-only'},'shopping-local-tests'); export const firestore=getFirestore(app); connectFirestoreEmulator(firestore,'127.0.0.1',8189,{mockUserToken:{sub:'shopping-local',user_id:'shopping-local'}}); export const firebaseAuth={currentUser:null};`}));}}]});
const {commerceRepository:repo,firestore}=await import(pathToFileURL(outfile).href);
const {terminate}=await import('firebase/firestore');
const uid='shopping-local';
const line=id=>({cartItemId:id,product:{id,sku:id,title:id},selectedColor:'',selectedSize:'',quantity:1,isCustomTailored:false});
try {
 await repo.mutateCart(uid,()=>[]); await repo.mutateWishlist(uid,()=>[]);
 await Promise.all([repo.mutateCart(uid,items=>[...items,line('a')]),repo.mutateCart(uid,items=>[...items,line('b')])]);
 const restored=await repo.mutateCart(uid,items=>items);assert.equal(restored.length,2);
 await Promise.all([repo.mutateWishlist(uid,ids=>[...ids,'a']),repo.mutateWishlist(uid,ids=>[...ids,'b','a'])]);
 const saved=await repo.mutateWishlist(uid,ids=>ids);assert.deepEqual(saved.sort(),['a','b']);
 let stop;let timer;
 await new Promise((resolve,reject)=>{let cart=false,wishlist=false;timer=setTimeout(()=>reject(Error('Snapshot timeout')),10000);stop=repo.subscribeToShopping(uid,items=>{cart=items.length===2;if(cart&&wishlist)resolve();},ids=>{wishlist=ids.length===2;if(cart&&wishlist)resolve();},reject);});clearTimeout(timer);stop();
 await assert.rejects(repo.mutateCart('another-account',()=>[]));
 await repo.mutateCart(uid,()=>[]);await repo.mutateWishlist(uid,()=>[]);
 // Competing clients use the same transaction guard as Add to Bag. No increment.
 const variant=(size,color='Red')=>({...line('v'),cartItemId:size+color,selectedSize:size,selectedColor:color});
 const same=(a,b)=>a.product.id===b.product.id&&a.selectedSize===b.selectedSize&&a.selectedColor===b.selectedColor;
 const add=item=>repo.mutateCart(uid,items=>items.some(old=>same(old,item))?items:[...items,item]);
 await Promise.all([add(variant('XS')),add(variant('XS')),add(variant('XS'))]);
 await Promise.all([add(variant('S')),add(variant('XS','Blue'))]);
 const variants=await repo.mutateCart(uid,items=>items);assert.equal(variants.length,3);assert.equal(variants.reduce((n,i)=>n+i.quantity,0),3);
 await repo.mutateCart(uid,items=>items.map(item=>item.selectedSize==='S'?{...item,quantity:2}:item));
 await add(variant('S'));assert.equal((await repo.mutateCart(uid,items=>items)).find(item=>item.selectedSize==='S').quantity,2);
 await repo.mutateCart(uid,()=>[]);
 console.log('Real Firestore shopping transactions, concurrent mutations, unique IDs, restoration, confirmed listeners and cross-account denial passed.');
} finally { await terminate(firestore); }
