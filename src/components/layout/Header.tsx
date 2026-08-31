import React, { useMemo, useState } from 'react';
import { Heart, Menu, Search, ShoppingBag, User, X } from 'lucide-react';
import { useStore } from '../../context/StoreContext';
import { BrandMark } from '../../config/brand';
import { CurrencySelector } from '../common/CurrencySelector';

const iconButton = 'relative grid h-10 w-10 place-items-center text-stone-700 transition hover:bg-stone-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#625e59]';

export const Header: React.FC = () => {
  const { navigate, setFilters, products, wishlist, cart, requireAuth, setIsCartDrawerOpen, setIsWishlistDrawerOpen } = useStore();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [search, setSearch] = useState('');
  const collections = useMemo(() => [...new Set(products.map((product) => product.category))].filter(Boolean).sort(), [products]);
  const itemCount = cart.reduce((total, item) => total + item.quantity, 0);
  const goToCollection = (category: string) => { setFilters((current) => ({ ...current, category, searchQuery: '' })); navigate('shop'); setIsMenuOpen(false); };
  const goToNewArrivals = () => { setFilters((current) => ({ ...current, category: 'All', sortBy: 'newest', searchQuery: '' })); navigate('shop'); setIsMenuOpen(false); };
  const closeMenuThen = (action: () => void) => () => { action(); setIsMenuOpen(false); };
  const submitSearch = (event: React.FormEvent) => { event.preventDefault(); setFilters((current) => ({ ...current, category: 'All', searchQuery: search })); navigate('shop'); setIsSearchOpen(false); };
  const NavLink = ({ view, children }: { view: 'home' | 'shop' | 'about' | 'contact'; children: React.ReactNode }) => <button onClick={() => navigate(view)} className="relative py-2 text-[11px] font-medium uppercase tracking-[.14em] text-stone-600 transition hover:text-[#2c2926] after:absolute after:inset-x-0 after:-bottom-0.5 after:h-px after:origin-left after:scale-x-0 after:bg-[#625e59] after:transition hover:after:scale-x-100">{children}</button>;

  return <header className="sticky top-0 z-40 border-b border-[#ddd7cf] bg-[#fffdf9]/95 backdrop-blur">
    <div className="mx-auto hidden max-w-[1440px] grid-cols-[1fr_auto_1fr] items-center px-7 py-2 lg:grid">
      <div><button onClick={() => navigate('home')} aria-label="AB Collection home" className="inline-flex items-center"><BrandMark className="h-14 w-14 sm:h-16 sm:w-16" /></button></div>
      <nav className="flex items-center gap-8" aria-label="Primary navigation"><NavLink view="home">Home</NavLink><NavLink view="shop">Shop</NavLink><NavLink view="about">About Us</NavLink><NavLink view="contact">Contact</NavLink></nav>
      <div className="flex items-center justify-end gap-1"><CurrencySelector isCompact /><button onClick={() => setIsSearchOpen((open) => !open)} className={iconButton} aria-label="Search"><Search className="h-4 w-4" /></button><button onClick={() => requireAuth('account')} className={iconButton} aria-label="Account"><User className="h-4 w-4" /></button><button onClick={() => setIsWishlistDrawerOpen(true)} className={iconButton} aria-label="Wishlist"><Heart className="h-4 w-4" />{wishlist.length > 0 && <Count value={wishlist.length} />}</button><button onClick={() => setIsCartDrawerOpen(true)} className={iconButton} aria-label="Shopping bag"><ShoppingBag className="h-4 w-4" />{itemCount > 0 && <Count value={itemCount} />}</button></div>
    </div>
    <div className="mx-auto grid max-w-[1440px] grid-cols-[1fr_auto_1fr] items-center px-3 py-2 lg:hidden">
      <button onClick={() => setIsMenuOpen(true)} className={`${iconButton} justify-self-start`} aria-label="Open menu"><Menu className="h-5 w-5" /></button>
      <button onClick={() => navigate('home')} aria-label="AB Collection home" className="inline-flex items-center"><BrandMark className="h-12 w-12" /></button>
      <div className="flex justify-self-end gap-0.5"><button onClick={() => setIsWishlistDrawerOpen(true)} className={iconButton} aria-label="Wishlist"><Heart className="h-4 w-4" />{wishlist.length > 0 && <Count value={wishlist.length} />}</button><button onClick={() => setIsCartDrawerOpen(true)} className={iconButton} aria-label="Shopping bag"><ShoppingBag className="h-4 w-4" />{itemCount > 0 && <Count value={itemCount} />}</button></div>
    </div>
    {isSearchOpen && <form onSubmit={submitSearch} className="border-t border-[#ddd7cf] px-4 py-3"><div className="mx-auto flex max-w-[1440px] items-center gap-3"><Search className="h-4 w-4 text-stone-400" /><label className="sr-only" htmlFor="site-search">Search AB Collection</label><input id="site-search" autoFocus value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search styles, fabric or SKU" className="min-w-0 flex-1 bg-transparent py-2 text-sm outline-none" /><button type="button" onClick={() => setIsSearchOpen(false)} className="text-[11px] font-semibold uppercase tracking-[.12em] text-stone-500 hover:text-stone-950">Close</button></div></form>}
    {isMenuOpen && <div className="fixed inset-0 z-50 bg-black/35 lg:hidden" onClick={() => setIsMenuOpen(false)}><aside onClick={(event) => event.stopPropagation()} className="h-full w-[min(86vw,360px)] overflow-y-auto bg-[#fffdf9] p-6 shadow-2xl"><div className="flex items-center justify-between border-b border-[#ddd7cf] pb-5"><BrandMark className="h-14 w-14" /><button onClick={() => setIsMenuOpen(false)} className={iconButton} aria-label="Close menu"><X className="h-5 w-5" /></button></div><button onClick={() => { setIsMenuOpen(false); setIsSearchOpen(true); }} className="mt-6 flex w-full items-center gap-3 border-b border-[#eee8e2] py-3 text-left text-xs font-semibold uppercase tracking-[.12em]"><Search className="h-4 w-4" />Search</button><nav className="mt-2 space-y-1"><DrawerLink onClick={closeMenuThen(() => navigate('home'))}>Home</DrawerLink><DrawerLink onClick={closeMenuThen(() => navigate('shop'))}>Shop</DrawerLink><DrawerLink onClick={closeMenuThen(() => navigate('about'))}>About Us</DrawerLink><DrawerLink onClick={closeMenuThen(() => navigate('contact'))}>Contact</DrawerLink><DrawerLink onClick={goToNewArrivals}>New Arrivals</DrawerLink><DrawerLink onClick={closeMenuThen(() => requireAuth('account'))}>My Account</DrawerLink><DrawerLink onClick={closeMenuThen(() => navigate('order-tracking'))}>Track an Order</DrawerLink></nav>{collections.length > 0 && <div className="mt-7 border-t border-[#ddd7cf] pt-5"><p className="text-[10px] font-semibold uppercase tracking-[.15em] text-stone-500">Collections</p><div className="mt-2">{collections.map((category) => <div key={category}><DrawerLink onClick={() => goToCollection(category)}>{category}</DrawerLink></div>)}</div></div>}<div className="mt-8 border-t border-[#ddd7cf] pt-4"><CurrencySelector /></div></aside></div>}
  </header>;
};

const Count = ({ value }: { value: number }) => <span className="absolute right-0.5 top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-[#2c2926] px-1 text-[8px] text-white">{value}</span>;
const DrawerLink = ({ onClick, children }: { onClick: () => void; children: React.ReactNode }) => <button onClick={onClick} className="block w-full border-b border-[#eee8e2] py-3 text-left text-xs font-medium uppercase tracking-[.12em] text-stone-700 transition hover:text-black">{children}</button>;
