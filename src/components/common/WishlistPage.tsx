import React from 'react';
import { Heart } from 'lucide-react';
import { useStore } from '../../context/StoreContext';
import { ProductCard } from './ProductCard';

export const WishlistPage: React.FC = () => {
  const { navigate, products, wishlist } = useStore();
  const savedProducts = products.filter((product) => wishlist.includes(product.id));
  return <section className="min-h-screen bg-[#fffdf9] px-4 py-12 sm:px-7"><div className="mx-auto max-w-[1440px]"><div className="border-b border-[#ddd7cf] pb-6"><p className="text-[10px] uppercase tracking-[.2em] text-stone-500">My selections</p><h1 className="mt-2 font-serif text-4xl sm:text-5xl">Your wishlist</h1><p className="mt-2 text-sm text-stone-600">{savedProducts.length} {savedProducts.length === 1 ? 'piece' : 'pieces'} saved for later.</p></div>{savedProducts.length ? <div className="mt-9 grid grid-cols-2 gap-x-4 gap-y-9 sm:grid-cols-3 sm:gap-x-6 xl:grid-cols-4">{savedProducts.map((product) => <ProductCard key={product.id} product={product} />)}</div> : <div className="mt-10 border border-dashed border-[#cfc6bd] bg-[#f7f5f2] px-6 py-20 text-center"><Heart className="mx-auto h-7 w-7 text-stone-400" /><h2 className="mt-4 font-serif text-3xl">Your wishlist is waiting for something beautiful.</h2><p className="mx-auto mt-3 max-w-md text-sm leading-6 text-stone-600">Save styles you would like to revisit, then continue whenever the moment feels right.</p><button onClick={() => navigate('shop')} className="mt-7 border border-[#2c2926] px-6 py-3 text-[11px] font-semibold uppercase tracking-[.12em] transition hover:bg-[#2c2926] hover:text-white">Explore collections</button></div>}</div></section>;
};
