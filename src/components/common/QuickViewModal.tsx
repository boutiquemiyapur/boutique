import React, { useEffect, useState } from 'react';
import { useStore } from '../../context/StoreContext';
import { ProductOptions } from './ProductOptions';
import { ProductImage } from './ProductImage';
import { isVariantAvailable, productImages, stockMessage } from '../../utils/productData';
import { SizeOption } from '../../types';
import { X, Heart, ShoppingBag, Star, ShieldCheck, Scissors } from 'lucide-react';
import { motion } from 'motion/react';
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock';

export const QuickViewModal: React.FC = () => {
  const {
    quickViewProduct,
    products,
    cms,
    setQuickViewProduct,
    addToCart,
    toggleWishlist,
    isInWishlist,
    formatPrice,
    navigate
  } = useStore();

  const [selectedImgIndex, setSelectedImgIndex] = useState(0);
  const [selectedColor, setSelectedColor] = useState<string>('');
  const [selectedSize, setSelectedSize] = useState<SizeOption>('');
  const [quantity, setQuantity] = useState(1);
  const [isCustomTailoring, setIsCustomTailoring] = useState(false);

  useBodyScrollLock(Boolean(quickViewProduct));

  const product = products.find((item) => item.id === quickViewProduct?.id);
  useEffect(() => {
    setSelectedImgIndex(0); setQuantity(1); setIsCustomTailoring(false);
    setSelectedColor((value) => product?.colors.some((item) => item.colorName === value) ? value : product?.colors[0]?.colorName || '');
    setSelectedSize((value) => product?.availableSizes.includes(value) ? value : product?.availableSizes[0] || '');
  }, [product]);
  useEffect(() => { if (quickViewProduct && !product) setQuickViewProduct(null); }, [quickViewProduct, product]);
  if (!product) return null;
  const isSaved = isInWishlist(product.id);
  const activeColor = selectedColor;

  const gallery = productImages(product, activeColor);
  const selectedOptionAvailable = isVariantAvailable(product, activeColor, selectedSize, quantity);

  return (
    <div
      id="quickview-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs"
      onClick={() => setQuickViewProduct(null)}
    >
      <motion.div
        id="quickview-modal-content"
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-[#FAF7F2] border border-[#C5A059]/40 rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto overscroll-contain shadow-2xl relative grid grid-cols-1 md:grid-cols-2 gap-6 p-6 sm:p-8"
      >
        <button
          id="close-quickview-btn"
          onClick={() => setQuickViewProduct(null)}
          className="absolute top-4 right-4 z-10 text-stone-500 hover:text-black p-1.5 rounded-full bg-white/80 hover:bg-white shadow-xs"
          aria-label="Close Preview"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Gallery */}
        <div className="space-y-3">
          <div className="aspect-3/4 rounded-xl overflow-hidden bg-stone-100 border border-[#E6D5B8] relative">
            <ProductImage
              src={gallery[selectedImgIndex] || gallery[0]}
              alt={product.title}
              className="w-full h-full object-cover transition-all duration-300"
            />
            {product.isHandloomCertified && (
              <span className="absolute top-3 left-3 bg-[#16423C] text-white text-[10px] uppercase font-bold tracking-wider px-2.5 py-1 rounded-full flex items-center gap-1 shadow-md">
                <ShieldCheck className="w-3 h-3 text-[#DFBF77]" /> Handloom certified
              </span>
            )}
          </div>
          {gallery.length > 1 && (
            <div className="flex gap-2 overflow-x-auto pb-1">
              {gallery.map((img, idx) => (
                <button
                  key={idx}
                  id={`quickview-thumb-${idx}`}
                  onClick={() => setSelectedImgIndex(idx)}
                  className={`w-16 h-20 rounded-md overflow-hidden border-2 shrink-0 transition-all ${
                    selectedImgIndex === idx ? 'border-[#8B1E3F] shadow-sm' : 'border-transparent opacity-70 hover:opacity-100'
                  }`}
                >
                  <ProductImage src={img} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Details */}
        <div className="flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-xs text-[#C5A059] font-bold uppercase tracking-wider">
              <span>{product.category}</span>
              <span className="text-stone-400 font-mono text-[11px]">SKU: {product.sku}</span>
            </div>

            <h2 className="text-xl sm:text-2xl font-serif font-bold text-[#1A1715] mt-1 leading-snug">
              {product.title}
            </h2>

            {product.reviewCount > 0 && <div className="flex items-center gap-2 mt-2">
              <div className="flex items-center text-amber-500">
                {[...Array(5)].map((_, i) => (
                  <Star
                    key={i}
                    className={`w-3.5 h-3.5 ${
                      i < Math.floor(product.rating) ? 'fill-amber-400 text-amber-400' : 'text-stone-300'
                    }`}
                  />
                ))}
              </div>
              <span className="text-xs font-semibold text-stone-700">{product.rating}</span>
              <span className="text-xs text-stone-400">({product.reviewCount} reviews)</span>
            </div>}

            {/* Price */}
            <div className="flex items-baseline gap-3 mt-4">
              <span className="text-2xl font-serif font-bold text-[#8B1E3F]">
                {formatPrice(product.priceINR)}
              </span>
              {product.originalPriceINR != null && product.originalPriceINR > product.priceINR && (
                <span className="text-sm line-through text-stone-400 font-serif">
                  {formatPrice(product.originalPriceINR)}
                </span>
              )}
              {product.discountPercentage > 0 && (
                <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                  Save {product.discountPercentage}%
                </span>
              )}
            </div>

            <p className="text-xs text-stone-600 mt-3 line-clamp-3 leading-relaxed">
              {product.description}
            </p>

            <div className="mt-4"><ProductOptions product={product} color={activeColor} size={selectedSize} onColor={(value) => { setSelectedColor(value); setSelectedImgIndex(0); }} onSize={setSelectedSize} /></div>
            <p className="mt-3 text-xs">{!selectedOptionAvailable && product.stockCount > 0 ? 'Selected option is out of stock' : stockMessage(product, cms.lowStockThreshold)}</p>

            {/* Custom Tailoring Option */}
            {product.customStitchingAvailable && (
              <div className="mt-4 p-3 bg-[#FAF4ED] border border-[#C5A059]/30 rounded-lg flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Scissors className="w-4 h-4 text-[#8B1E3F]" />
                  <div>
                    <span className="text-xs font-bold text-[#8B1E3F]">Add Custom Blouse Tailoring</span>
                    <p className="text-[11px] text-stone-500">
                      {product.customStitchingFeeINR > 0
                        ? `+${formatPrice(product.customStitchingFeeINR)} Made-to-measure`
                        : 'No additional tailoring fee'}
                    </p>
                  </div>
                </div>
                <input
                  id="quickview-toggle-custom-stitching"
                  type="checkbox"
                  checked={isCustomTailoring}
                  onChange={(e) => setIsCustomTailoring(e.target.checked)}
                  className="w-4 h-4 accent-[#8B1E3F] cursor-pointer"
                />
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="mt-6 pt-4 border-t border-[#E6D5B8] flex items-center gap-3">
            <button
              id="quickview-add-to-bag-btn"
              disabled={!selectedOptionAvailable}
              onClick={() => {
                void addToCart(product, activeColor, selectedSize, quantity, isCustomTailoring).then((added) => {
                  if (added) setQuickViewProduct(null);
                });
              }}
              className="flex-1 bg-[#8B1E3F] hover:bg-[#721C24] text-white font-semibold text-xs uppercase tracking-wider py-3.5 px-4 rounded-lg flex items-center justify-center gap-2 shadow-lg hover:shadow-xl transition-all disabled:cursor-not-allowed disabled:opacity-50"
            >
              <ShoppingBag className="w-4 h-4" /> Add to Shopping Bag
            </button>
            <button
              id="quickview-wishlist-toggle"
              onClick={() => toggleWishlist(product.id)}
              className={`p-3 rounded-lg border transition-all ${
                isSaved
                  ? 'border-[#8B1E3F] bg-[#8B1E3F]/10 text-[#8B1E3F]'
                  : 'border-[#E6D5B8] bg-white text-stone-500 hover:text-black hover:border-black'
              }`}
              aria-label="Wishlist"
            >
              <Heart className={`w-5 h-5 ${isSaved ? 'fill-[#8B1E3F]' : ''}`} />
            </button>
          </div>

          <button
            id="quickview-full-details-btn"
            onClick={() => {
              setQuickViewProduct(null);
              navigate('product-detail', product.id);
            }}
            className="mt-2 text-center text-xs font-semibold uppercase tracking-wider text-[#8B1E3F] hover:underline"
          >
            View Full Product Details & Reviews →
          </button>
        </div>
      </motion.div>
    </div>
  );
};
