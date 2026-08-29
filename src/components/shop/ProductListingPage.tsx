import React, { useState, useMemo } from 'react';
import { useStore } from '../../context/StoreContext';
import { Category, FabricType, OccasionType, SizeOption, Product } from '../../types';
import {
  Filter,
  X,
  SlidersHorizontal,
  Star,
  Heart,
  ShoppingBag,
  Eye,
  ShieldCheck,
  RotateCcw,
  LayoutGrid,
  Grid3X3,
  ChevronDown
} from 'lucide-react';

const ALL_CATEGORIES: Category[] = [
  'All',
  'Kanjeevaram Silks',
  'Banarasi Sarees',
  'Bridal Lehengas',
  'Designer Sarees',
  'Unstitched Suits',
  'Anarkalis & Kurtis',
  'Indo-Western',
  'Temple Jewelry'
];

const ALL_FABRICS: FabricType[] = [
  'Kanjeevaram Silk',
  'Banarasi Katan Silk',
  'Organza Silk',
  'Raw Silk',
  'Chanderi',
  'Georgette',
  'Velvet',
  'Chikankari Cotton'
];

const ALL_OCCASIONS: OccasionType[] = [
  'Bridal Trousseau',
  'Wedding Guest',
  'Festive & Puja',
  'Reception & Party',
  'Sangeet & Mehendi',
  'Cocktail & Evening'
];

const ALL_SIZES: SizeOption[] = ['Unstitched', 'XS', 'S', 'M', 'L', 'XL', 'XXL', 'Custom Made-to-Measure'];

export const ProductListingPage: React.FC = () => {
  const {
    products,
    filters,
    setFilters,
    resetFilters,
    formatPrice,
    addToCart,
    toggleWishlist,
    isInWishlist,
    setQuickViewProduct,
    navigate
  } = useStore();

  const [isMobileFilterOpen, setIsMobileFilterOpen] = useState(false);
  const [gridCols, setGridCols] = useState<3 | 4>(4);

  // Computed filtered & sorted list
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      // Category
      if (filters.category !== 'All' && p.category !== filters.category) return false;

      // Fabric
      if (filters.fabrics.length > 0 && !filters.fabrics.includes(p.fabric)) return false;

      // Occasion
      if (filters.occasions.length > 0 && !filters.occasions.includes(p.occasion)) return false;

      // Sizes
      if (filters.sizes.length > 0) {
        const hasSize = p.availableSizes.some((s) => filters.sizes.includes(s));
        if (!hasSize) return false;
      }

      // Ready to Ship
      if (filters.readyToShipOnly && !p.isReadyToShip) return false;

      // Handloom
      if (filters.handloomOnly && !p.isHandloomCertified) return false;

      // Price
      if (p.priceINR < filters.minPriceINR || p.priceINR > filters.maxPriceINR) return false;

      // Search Query
      if (filters.searchQuery.trim()) {
        const query = filters.searchQuery.toLowerCase();
        const matchesTitle = p.title.toLowerCase().includes(query);
        const matchesCat = p.category.toLowerCase().includes(query);
        const matchesFabric = p.fabric.toLowerCase().includes(query);
        const matchesTag = p.tags.some((t) => t.toLowerCase().includes(query));
        if (!matchesTitle && !matchesCat && !matchesFabric && !matchesTag) return false;
      }

      return true;
    }).sort((a, b) => {
      if (filters.sortBy === 'price-low-high') return a.priceINR - b.priceINR;
      if (filters.sortBy === 'price-high-low') return b.priceINR - a.priceINR;
      if (filters.sortBy === 'rating') return b.rating - a.rating;
      if (filters.sortBy === 'newest') return (b.isNewArrival ? 1 : 0) - (a.isNewArrival ? 1 : 0);
      return (b.isBestseller ? 1 : 0) - (a.isBestseller ? 1 : 0);
    });
  }, [products, filters]);

  const toggleFabric = (fabric: FabricType) => {
    setFilters((prev) => ({
      ...prev,
      fabrics: prev.fabrics.includes(fabric)
        ? prev.fabrics.filter((f) => f !== fabric)
        : [...prev.fabrics, fabric]
    }));
  };

  const toggleOccasion = (occ: OccasionType) => {
    setFilters((prev) => ({
      ...prev,
      occasions: prev.occasions.includes(occ)
        ? prev.occasions.filter((o) => o !== occ)
        : [...prev.occasions, occ]
    }));
  };

  const toggleSize = (sz: SizeOption) => {
    setFilters((prev) => ({
      ...prev,
      sizes: prev.sizes.includes(sz) ? prev.sizes.filter((s) => s !== sz) : [...prev.sizes, sz]
    }));
  };

  return (
    <div className="bg-[#FAF7F2] min-h-screen py-8 sm:py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Breadcrumb & Title */}
        <div className="mb-8">
          <div className="flex items-center gap-2 text-xs text-stone-500 mb-2">
            <button onClick={() => navigate('home')} className="hover:text-[#8B1E3F]">Home</button>
            <span>/</span>
            <span className="text-stone-800 font-semibold">{filters.category}</span>
          </div>

          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-4xl font-serif font-bold text-[#1A1715]">
                {filters.category === 'All' ? 'Haute Couture Catalog' : filters.category}
              </h1>
              <p className="text-xs sm:text-sm text-stone-600 mt-1">
                Showing {filteredProducts.length} handcrafted authentic garments
              </p>
            </div>

            {/* Sort & Grid Switcher */}
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 bg-white border border-[#E6D5B8] px-3 py-2 rounded-lg text-xs">
                <span className="text-stone-500 font-medium">Sort by:</span>
                <select
                  id="catalog-sort-select"
                  value={filters.sortBy}
                  onChange={(e) => setFilters((prev) => ({ ...prev, sortBy: e.target.value as any }))}
                  className="bg-transparent font-semibold text-stone-800 focus:outline-hidden cursor-pointer"
                >
                  <option value="featured">Featured & Bestsellers</option>
                  <option value="newest">New Arrivals</option>
                  <option value="price-low-high">Price: Low to High</option>
                  <option value="price-high-low">Price: High to Low</option>
                  <option value="rating">Customer Rating</option>
                </select>
              </div>

              <button
                id="mobile-filter-drawer-btn"
                onClick={() => setIsMobileFilterOpen(true)}
                className="lg:hidden flex items-center gap-1.5 bg-[#1A1715] text-white px-3.5 py-2 rounded-lg text-xs font-semibold uppercase"
              >
                <SlidersHorizontal className="w-3.5 h-3.5" /> Filters
              </button>
            </div>
          </div>
        </div>

        {/* Active Filter Chips */}
        {(filters.category !== 'All' ||
          filters.fabrics.length > 0 ||
          filters.occasions.length > 0 ||
          filters.sizes.length > 0 ||
          filters.readyToShipOnly ||
          filters.handloomOnly ||
          filters.searchQuery) && (
          <div className="flex flex-wrap items-center gap-2 mb-6 p-3 bg-white border border-[#E6D5B8] rounded-xl shadow-2xs">
            <span className="text-xs font-semibold text-stone-500">Active Filters:</span>

            {filters.searchQuery && (
              <span className="inline-flex items-center gap-1 bg-[#8B1E3F]/10 text-[#8B1E3F] text-xs px-2.5 py-1 rounded-md font-medium">
                Keyword: "{filters.searchQuery}"
                <button onClick={() => setFilters((p) => ({ ...p, searchQuery: '' }))}>
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}

            {filters.category !== 'All' && (
              <span className="inline-flex items-center gap-1 bg-[#8B1E3F]/10 text-[#8B1E3F] text-xs px-2.5 py-1 rounded-md font-medium">
                Category: {filters.category}
                <button onClick={() => setFilters((p) => ({ ...p, category: 'All' }))}>
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}

            {filters.fabrics.map((fab) => (
              <span key={fab} className="inline-flex items-center gap-1 bg-stone-100 text-stone-800 text-xs px-2.5 py-1 rounded-md">
                {fab}
                <button onClick={() => toggleFabric(fab)}><X className="w-3 h-3" /></button>
              </span>
            ))}

            {filters.occasions.map((occ) => (
              <span key={occ} className="inline-flex items-center gap-1 bg-stone-100 text-stone-800 text-xs px-2.5 py-1 rounded-md">
                {occ}
                <button onClick={() => toggleOccasion(occ)}><X className="w-3 h-3" /></button>
              </span>
            ))}

            {filters.readyToShipOnly && (
              <span className="inline-flex items-center gap-1 bg-emerald-100 text-emerald-800 text-xs px-2.5 py-1 rounded-md font-medium">
                Ready to Ship Only
                <button onClick={() => setFilters((p) => ({ ...p, readyToShipOnly: false }))}><X className="w-3 h-3" /></button>
              </span>
            )}

            {filters.handloomOnly && (
              <span className="inline-flex items-center gap-1 bg-amber-100 text-amber-900 text-xs px-2.5 py-1 rounded-md font-medium">
                Silk Mark Handloom
                <button onClick={() => setFilters((p) => ({ ...p, handloomOnly: false }))}><X className="w-3 h-3" /></button>
              </span>
            )}

            <button
              id="clear-all-filter-chips-btn"
              onClick={resetFilters}
              className="text-xs text-[#8B1E3F] underline font-bold ml-auto hover:text-[#721C24]"
            >
              Reset All
            </button>
          </div>
        )}

        {/* Layout: Sidebar + Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Desktop Filter Sidebar */}
          <aside className="hidden lg:block space-y-6">
            <div className="bg-white border border-[#E6D5B8] rounded-2xl p-6 shadow-xs space-y-6">
              <div className="flex items-center justify-between pb-4 border-b border-[#E6D5B8]">
                <h3 className="font-serif font-bold text-base text-[#1A1715] flex items-center gap-2">
                  <Filter className="w-4 h-4 text-[#8B1E3F]" /> Filter Collections
                </h3>
                <button
                  id="sidebar-reset-btn"
                  onClick={resetFilters}
                  className="text-xs text-stone-500 hover:text-[#8B1E3F] transition-colors"
                >
                  Reset
                </button>
              </div>

              {/* Categories */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-[#8B1E3F] mb-3">
                  Categories
                </h4>
                <div className="space-y-1.5">
                  {ALL_CATEGORIES.map((cat) => (
                    <button
                      key={cat}
                      id={`filter-cat-${cat.replace(/\s+/g, '-')}`}
                      onClick={() => setFilters((prev) => ({ ...prev, category: cat }))}
                      className={`w-full text-left py-1.5 px-2 rounded-md text-xs transition-colors flex items-center justify-between ${
                        filters.category === cat
                          ? 'bg-[#8B1E3F] text-white font-bold'
                          : 'text-stone-700 hover:bg-[#FAF7F2]'
                      }`}
                    >
                      <span>{cat}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Quick toggles */}
              <div className="pt-4 border-t border-[#E6D5B8] space-y-3">
                <label className="flex items-center gap-2.5 text-xs text-stone-800 cursor-pointer">
                  <input
                    id="filter-ready-to-ship-toggle"
                    type="checkbox"
                    checked={filters.readyToShipOnly}
                    onChange={(e) => setFilters((prev) => ({ ...prev, readyToShipOnly: e.target.checked }))}
                    className="w-4 h-4 accent-[#8B1E3F] rounded"
                  />
                  <span className="font-semibold">Ready to Ship / In Stock</span>
                </label>

                <label className="flex items-center gap-2.5 text-xs text-stone-800 cursor-pointer">
                  <input
                    id="filter-handloom-toggle"
                    type="checkbox"
                    checked={filters.handloomOnly}
                    onChange={(e) => setFilters((prev) => ({ ...prev, handloomOnly: e.target.checked }))}
                    className="w-4 h-4 accent-[#8B1E3F] rounded"
                  />
                  <span className="font-semibold">Silk Mark Handloom Only</span>
                </label>
              </div>

              {/* Fabrics */}
              <div className="pt-4 border-t border-[#E6D5B8]">
                <h4 className="text-xs font-bold uppercase tracking-wider text-[#8B1E3F] mb-3">
                  Fabric Weaves
                </h4>
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {ALL_FABRICS.map((fabric) => (
                    <label key={fabric} className="flex items-center gap-2 text-xs text-stone-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={filters.fabrics.includes(fabric)}
                        onChange={() => toggleFabric(fabric)}
                        className="w-3.5 h-3.5 accent-[#8B1E3F] rounded"
                      />
                      <span>{fabric}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Occasions */}
              <div className="pt-4 border-t border-[#E6D5B8]">
                <h4 className="text-xs font-bold uppercase tracking-wider text-[#8B1E3F] mb-3">
                  Occasion
                </h4>
                <div className="space-y-2">
                  {ALL_OCCASIONS.map((occ) => (
                    <label key={occ} className="flex items-center gap-2 text-xs text-stone-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={filters.occasions.includes(occ)}
                        onChange={() => toggleOccasion(occ)}
                        className="w-3.5 h-3.5 accent-[#8B1E3F] rounded"
                      />
                      <span>{occ}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Sizes */}
              <div className="pt-4 border-t border-[#E6D5B8]">
                <h4 className="text-xs font-bold uppercase tracking-wider text-[#8B1E3F] mb-3">
                  Sizes Available
                </h4>
                <div className="flex flex-wrap gap-1.5">
                  {ALL_SIZES.map((sz) => (
                    <button
                      key={sz}
                      onClick={() => toggleSize(sz)}
                      className={`px-2.5 py-1 text-xs rounded border transition-all ${
                        filters.sizes.includes(sz)
                          ? 'bg-[#8B1E3F] text-white border-[#8B1E3F]'
                          : 'bg-white text-stone-700 border-[#E6D5B8] hover:border-[#8B1E3F]'
                      }`}
                    >
                      {sz}
                    </button>
                  ))}
                </div>
              </div>

              {/* Price Filter Slider */}
              <div className="pt-4 border-t border-[#E6D5B8]">
                <h4 className="text-xs font-bold uppercase tracking-wider text-[#8B1E3F] mb-3">
                  Max Budget
                </h4>
                <input
                  type="range"
                  min={5000}
                  max={150000}
                  step={5000}
                  value={filters.maxPriceINR}
                  onChange={(e) => setFilters((p) => ({ ...p, maxPriceINR: Number(e.target.value) }))}
                  className="w-full accent-[#8B1E3F]"
                />
                <div className="flex justify-between text-xs text-stone-600 font-mono mt-1">
                  <span>₹5,000</span>
                  <span className="font-bold text-[#8B1E3F]">{formatPrice(filters.maxPriceINR)}</span>
                </div>
              </div>
            </div>
          </aside>

          {/* Product Cards Grid */}
          <main className="lg:col-span-3">
            {filteredProducts.length === 0 ? (
              <div className="bg-white border border-[#E6D5B8] rounded-2xl p-12 text-center">
                <Filter className="w-12 h-12 text-stone-300 mx-auto mb-3" />
                <h3 className="text-lg font-serif font-bold text-stone-800">No Matching Designs Found</h3>
                <p className="text-xs text-stone-500 mt-1 max-w-sm mx-auto">
                  Try clearing some filter criteria or selecting another category to view our heritage inventory.
                </p>
                <button
                  id="reset-empty-filters-btn"
                  onClick={resetFilters}
                  className="mt-6 bg-[#8B1E3F] hover:bg-[#721C24] text-white text-xs uppercase tracking-wider font-semibold px-6 py-2.5 rounded-lg"
                >
                  Reset All Filters
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredProducts.map((product) => {
                  const isSaved = isInWishlist(product.id);

                  return (
                    <div
                      key={product.id}
                      id={`plp-product-${product.id}`}
                      className="group flex flex-col bg-white rounded-xl overflow-hidden border border-[#E6D5B8] hover:border-[#C5A059] shadow-xs hover:shadow-xl transition-all duration-300"
                    >
                      <div className="relative aspect-3/4 overflow-hidden bg-stone-100 cursor-pointer">
                        <img
                          src={product.images[0]}
                          alt={product.title}
                          onClick={() => navigate('product-detail', product.id)}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        />

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

                        <button
                          id={`plp-wishlist-${product.id}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleWishlist(product.id);
                          }}
                          className={`absolute top-3 right-3 p-2 rounded-full backdrop-blur-md transition-all shadow-sm ${
                            isSaved
                              ? 'bg-[#8B1E3F] text-white'
                              : 'bg-white/80 text-stone-700 hover:bg-white hover:text-[#8B1E3F]'
                          }`}
                          aria-label="Wishlist toggle"
                        >
                          <Heart className={`w-4 h-4 ${isSaved ? 'fill-white' : ''}`} />
                        </button>

                        <div className="absolute inset-x-3 bottom-3 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex gap-2 z-10">
                          <button
                            id={`plp-quickview-${product.id}`}
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

                          <div className="flex items-center gap-1 mt-1.5 text-amber-500">
                            <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                            <span className="text-xs font-bold text-stone-700">{product.rating}</span>
                            <span className="text-[10px] text-stone-400">({product.reviewCount})</span>
                          </div>
                        </div>

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
                            id={`plp-add-to-bag-${product.id}`}
                            onClick={() =>
                              addToCart(
                                product,
                                product.colors[0]?.colorName || 'Default',
                                product.availableSizes[0] || 'Unstitched'
                              )
                            }
                            className="p-2.5 bg-[#1A1715] hover:bg-[#8B1E3F] text-white rounded-lg transition-colors shadow-xs"
                            title="Add to Bag"
                          >
                            <ShoppingBag className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </main>
        </div>
      </div>

      {/* Mobile Filters Slide-over Modal */}
      {isMobileFilterOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 lg:hidden" onClick={() => setIsMobileFilterOpen(false)}>
          <div
            className="fixed inset-y-0 right-0 max-w-xs w-full bg-white shadow-2xl p-6 overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-4 border-b border-stone-200">
              <h3 className="font-serif font-bold text-lg text-stone-900">Filters</h3>
              <button onClick={() => setIsMobileFilterOpen(false)}>
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="py-4 space-y-6">
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-[#8B1E3F] mb-2">Category</h4>
                <div className="space-y-1">
                  {ALL_CATEGORIES.map((cat) => (
                    <button
                      key={cat}
                      onClick={() => setFilters((p) => ({ ...p, category: cat }))}
                      className={`w-full text-left text-xs py-1.5 px-2 rounded ${
                        filters.category === cat ? 'bg-[#8B1E3F] text-white font-bold' : 'text-stone-700'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-stone-200">
              <button
                onClick={() => setIsMobileFilterOpen(false)}
                className="w-full bg-[#8B1E3F] text-white py-3 rounded-lg text-xs uppercase font-bold tracking-wider"
              >
                Apply Filters
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
