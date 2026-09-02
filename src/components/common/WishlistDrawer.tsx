import React from 'react';
import { useStore } from '../../context/StoreContext';
import { X, Heart, ShoppingBag, Trash2, ArrowRight } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock';

export const WishlistDrawer: React.FC = () => {
  const {
    isWishlistDrawerOpen,
    setIsWishlistDrawerOpen,
    wishlist,
    products,
    toggleWishlist,
    addToCart,
    formatPrice,
    navigate
  } = useStore();

  useBodyScrollLock(isWishlistDrawerOpen);

  if (!isWishlistDrawerOpen) return null;

  const wishlistProducts = products.filter((p) => wishlist.includes(p.id));

  return (
    <div
      id="wishlist-drawer-backdrop"
      className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs transition-opacity"
      onClick={() => setIsWishlistDrawerOpen(false)}
    >
      <motion.div
        id="wishlist-drawer-content"
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'tween', duration: 0.3 }}
        onClick={(e) => e.stopPropagation()}
        className="fixed inset-y-0 right-0 max-w-md w-full bg-[#FAF7F2] shadow-2xl flex flex-col z-50 border-l border-[#E6D5B8]"
      >
        {/* Header */}
        <div className="p-5 border-b border-[#E6D5B8] flex items-center justify-between bg-white">
          <div className="flex items-center gap-2">
            <Heart className="w-5 h-5 text-[#8B1E3F] fill-[#8B1E3F]" />
            <h2 className="text-lg font-serif font-bold text-[#1A1715]">
              Saved Wishlist ({wishlist.length})
            </h2>
          </div>
          <button
            id="close-wishlist-drawer-btn"
            onClick={() => setIsWishlistDrawerOpen(false)}
            className="p-1 text-stone-500 hover:text-black rounded-full hover:bg-stone-100"
            aria-label="Close Wishlist"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Item list */}
        <div className="flex-1 overflow-y-auto overscroll-contain p-5 space-y-4">
          {wishlistProducts.length === 0 ? (
            <div className="text-center py-16">
              <Heart className="w-12 h-12 text-stone-300 mx-auto mb-3" />
              <h3 className="text-base font-serif font-semibold text-stone-700">Your Wishlist is Empty</h3>
              <p className="text-xs text-stone-500 mt-1 max-w-xs mx-auto">
                Explore our handcrafted silks and bridal collections to find an outfit you love.
              </p>
              <button
                id="explore-catalog-from-wishlist"
                onClick={() => {
                  setIsWishlistDrawerOpen(false);
                  navigate('shop');
                }}
                className="mt-6 inline-flex items-center gap-1.5 bg-[#8B1E3F] text-white text-xs uppercase tracking-wider font-semibold px-5 py-2.5 rounded-md hover:bg-[#721C24] transition-colors"
              >
                Explore Collection <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            wishlistProducts.map((product) => (
              <div
                key={product.id}
                id={`wishlist-item-${product.id}`}
                className="flex gap-4 p-3.5 bg-white border border-[#E6D5B8] rounded-lg shadow-xs hover:border-[#C5A059] transition-all"
              >
                <img
                  src={product.images[0]}
                  alt={product.title}
                  className="w-20 h-24 object-cover rounded-md cursor-pointer shrink-0"
                  onClick={() => {
                    setIsWishlistDrawerOpen(false);
                    navigate('product-detail', product.id);
                  }}
                />
                <div className="flex-1 min-w-0 flex flex-col justify-between">
                  <div>
                    <span className="text-[10px] uppercase tracking-wider font-semibold text-[#C5A059]">
                      {product.category}
                    </span>
                    <h4
                      onClick={() => {
                        setIsWishlistDrawerOpen(false);
                        navigate('product-detail', product.id);
                      }}
                      className="text-xs font-semibold text-[#1A1715] line-clamp-1 cursor-pointer hover:text-[#8B1E3F] transition-colors"
                    >
                      {product.title}
                    </h4>
                    <div className="mt-1 font-serif text-sm font-bold text-[#8B1E3F]">
                      {formatPrice(product.priceINR)}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 mt-3">
                    <button
                      id={`move-to-bag-${product.id}`}
                      onClick={() => {
                        void addToCart(
                          product,
                          product.colors[0]?.colorName || 'Default',
                          product.availableSizes[0] || 'Unstitched'
                        ).then((added) => {
                          if (added) void toggleWishlist(product.id);
                        });
                      }}
                      className="flex-1 bg-[#1A1715] hover:bg-[#8B1E3F] text-white text-[11px] font-semibold uppercase tracking-wider py-1.5 px-2.5 rounded flex items-center justify-center gap-1 transition-colors"
                    >
                      <ShoppingBag className="w-3 h-3" /> Move to Bag
                    </button>
                    <button
                      id={`remove-wishlist-btn-${product.id}`}
                      onClick={() => toggleWishlist(product.id)}
                      className="p-1.5 text-stone-400 hover:text-rose-600 rounded hover:bg-rose-50 transition-colors"
                      title="Remove"
                      aria-label="Remove from wishlist"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer actions */}
        {wishlistProducts.length > 0 && (
          <div className="p-4 border-t border-[#E6D5B8] bg-[#FAF7F2]">
            <button
              id="view-all-shop-wishlist"
              onClick={() => {
                setIsWishlistDrawerOpen(false);
                navigate('shop');
              }}
              className="w-full text-center text-xs font-semibold uppercase tracking-wider text-[#8B1E3F] hover:underline"
            >
              Continue Shopping →
            </button>
          </div>
        )}
      </motion.div>
    </div>
  );
};
