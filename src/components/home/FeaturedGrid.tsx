import React, { useState } from 'react';
import { useStore } from '../../context/StoreContext';
import { Product } from '../../types';
import { Heart, ShoppingBag, Eye, Star, ShieldCheck, Sparkles, Scissors, ArrowRight } from 'lucide-react';

type TabType = 'bestsellers' | 'new-arrivals' | 'bridal' | 'handloom';

export const FeaturedGrid: React.FC = () => {
  const {
    products,
    formatPrice,
    addToCart,
    toggleWishlist,
    isInWishlist,
    setQuickViewProduct,
    navigate
  } = useStore();

  const [activeTab, setActiveTab] = useState<TabType>('bestsellers');

  const filteredProducts = products.filter((p) => {
    if (activeTab === 'bestsellers') return p.isBestseller;
    if (activeTab === 'new-arrivals') return p.isNewArrival;
    if (activeTab === 'bridal') return p.occasion === 'Bridal Trousseau' || p.category === 'Bridal Lehengas';
    if (activeTab === 'handloom') return p.isHandloomCertified;
    return true;
  });

  return (
    <section className="py-16 sm:py-20 bg-white border-y border-[#E6D5B8]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
          <div>
            <span className="text-xs uppercase tracking-[0.25em] font-semibold text-[#8B1E3F]">
              Handcrafted Fashion
            </span>
            <h2 className="text-2xl sm:text-4xl font-serif font-bold text-[#1A1715] mt-1">
              Selected Styles
            </h2>
            <div className="w-12 h-0.5 bg-[#C5A059] mt-2"></div>
          </div>

          {/* Filter Tabs */}
          <div className="flex flex-wrap gap-2 border border-[#E6D5B8] p-1 rounded-xl bg-[#FAF7F2]">
            <button
              id="tab-bestsellers"
              onClick={() => setActiveTab('bestsellers')}
              className={`px-4 py-2 text-xs font-semibold uppercase tracking-wider rounded-lg transition-all ${
                activeTab === 'bestsellers'
                  ? 'bg-[#8B1E3F] text-white shadow-xs'
                  : 'text-stone-700 hover:text-black'
              }`}
            >
              Bestsellers
            </button>
            <button
              id="tab-new-arrivals"
              onClick={() => setActiveTab('new-arrivals')}
              className={`px-4 py-2 text-xs font-semibold uppercase tracking-wider rounded-lg transition-all ${
                activeTab === 'new-arrivals'
                  ? 'bg-[#8B1E3F] text-white shadow-xs'
                  : 'text-stone-700 hover:text-black'
              }`}
            >
              New Arrivals
            </button>
            <button
              id="tab-bridal"
              onClick={() => setActiveTab('bridal')}
              className={`px-4 py-2 text-xs font-semibold uppercase tracking-wider rounded-lg transition-all ${
                activeTab === 'bridal'
                  ? 'bg-[#8B1E3F] text-white shadow-xs'
                  : 'text-stone-700 hover:text-black'
              }`}
            >
              Bridal Trousseau
            </button>
            <button
              id="tab-handloom"
              onClick={() => setActiveTab('handloom')}
              className={`px-4 py-2 text-xs font-semibold uppercase tracking-wider rounded-lg transition-all ${
                activeTab === 'handloom'
                  ? 'bg-[#8B1E3F] text-white shadow-xs'
                  : 'text-stone-700 hover:text-black'
              }`}
            >
              Pure Handloom
            </button>
          </div>
        </div>

        {/* Product Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-8">
          {filteredProducts.slice(0, 8).map((product) => {
            const isSaved = isInWishlist(product.id);

            return (
              <div
                key={product.id}
                id={`featured-product-card-${product.id}`}
                className="group flex flex-col bg-[#FAF7F2] rounded-xl overflow-hidden border border-[#E6D5B8] hover:border-[#C5A059] shadow-xs hover:shadow-xl transition-all duration-300"
              >
                {/* Image Container */}
                <div className="relative aspect-3/4 overflow-hidden bg-stone-100 cursor-pointer">
                  <img
                    src={product.images[0]}
                    alt={product.title}
                    onClick={() => navigate('product-detail', product.id)}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />

                  {/* Badges */}
                  <div className="absolute top-3 left-3 flex flex-col gap-1.5 z-10">
                    {product.isHandloomCertified && (
                      <span className="bg-[#16423C] text-[#DFBF77] text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-md shadow-xs flex items-center gap-1">
                        <ShieldCheck className="w-3 h-3" /> Silk Mark
                      </span>
                    )}
                    {product.discountPercentage && (
                      <span className="bg-[#8B1E3F] text-white text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md shadow-xs">
                        {product.discountPercentage}% OFF
                      </span>
                    )}
                  </div>

                  {/* Wishlist Button */}
                  <button
                    id={`wishlist-btn-${product.id}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleWishlist(product.id);
                    }}
                    className={`absolute top-3 right-3 p-2 rounded-full backdrop-blur-md transition-all shadow-sm ${
                      isSaved
                        ? 'bg-[#8B1E3F] text-white'
                        : 'bg-white/80 text-stone-700 hover:bg-white hover:text-[#8B1E3F]'
                    }`}
                    aria-label="Toggle Wishlist"
                  >
                    <Heart className={`w-4 h-4 ${isSaved ? 'fill-white' : ''}`} />
                  </button>

                  {/* Quick View Button on Hover */}
                  <div className="absolute inset-x-3 bottom-3 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex gap-2 z-10">
                    <button
                      id={`quick-view-btn-${product.id}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        setQuickViewProduct(product);
                      }}
                      className="flex-1 bg-white/95 backdrop-blur-md hover:bg-white text-stone-900 text-xs font-semibold uppercase tracking-wider py-2.5 rounded-lg flex items-center justify-center gap-1.5 shadow-md hover:text-[#8B1E3F] transition-colors"
                    >
                      <Eye className="w-3.5 h-3.5" /> Quick View
                    </button>
                  </div>
                </div>

                {/* Content */}
                <div className="p-4 flex-1 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between text-[10px] text-[#C5A059] font-bold uppercase tracking-wider">
                      <span>{product.category}</span>
                      <span className="text-stone-400 font-normal">{product.fabric}</span>
                    </div>

                    <h3
                      onClick={() => navigate('product-detail', product.id)}
                      className="text-xs sm:text-sm font-semibold text-[#1A1715] mt-1.5 line-clamp-2 cursor-pointer hover:text-[#8B1E3F] transition-colors"
                    >
                      {product.title}
                    </h3>

                    {/* Rating */}
                    <div className="flex items-center gap-1 mt-1.5 text-amber-500">
                      <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                      <span className="text-xs font-bold text-stone-700">{product.rating}</span>
                      <span className="text-[10px] text-stone-400">({product.reviewCount})</span>
                    </div>
                  </div>

                  {/* Pricing and Add to Bag */}
                  <div className="mt-4 pt-3 border-t border-[#E6D5B8]/60 flex items-center justify-between">
                    <div>
                      <div className="text-sm sm:text-base font-serif font-bold text-[#8B1E3F]">
                        {formatPrice(product.priceINR)}
                      </div>
                      {product.originalPriceINR && (
                        <div className="text-[11px] line-through text-stone-400 font-serif">
                          {formatPrice(product.originalPriceINR)}
                        </div>
                      )}
                    </div>

                    <button
                      id={`add-to-bag-card-${product.id}`}
                      onClick={() =>
                        addToCart(
                          product,
                          product.colors[0]?.colorName || 'Default',
                          product.availableSizes[0] || 'Unstitched'
                        )
                      }
                      className="p-2.5 bg-[#1A1715] hover:bg-[#8B1E3F] text-white rounded-lg transition-colors shadow-xs"
                      title="Add to Shopping Bag"
                      aria-label="Add to Bag"
                    >
                      <ShoppingBag className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* View All Button */}
        <div className="mt-12 text-center">
          <button
            id="featured-view-all-btn"
            onClick={() => navigate('shop')}
            className="inline-flex items-center gap-2 bg-[#8B1E3F] hover:bg-[#721C24] text-white text-xs uppercase font-semibold tracking-widest px-8 py-3.5 rounded-lg shadow-lg hover:shadow-xl transition-all"
          >
            <span>View All Handloom Silks & Styles</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </section>
  );
};
