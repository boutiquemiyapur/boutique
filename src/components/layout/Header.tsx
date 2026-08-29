import React, { useState } from 'react';
import { Heart, Menu, Search, ShoppingBag, User, X } from 'lucide-react';
import { useStore } from '../../context/StoreContext';

export const Header: React.FC = () => {
  const { cart, wishlist, navigate, requireAuth, setFilters, setIsCartDrawerOpen, setIsWishlistDrawerOpen } = useStore();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [search, setSearch] = useState('');
  const itemCount = cart.reduce((sum, item) => sum + item.quantity, 0);
  const collections = ['Kanjeevaram Silks', 'Banarasi Sarees', 'Bridal Lehengas', 'Designer Sarees'];
  const goToCollection = (category: string) => { setFilters((current) => ({ ...current, category: category as any, searchQuery: '' })); navigate('shop'); setIsMenuOpen(false); };
  const submitSearch = (event: React.FormEvent) => { event.preventDefault(); if (search.trim()) { setFilters((current) => ({ ...current, category: 'All', searchQuery: search.trim() })); navigate('shop'); setSearch(''); } };
  return <header className="sticky top-0 z-40 border-b border-[#ddd7cf] bg-[#fffdf9]/95 backdrop-blur">
    <div className="mx-auto flex max-w-[1440px] items-center justify-between px-4 py-3 sm:px-7">
      <button onClick={() => setIsMenuOpen(true)} className="p-1 lg:hidden" aria-label="Open menu"><Menu className="h-5 w-5" /></button>
      <button onClick={() => navigate('home')} className="font-serif text-lg tracking-tight sm:text-xl">MIYAPUR BOUTIQUE</button>
      <nav className="hidden items-center gap-6 text-[11px] text-stone-600 lg:flex"><button onClick={() => navigate('shop')}>Shop</button><button onClick={() => goToCollection('Kanjeevaram Silks')}>Collections</button><button onClick={() => { setFilters((current) => ({ ...current, sortBy: 'newest' })); navigate('shop'); }}>New Arrivals</button></nav>
      <div className="flex items-center gap-2 text-stone-600"><form onSubmit={submitSearch} className="hidden items-center border-b border-stone-300 md:flex"><Search className="h-3.5 w-3.5" /><input value={search} onChange={(event) => setSearch(event.target.value)} className="w-24 bg-transparent px-2 py-1 text-[11px]" placeholder="Search" /></form><button onClick={() => requireAuth('account')} className="p-1.5" aria-label="Account"><User className="h-4 w-4" /></button><button onClick={() => setIsWishlistDrawerOpen(true)} className="relative p-1.5" aria-label="Wishlist"><Heart className="h-4 w-4" />{wishlist.length > 0 && <span className="absolute -right-1 -top-1 grid h-3.5 w-3.5 place-items-center bg-[#625e59] text-[8px] text-white">{wishlist.length}</span>}</button><button onClick={() => setIsCartDrawerOpen(true)} className="relative p-1.5" aria-label="Shopping bag"><ShoppingBag className="h-4 w-4" />{itemCount > 0 && <span className="absolute -right-1 -top-1 grid h-3.5 w-3.5 place-items-center bg-[#625e59] text-[8px] text-white">{itemCount}</span>}</button></div>
    </div>
    {isMenuOpen && <div className="fixed inset-0 z-50 bg-black/30 lg:hidden" onClick={() => setIsMenuOpen(false)}><div className="h-full w-[300px] bg-[#fffdf9] p-6 shadow-2xl" onClick={(event) => event.stopPropagation()}><div className="flex items-center justify-between border-b border-stone-200 pb-5"><span className="font-serif text-lg">MIYAPUR BOUTIQUE</span><button onClick={() => setIsMenuOpen(false)}><X /></button></div><form onSubmit={submitSearch} className="mt-5 flex border border-stone-300"><input value={search} onChange={(event) => setSearch(event.target.value)} className="min-w-0 flex-1 p-3 text-xs" placeholder="Search the collection" /><button className="p-3"><Search className="h-4 w-4" /></button></form><div className="mt-6 space-y-1"><button onClick={() => { navigate('shop'); setIsMenuOpen(false); }} className="block w-full px-2 py-3 text-left text-xs">All products</button>{collections.map((collection) => <button key={collection} onClick={() => goToCollection(collection)} className="block w-full px-2 py-3 text-left text-xs">{collection}</button>)}<button onClick={() => { navigate('order-tracking'); setIsMenuOpen(false); }} className="block w-full px-2 py-3 text-left text-xs">Track order</button><button onClick={() => { navigate('admin'); setIsMenuOpen(false); }} className="block w-full px-2 py-3 text-left text-xs">Admin portal</button></div></div></div>}
  </header>;
};
