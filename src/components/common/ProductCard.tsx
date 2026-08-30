import React, { useState } from 'react';
import { Eye, Heart, ShoppingBag } from 'lucide-react';
import { Product } from '../../types';
import { useStore } from '../../context/StoreContext';

export const ProductCard: React.FC<{ product: Product; priority?: boolean }> = ({ product, priority = false }) => {
  const { addToCart, formatPrice, isInWishlist, navigate, setQuickViewProduct, toggleWishlist } = useStore();
  const [showAlternate, setShowAlternate] = useState(false);
  const saved = isInWishlist(product.id);
  const isSoldOut = product.stockCount <= 0;
  const image = showAlternate && product.images[1] ? product.images[1] : product.images[0];

  return <article className="group relative min-w-0">
    <div className="relative aspect-[3/4] overflow-hidden bg-[#eee9e2]" onMouseEnter={() => setShowAlternate(true)} onMouseLeave={() => setShowAlternate(false)}>
      <button onClick={() => navigate('product-detail', product.id)} className="block h-full w-full text-left" aria-label={`View ${product.title}`}>
        <img src={image} alt={product.title} loading={priority ? 'eager' : 'lazy'} className="h-full w-full object-cover transition duration-700 group-hover:scale-[1.035]" />
      </button>
      <div className="absolute left-3 top-3 flex flex-col items-start gap-1.5 text-[9px] font-semibold uppercase tracking-[.14em]">
        {product.isNewArrival && <span className="bg-[#fffdf9] px-2 py-1 text-[#2c2926]">New</span>}
        {product.discountPercentage && <span className="bg-[#625e59] px-2 py-1 text-white">{product.discountPercentage}% off</span>}
        {isSoldOut && <span className="bg-[#2c2926] px-2 py-1 text-white">Sold out</span>}
      </div>
      <button onClick={() => toggleWishlist(product.id)} aria-label={saved ? `Remove ${product.title} from wishlist` : `Save ${product.title} to wishlist`} className="absolute right-3 top-3 grid h-9 w-9 place-items-center bg-[#fffdf9]/95 text-[#2c2926] transition hover:bg-[#625e59] hover:text-white">
        <Heart className={`h-4 w-4 ${saved ? 'fill-current' : ''}`} />
      </button>
      <div className="absolute inset-x-3 bottom-3 flex translate-y-2 gap-2 opacity-0 transition duration-300 group-hover:translate-y-0 group-hover:opacity-100 focus-within:translate-y-0 focus-within:opacity-100">
        <button onClick={() => setQuickViewProduct(product)} className="flex h-10 flex-1 items-center justify-center gap-1.5 bg-[#fffdf9] text-[10px] font-semibold uppercase tracking-[.12em] text-[#2c2926]"><Eye className="h-3.5 w-3.5" />Quick view</button>
        <button disabled={isSoldOut} onClick={() => addToCart(product, product.colors[0]?.colorName || 'Default', product.availableSizes[0] || 'Unstitched')} className="grid h-10 w-10 place-items-center bg-[#2c2926] text-white disabled:cursor-not-allowed disabled:opacity-50" aria-label={`Add ${product.title} to bag`}><ShoppingBag className="h-4 w-4" /></button>
      </div>
    </div>
    <div className="pt-3">
      <p className="text-[10px] uppercase tracking-[.14em] text-stone-500">{product.category}</p>
      <button onClick={() => navigate('product-detail', product.id)} className="mt-1 line-clamp-1 text-left text-sm font-medium text-[#2c2926] hover:underline">{product.title}</button>
      <div className="mt-1.5 flex items-center gap-2"><span className="font-serif text-base text-[#2c2926]">{formatPrice(product.priceINR)}</span>{product.originalPriceINR && <span className="text-xs text-stone-400 line-through">{formatPrice(product.originalPriceINR)}</span>}</div>
      <p className={`mt-1 text-[10px] ${isSoldOut ? 'text-stone-500' : product.stockCount <= 3 ? 'text-[#8a5738]' : 'text-stone-500'}`}>{isSoldOut ? 'Unavailable' : product.stockCount <= 3 ? `Only ${product.stockCount} left` : product.isReadyToShip ? 'Ready to ship' : 'Made to order'}</p>
    </div>
  </article>;
};
