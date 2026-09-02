import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Heart, Menu, Search, ShoppingBag, User, X } from 'lucide-react';
import { useStore } from '../../context/StoreContext';
import { BrandMark } from '../../config/brand';
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock';

const iconButton = 'relative grid h-10 w-10 place-items-center text-stone-700 transition hover:bg-stone-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#625e59]';

export const Header: React.FC = () => {
  const { navigate, setFilters, products, wishlist, cart, requireAuth, setIsCartDrawerOpen, setIsWishlistDrawerOpen } = useStore();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [search, setSearch] = useState('');
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const previouslyFocusedElement = useRef<HTMLElement | null>(null);

  const collections = useMemo(() => [...new Set(products.map((product) => product.category))].filter(Boolean).sort(), [products]);
  const closeMenu = () => setIsMenuOpen(false);
  const goToCollection = (category: string) => { setFilters((current) => ({ ...current, category, searchQuery: '' })); navigate('shop'); closeMenu(); };
  const goToNewArrivals = () => { setFilters((current) => ({ ...current, category: 'All', sortBy: 'newest', searchQuery: '' })); navigate('shop'); closeMenu(); };
  const closeMenuThen = (action: () => void) => () => { action(); closeMenu(); };
  const submitSearch = (event: React.FormEvent) => { event.preventDefault(); setFilters((current) => ({ ...current, category: 'All', searchQuery: search })); navigate('shop'); setIsSearchOpen(false); };

  useBodyScrollLock(isMenuOpen);

  useEffect(() => {
    if (!isMenuOpen) return;
    const desktopViewport = window.matchMedia('(min-width: 1024px)');
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') closeMenu(); };
    const closeOnDesktop = (event: MediaQueryListEvent) => { if (event.matches) closeMenu(); };

    previouslyFocusedElement.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    window.addEventListener('keydown', closeOnEscape);
    desktopViewport.addEventListener('change', closeOnDesktop);
    closeButtonRef.current?.focus();
    if (desktopViewport.matches) closeMenu();

    return () => {
      window.removeEventListener('keydown', closeOnEscape);
      desktopViewport.removeEventListener('change', closeOnDesktop);
      previouslyFocusedElement.current?.focus();
      previouslyFocusedElement.current = null;
    };
  }, [isMenuOpen]);

  const NavLink = ({ view, children }: { view: 'home' | 'shop' | 'about' | 'contact'; children: React.ReactNode }) => <button onClick={() => navigate(view)} className="relative py-2 text-[11px] font-medium uppercase tracking-[.14em] text-stone-600 transition hover:text-[#2c2926] after:absolute after:inset-x-0 after:-bottom-0.5 after:h-px after:origin-left after:scale-x-0 after:bg-[#625e59] after:transition hover:after:scale-x-100">{children}</button>;

  const mobileDrawer = isMenuOpen && typeof document !== 'undefined'
    ? createPortal(
      <div className="fixed inset-0 z-[70] bg-black/35" onClick={closeMenu}>
        <aside id="mobile-navigation-drawer" role="dialog" aria-modal="true" aria-label="Mobile navigation" onClick={(event) => event.stopPropagation()} className="h-[100dvh] w-[min(88vw,360px)] overflow-y-auto overscroll-contain bg-[#fffdf9] p-5 shadow-2xl sm:p-6">
          <div className="flex items-center justify-between border-b border-[#ddd7cf] pb-5"><BrandMark className="h-14 w-14" /><button ref={closeButtonRef} type="button" onClick={closeMenu} className={iconButton} aria-label="Close menu"><X className="h-5 w-5" /></button></div>
          <button type="button" onClick={() => { closeMenu(); setIsSearchOpen(true); }} className="mt-5 flex min-h-12 w-full items-center gap-3 border-b border-[#eee8e2] py-3 text-left text-sm font-semibold uppercase tracking-[.12em]"><Search className="h-4 w-4" />Search</button>
          <nav className="mt-2 space-y-1" aria-label="Mobile primary navigation">
            <DrawerLink onClick={closeMenuThen(() => navigate('home'))}>Home</DrawerLink>
            <DrawerLink onClick={closeMenuThen(() => navigate('shop'))}>Shop</DrawerLink>
            <DrawerLink onClick={closeMenuThen(() => navigate('about'))}>About Us</DrawerLink>
            <DrawerLink onClick={closeMenuThen(() => navigate('contact'))}>Contact</DrawerLink>
            <DrawerLink onClick={goToNewArrivals}>New Arrivals</DrawerLink>
            <DrawerLink onClick={closeMenuThen(() => requireAuth('account'))}>Profile / Account</DrawerLink>
            <DrawerLink onClick={closeMenuThen(() => navigate('order-tracking'))}>Track an Order</DrawerLink>
          </nav>
          {collections.length > 0 && <div className="mt-7 border-t border-[#ddd7cf] pt-5"><p className="text-[10px] font-semibold uppercase tracking-[.15em] text-stone-500">Collections</p><div className="mt-2">{collections.map((category) => <div key={category}><DrawerLink onClick={() => goToCollection(category)}>{category}</DrawerLink></div>)}</div></div>}
        </aside>
      </div>,
      document.body,
    )
    : null;

  return <>
    <header className="sticky top-0 z-40 border-b border-[#ddd7cf] bg-[#fffdf9]/95 backdrop-blur">
      <div className="mx-auto hidden max-w-[1440px] grid-cols-[1fr_auto_1fr] items-center px-7 py-2 lg:grid">
        <div><button onClick={() => navigate('home')} aria-label="AB Collection home" className="inline-flex items-center"><BrandMark className="h-14 w-14 sm:h-16 sm:w-16" /></button></div>
        <nav className="flex items-center gap-8" aria-label="Primary navigation"><NavLink view="home">Home</NavLink><NavLink view="shop">Shop</NavLink><NavLink view="about">About Us</NavLink><NavLink view="contact">Contact</NavLink></nav>
        <div className="flex items-center justify-end gap-1"><button onClick={() => setIsSearchOpen((open) => !open)} className={iconButton} aria-label="Search"><Search className="h-4 w-4" /></button><button onClick={() => requireAuth('account')} className={iconButton} aria-label="Account"><User className="h-4 w-4" /></button><button onClick={() => setIsWishlistDrawerOpen(true)} className={iconButton} aria-label="Wishlist"><Heart className="h-4 w-4" />{wishlist.length > 0 && <StatusDot />}</button><button onClick={() => setIsCartDrawerOpen(true)} className={iconButton} aria-label="Shopping bag"><ShoppingBag className="h-4 w-4" />{cart.length > 0 && <StatusDot />}</button></div>
      </div>
      <div className="mx-auto grid max-w-[1440px] grid-cols-[1fr_auto_1fr] items-center px-3 py-2 lg:hidden">
        <button type="button" onClick={() => setIsMenuOpen((open) => !open)} className={`${iconButton} justify-self-start`} aria-label={isMenuOpen ? 'Close menu' : 'Open menu'} aria-expanded={isMenuOpen} aria-controls="mobile-navigation-drawer">
          {isMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
        <button onClick={() => navigate('home')} aria-label="AB Collection home" className="inline-flex items-center"><BrandMark className="h-12 w-12" /></button>
        <div className="flex justify-self-end gap-0.5"><button onClick={() => setIsWishlistDrawerOpen(true)} className={iconButton} aria-label="Wishlist"><Heart className="h-4 w-4" />{wishlist.length > 0 && <StatusDot />}</button><button onClick={() => setIsCartDrawerOpen(true)} className={iconButton} aria-label="Shopping bag"><ShoppingBag className="h-4 w-4" />{cart.length > 0 && <StatusDot />}</button></div>
      </div>
      {isSearchOpen && <form onSubmit={submitSearch} className="border-t border-[#ddd7cf] px-4 py-3"><div className="mx-auto flex max-w-[1440px] items-center gap-3"><Search className="h-4 w-4 text-stone-400" /><label className="sr-only" htmlFor="site-search">Search AB Collection</label><input id="site-search" autoFocus value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search styles, fabric or SKU" className="min-w-0 flex-1 bg-transparent py-2 text-sm outline-none" /><button type="button" onClick={() => setIsSearchOpen(false)} className="text-[11px] font-semibold uppercase tracking-[.12em] text-stone-500 hover:text-stone-950">Close</button></div></form>}
    </header>
    {mobileDrawer}
  </>;
};

const StatusDot = () => <span aria-hidden="true" className="pointer-events-none absolute right-1 top-1 h-2 w-2 rounded-full bg-[#8B1E3F] ring-2 ring-[#fffdf9]" />;
const DrawerLink = ({ onClick, children }: { onClick: () => void; children: React.ReactNode }) => <button type="button" onClick={onClick} className="block min-h-12 w-full border-b border-[#eee8e2] py-3 text-left text-sm font-medium uppercase tracking-[.12em] text-stone-700 transition hover:text-black">{children}</button>;
