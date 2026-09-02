import React, { useEffect, useState } from 'react';
import { useStore } from '../../context/StoreContext';
import { CustomMeasurements, ReviewItem, SizeOption } from '../../types';
import { ProductCard } from '../common/ProductCard';
import { whatsappChatUrl } from '../../utils/whatsapp';
import {
  Heart,
  ShoppingBag,
  Scissors,
  Truck,
  ShieldCheck,
  Star,
  Sparkles,
  Ruler,
  Share2,
  CheckCircle2,
  Phone,
  Clock,
  RotateCcw,
  Check,
  ChevronRight,
  Info
} from 'lucide-react';

export const ProductDetailPage: React.FC = () => {
  const {
    products,
    selectedProductId,
    formatPrice,
    addToCart,
    buyNow,
    toggleWishlist,
    isInWishlist,
    customer,
    authSession,
    loadProductReviews,
    submitReview,
    setIsSizeGuideOpen,
    navigate,
    showToast,
    cms
} = useStore();

  const product = products.find((p) => p.id === selectedProductId) || products[0];

  const [activeImgIndex, setActiveImgIndex] = useState(0);
  const [selectedColor, setSelectedColor] = useState(product?.colors[0]?.colorName || 'Default');
  const [selectedSize, setSelectedSize] = useState<SizeOption>(product?.availableSizes[0] || 'Unstitched');
  const [quantity, setQuantity] = useState(1);
  const [activeTab, setActiveTab] = useState<'details' | 'craft' | 'shipping' | 'reviews'>('details');

  // Custom tailoring state
  const [isCustomTailoring, setIsCustomTailoring] = useState(false);
  const [measurements, setMeasurements] = useState<CustomMeasurements>(
    customer.savedMeasurements || {
      bust: 36,
      waist: 28,
      hips: 38,
      shoulder: 14.5,
      armHole: 16,
      sleeveLength: 10.5,
      frontNeckDepth: 7,
      backNeckDepth: 9,
      blouseLength: 14.5,
      blouseStyle: 'Princess Cut',
      liningPreference: 'Butter Silk',
      paddingOption: 'With Bra Pads',
      specialNotes: ''
    }
  );

  // Pincode checker state
  const [pincode, setPincode] = useState('500033');
  const [pincodeChecked, setPincodeChecked] = useState(true);

  // New review state
  const [newReviewAuthor, setNewReviewAuthor] = useState('');
  const [newReviewCity, setNewReviewCity] = useState('');
  const [newReviewRating, setNewReviewRating] = useState(5);
  const [newReviewComment, setNewReviewComment] = useState('');
  const [visibleReviews, setVisibleReviews] = useState<ReviewItem[]>(product?.reviews || []);

  useEffect(() => {
    if (!product) return;
    setActiveImgIndex(0);
    setSelectedColor(product.colors[0]?.colorName || 'Default');
    setSelectedSize(product.availableSizes[0] || 'Unstitched');
  }, [product?.id]);

  useEffect(() => {
    if (!product) return;
    const bundledReviews = product.reviews || [];
    setVisibleReviews(bundledReviews);
    void loadProductReviews(product.id).then((cloudReviews) => {
      if (!cloudReviews.length) return;
      const ids = new Set(bundledReviews.map((review) => review.id));
      setVisibleReviews([...cloudReviews.filter((review) => !ids.has(review.id)), ...bundledReviews]);
    });
  // The repository callback is provided by context and is recreated with the
  // provider render. Product identity is the actual review-load boundary.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product?.id]);

  if (!product) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-20 text-center">
        <h2 className="text-xl font-serif">Product Not Found</h2>
        <button onClick={() => navigate('shop')} className="mt-4 text-[#8B1E3F] underline">
          Return to Shop
        </button>
      </div>
    );
  }

  const isSaved = isInWishlist(product.id);
  const isSoldOut = product.stockCount <= 0;
  const relatedProducts = products.filter((item) => item.id !== product.id && (item.category === product.category || item.fabric === product.fabric)).slice(0, 4);

  const handlePincodeCheck = (e: React.FormEvent) => {
    e.preventDefault();
    if (pincode.length === 6) {
      setPincodeChecked(true);
      showToast('Delivery Available', `Express delivery available for pincode ${pincode} in 2-3 business days.`);
    } else {
      showToast('Invalid Pincode', 'Please enter a valid 6-digit Indian delivery pincode.', 'error');
    }
  };

  const handleAddReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authSession) {
      showToast('Sign In Required', 'Please sign in before sharing a review.', 'info');
      navigate('login');
      return;
    }
    if (newReviewAuthor.trim() && newReviewComment.trim()) {
      const newRev: ReviewItem = {
        id: `rev-${Date.now()}`,
        userName: newReviewAuthor,
        userCity: newReviewCity || 'Hyderabad',
        rating: newReviewRating,
        date: 'Today',
        title: 'Customer Experience',
        comment: newReviewComment,
        verifiedBuyer: false
      };
      try {
        await submitReview(product.id, newRev);
        setVisibleReviews((reviews) => [newRev, ...reviews]);
        setNewReviewAuthor('');
        setNewReviewCity('');
        setNewReviewComment('');
      } catch (error) {
        showToast('Review Not Saved', error instanceof Error ? error.message : 'Please try again.', 'error');
      }
    }
  };

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: product.title,
        text: `Explore ${product.title} on AB Collection`,
        url: window.location.href
      }).catch(() => {});
    } else {
      navigator.clipboard.writeText(window.location.href);
      showToast('Link Copied', 'Product URL copied to clipboard.');
    }
  };

  return (
    <div className="bg-[#FAF7F2] min-h-screen py-6 sm:py-10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-xs text-stone-500 mb-6">
          <button onClick={() => navigate('home')} className="hover:text-[#8B1E3F]">Home</button>
          <span>/</span>
          <button onClick={() => navigate('shop')} className="hover:text-[#8B1E3F]">{product.category}</button>
          <span>/</span>
          <span className="text-stone-800 font-semibold truncate max-w-xs">{product.title}</span>
        </nav>

        {/* Main Grid: Gallery + Purchasing Area */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12">
          {/* Left Column: Gallery (7 Cols) */}
          <div className="lg:col-span-7 space-y-4">
            <div className="relative aspect-3/4 rounded-2xl overflow-hidden bg-stone-100 border border-[#E6D5B8] shadow-md group">
              <img
                src={product.images[activeImgIndex] || product.images[0]}
                alt={product.title}
                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
              />

              {/* Badges */}
              <div className="absolute top-4 left-4 flex flex-col gap-2 z-10">
                {product.isHandloomCertified && (
                  <span className="bg-[#16423C] text-[#DFBF77] text-xs font-bold uppercase tracking-wider px-3 py-1.5 rounded-lg shadow-md flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4" /> Silk Mark India Certified
                  </span>
                )}
                {product.isBestseller && (
                  <span className="bg-[#8B1E3F] text-white text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-lg shadow-md">
                    Popular Choice
                  </span>
                )}
              </div>

              {/* Wishlist & Share */}
              <div className="absolute top-4 right-4 flex flex-col gap-2 z-10">
                <button
                  id="pdp-wishlist-toggle"
                  onClick={() => toggleWishlist(product.id)}
                  className={`p-3 rounded-full backdrop-blur-md transition-all shadow-md ${
                    isSaved
                      ? 'bg-[#8B1E3F] text-white'
                      : 'bg-white/80 text-stone-700 hover:bg-white hover:text-[#8B1E3F]'
                  }`}
                  aria-label="Save to Wishlist"
                >
                  <Heart className={`w-5 h-5 ${isSaved ? 'fill-white' : ''}`} />
                </button>
                <button
                  id="pdp-share-btn"
                  onClick={handleShare}
                  className="p-3 rounded-full bg-white/80 hover:bg-white text-stone-700 hover:text-black backdrop-blur-md shadow-md"
                  aria-label="Share product"
                >
                  <Share2 className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Thumbnail Row */}
            {product.images.length > 1 && (
              <div className="flex gap-3 overflow-x-auto pb-2">
                {product.images.map((img, idx) => (
                  <button
                    key={idx}
                    id={`pdp-thumb-${idx}`}
                    onClick={() => setActiveImgIndex(idx)}
                    className={`w-20 sm:w-24 aspect-3/4 rounded-xl overflow-hidden border-2 shrink-0 transition-all ${
                      activeImgIndex === idx ? 'border-[#8B1E3F] shadow-md scale-102' : 'border-stone-200 opacity-70 hover:opacity-100'
                    }`}
                  >
                    <img src={img} alt="" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Right Column: Purchasing & Customization (5 Cols) */}
          <div className="lg:col-span-5 space-y-6">
            <div>
              <div className="flex items-center justify-between text-xs text-[#C5A059] font-bold uppercase tracking-wider">
                <span>{product.category}</span>
                <span className="text-stone-400 font-mono">SKU: {product.sku}</span>
              </div>

              <h1 className="text-2xl sm:text-3xl font-serif font-bold text-[#1A1715] mt-1.5 leading-snug">
                {product.title}
              </h1>

              <p className="text-xs text-stone-600 font-serif italic mt-1">
                {product.subtitle}
              </p>

              {/* Rating */}
              <div className="flex items-center gap-2 mt-3">
                <div className="flex items-center text-amber-500">
                  {[...Array(5)].map((_, i) => (
                    <Star
                      key={i}
                      className={`w-4 h-4 ${
                        i < Math.floor(product.rating) ? 'fill-amber-400 text-amber-400' : 'text-stone-300'
                      }`}
                    />
                  ))}
                </div>
                <span className="text-xs font-bold text-stone-800">{product.rating} / 5.0</span>
                <span className="text-xs text-stone-400">({product.reviewCount} client reviews)</span>
              </div>

              {/* Pricing */}
              <div className="flex items-baseline gap-3 mt-4 p-3.5 bg-white border border-[#E6D5B8] rounded-xl">
                <span className="text-2xl sm:text-3xl font-serif font-bold text-[#8B1E3F]">
                  {formatPrice(product.priceINR)}
                </span>
                {product.originalPriceINR && (
                  <span className="text-sm line-through text-stone-400 font-serif">
                    {formatPrice(product.originalPriceINR)}
                  </span>
                )}
                {product.discountPercentage && (
                  <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md">
                    Save {product.discountPercentage}%
                  </span>
                )}
                <span className="text-[11px] text-stone-400 ml-auto">Inclusive of all GST taxes</span>
              </div>
            </div>

            {/* Color Swatches */}
            {product.colors.length > 0 && (
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-stone-800 block mb-2">
                  Select Shade: <span className="text-[#8B1E3F]">{selectedColor}</span>
                </label>
                <div className="flex gap-2.5">
                  {product.colors.map((c) => (
                    <button
                      key={c.colorName}
                      id={`pdp-color-${c.colorName.replace(/\s+/g, '-')}`}
                      onClick={() => setSelectedColor(c.colorName)}
                      className={`w-8 h-8 rounded-full border-2 flex items-center justify-center transition-all ${
                        selectedColor === c.colorName ? 'border-[#8B1E3F] scale-110 shadow-sm' : 'border-stone-200'
                      }`}
                      style={{ backgroundColor: c.colorHex }}
                      title={c.colorName}
                    >
                      {selectedColor === c.colorName && <Check className="w-4 h-4 text-white drop-shadow-xs" />}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Size Selector */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-bold uppercase tracking-wider text-stone-800">
                  Select Size
                </label>
                <button
                  id="pdp-size-guide-btn"
                  onClick={() => setIsSizeGuideOpen(true)}
                  className="text-xs text-[#8B1E3F] underline font-semibold hover:text-[#721C24] flex items-center gap-1"
                >
                  <Ruler className="w-3.5 h-3.5" /> Size Guide
                </button>
              </div>

              <div className="flex flex-wrap gap-2">
                {product.availableSizes.map((size) => (
                  <button
                    key={size}
                    id={`pdp-size-${size.replace(/\s+/g, '-')}`}
                    onClick={() => {
                      setSelectedSize(size);
                      if (size === 'Custom Made-to-Measure') setIsCustomTailoring(true);
                    }}
                    className={`px-4 py-2 text-xs font-semibold rounded-lg border transition-all ${
                      selectedSize === size
                        ? 'bg-[#8B1E3F] text-white border-[#8B1E3F] shadow-sm'
                        : 'bg-white text-stone-700 border-[#E6D5B8] hover:border-[#8B1E3F]'
                    }`}
                  >
                    {size}
                  </button>
                ))}
              </div>
            </div>

            {/* Custom Made-to-Measure Blouse Drawer */}
            {product.customStitchingAvailable && (
              <div className="border border-[#DFBF77] rounded-2xl bg-[#FAF4ED] p-4 sm:p-5 shadow-xs space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-full bg-[#8B1E3F] text-white flex items-center justify-center">
                      <Scissors className="w-4 h-4 text-[#DFBF77]" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold uppercase tracking-wider text-[#8B1E3F]">
                        Custom Blouse Tailoring
                      </h4>
                      <p className="text-[11px] text-stone-600">
                        {product.customStitchingFeeINR > 0
                          ? `+${formatPrice(product.customStitchingFeeINR)} Hand-tailored to your measurements`
                          : 'Complimentary Made-to-Measure with 2-inch inner margin'}
                      </p>
                    </div>
                  </div>

                  <input
                    id="pdp-toggle-custom-tailoring-checkbox"
                    type="checkbox"
                    checked={isCustomTailoring}
                    onChange={(e) => setIsCustomTailoring(e.target.checked)}
                    className="w-5 h-5 accent-[#8B1E3F] cursor-pointer"
                  />
                </div>

                {isCustomTailoring && (
                  <div className="pt-3 border-t border-[#DFBF77]/40 space-y-4">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-semibold text-stone-700">Enter Your Body Measurements (Inches):</span>
                      <button
                        onClick={() => {
                          if (customer.savedMeasurements) {
                            setMeasurements(customer.savedMeasurements);
                            showToast('Measurements Loaded', 'Loaded your saved measurements from account profile.');
                          }
                        }}
                        className="text-[#8B1E3F] font-bold underline"
                      >
                        Load Saved Profile
                      </button>
                    </div>

                    <div className="grid grid-cols-3 gap-2.5">
                      <div>
                        <label className="text-[10px] uppercase font-bold text-stone-500 block">Bust (in)</label>
                        <input
                          type="number"
                          value={measurements.bust}
                          onChange={(e) => setMeasurements({ ...measurements, bust: parseFloat(e.target.value) || 0 })}
                          className="w-full text-xs p-2 bg-white border border-[#E6D5B8] rounded font-mono"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] uppercase font-bold text-stone-500 block">Waist (in)</label>
                        <input
                          type="number"
                          value={measurements.waist}
                          onChange={(e) => setMeasurements({ ...measurements, waist: parseFloat(e.target.value) || 0 })}
                          className="w-full text-xs p-2 bg-white border border-[#E6D5B8] rounded font-mono"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] uppercase font-bold text-stone-500 block">Shoulder (in)</label>
                        <input
                          type="number"
                          value={measurements.shoulder}
                          onChange={(e) => setMeasurements({ ...measurements, shoulder: parseFloat(e.target.value) || 0 })}
                          className="w-full text-xs p-2 bg-white border border-[#E6D5B8] rounded font-mono"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] uppercase font-bold text-stone-500 block">Armhole (in)</label>
                        <input
                          type="number"
                          value={measurements.armHole}
                          onChange={(e) => setMeasurements({ ...measurements, armHole: parseFloat(e.target.value) || 0 })}
                          className="w-full text-xs p-2 bg-white border border-[#E6D5B8] rounded font-mono"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] uppercase font-bold text-stone-500 block">Sleeve Length</label>
                        <input
                          type="number"
                          value={measurements.sleeveLength}
                          onChange={(e) => setMeasurements({ ...measurements, sleeveLength: parseFloat(e.target.value) || 0 })}
                          className="w-full text-xs p-2 bg-white border border-[#E6D5B8] rounded font-mono"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] uppercase font-bold text-stone-500 block">Blouse Length</label>
                        <input
                          type="number"
                          value={measurements.blouseLength}
                          onChange={(e) => setMeasurements({ ...measurements, blouseLength: parseFloat(e.target.value) || 0 })}
                          className="w-full text-xs p-2 bg-white border border-[#E6D5B8] rounded font-mono"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2.5">
                      <div>
                        <label className="text-[10px] uppercase font-bold text-stone-500 block mb-1">Blouse Cut Style</label>
                        <select
                          value={measurements.blouseStyle}
                          onChange={(e) => setMeasurements({ ...measurements, blouseStyle: e.target.value as any })}
                          className="w-full text-xs p-2 bg-white border border-[#E6D5B8] rounded font-semibold text-stone-800"
                        >
                          <option value="Princess Cut">Princess Cut (Most Popular)</option>
                          <option value="Classic Round">Classic Round Neck</option>
                          <option value="Sweetheart">Sweetheart Neck</option>
                          <option value="Deep V-Neck">Deep V-Neck</option>
                          <option value="Boat Neck">Boat Neck</option>
                          <option value="High Collar Backless">High Collar Backless</option>
                        </select>
                      </div>

                      <div>
                        <label className="text-[10px] uppercase font-bold text-stone-500 block mb-1">Bra Padding</label>
                        <select
                          value={measurements.paddingOption}
                          onChange={(e) => setMeasurements({ ...measurements, paddingOption: e.target.value as any })}
                          className="w-full text-xs p-2 bg-white border border-[#E6D5B8] rounded font-semibold text-stone-800"
                        >
                          <option value="With Bra Pads">With Built-in Bra Pads</option>
                          <option value="Without Pads">Without Pads (Natural)</option>
                        </select>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Pincode & Delivery Checker */}
            <div className="p-4 bg-white border border-[#E6D5B8] rounded-xl space-y-2">
              <span className="text-xs font-bold uppercase tracking-wider text-stone-800 flex items-center gap-1.5">
                <Truck className="w-4 h-4 text-[#8B1E3F]" /> Check Delivery & Courier Schedule
              </span>
              <form onSubmit={handlePincodeCheck} className="flex gap-2">
                <input
                  id="pincode-checker-input"
                  type="text"
                  maxLength={6}
                  value={pincode}
                  onChange={(e) => setPincode(e.target.value)}
                  placeholder="Enter 6-digit Pincode"
                  className="flex-1 px-3 py-2 text-xs border border-[#E6D5B8] rounded-lg font-mono focus:outline-hidden focus:border-[#8B1E3F]"
                />
                <button
                  id="pincode-checker-submit-btn"
                  type="submit"
                  className="bg-[#1A1715] hover:bg-[#8B1E3F] text-white text-xs uppercase font-semibold px-4 py-2 rounded-lg transition-colors"
                >
                  Verify
                </button>
              </form>
              {pincodeChecked && (
                <div className="text-[11px] text-emerald-800 bg-emerald-50 p-2 rounded-md flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span>Delivery is available to <strong>{pincode}</strong>. Estimated dispatch timing is shared after order confirmation.</span>
                </div>
              )}
            </div>

            {/* Urgency Meter */}
            <div className={`flex items-center gap-2 text-xs font-semibold border p-2.5 rounded-lg ${isSoldOut ? 'border-stone-300 bg-stone-100 text-stone-600' : product.stockCount <= 3 ? 'border-amber-200 bg-amber-50 text-amber-800' : 'border-emerald-200 bg-emerald-50 text-emerald-800'}`}>
              <Clock className="w-4 h-4 shrink-0" />
              <span>{isSoldOut ? 'Currently unavailable' : product.stockCount <= 3 ? `Only ${product.stockCount} handcrafted pieces remaining.` : 'In stock and ready for your selection.'}</span>
            </div>

            {/* CTA Action Buttons */}
            <div className="space-y-3 pt-2">
              <div className="flex gap-3">
                <button
                  id="pdp-add-to-cart-btn"
                  disabled={isSoldOut}
                  onClick={() => addToCart(product, selectedColor, selectedSize, quantity, isCustomTailoring, measurements)}
                  className="flex-1 bg-[#8B1E3F] hover:bg-[#721C24] text-white text-xs sm:text-sm font-semibold uppercase tracking-widest py-4 px-6 rounded-xl flex items-center justify-center gap-2 shadow-xl hover:shadow-2xl transition-all disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <ShoppingBag className="w-4 h-4" /> {isSoldOut ? 'Sold Out' : 'Add to Shopping Bag'}
                </button>

                <button
                  id="pdp-buy-now-btn"
                  disabled={isSoldOut}
                  onClick={() => buyNow(product, selectedColor, selectedSize, quantity, isCustomTailoring, measurements)}
                  className="flex-1 bg-[#1A1715] hover:bg-black text-white text-xs sm:text-sm font-semibold uppercase tracking-widest py-4 px-6 rounded-xl flex items-center justify-center gap-2 shadow-lg transition-all disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <span>Buy Now</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              <a href={whatsappChatUrl(cms.contact.whatsappUrl, `Hello AB Collection,\n\nI am interested in:\n\nProduct: ${product.title}\nProduct ID: ${product.sku || product.id}\nSelected size: ${selectedSize}\nSelected colour: ${selectedColor}\n\nPlease share availability and details.`) || undefined} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-2 text-xs text-stone-500 pt-1 hover:text-[#8B1E3F] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8B1E3F]">
                <Phone className="w-3.5 h-3.5 text-[#8B1E3F]" />
                <span>Enquire about this style on WhatsApp.</span>
              </a>
            </div>
          </div>
        </div>

        {/* Detailed Tabs: Specifications, Craftsmanship, Shipping, Reviews */}
        <div className="mt-16 bg-white border border-[#E6D5B8] rounded-2xl p-6 sm:p-10 shadow-xs">
          {/* Tab headers */}
          <div className="flex border-b border-[#E6D5B8] gap-4 sm:gap-8 overflow-x-auto">
            <button
              id="tab-btn-details"
              onClick={() => setActiveTab('details')}
              className={`pb-4 text-xs sm:text-sm uppercase tracking-wider font-bold transition-all relative ${
                activeTab === 'details' ? 'text-[#8B1E3F]' : 'text-stone-500 hover:text-black'
              }`}
            >
              Product & Fabric Details
              {activeTab === 'details' && <span className="absolute bottom-0 left-0 w-full h-0.5 bg-[#8B1E3F]" />}
            </button>

            <button
              id="tab-btn-craft"
              onClick={() => setActiveTab('craft')}
              className={`pb-4 text-xs sm:text-sm uppercase tracking-wider font-bold transition-all relative ${
                activeTab === 'craft' ? 'text-[#8B1E3F]' : 'text-stone-500 hover:text-black'
              }`}
            >
              Artisan Weave & Zari Heritage
              {activeTab === 'craft' && <span className="absolute bottom-0 left-0 w-full h-0.5 bg-[#8B1E3F]" />}
            </button>

            <button
              id="tab-btn-shipping"
              onClick={() => setActiveTab('shipping')}
              className={`pb-4 text-xs sm:text-sm uppercase tracking-wider font-bold transition-all relative ${
                activeTab === 'shipping' ? 'text-[#8B1E3F]' : 'text-stone-500 hover:text-black'
              }`}
            >
              Shipping & 7-Day Returns
              {activeTab === 'shipping' && <span className="absolute bottom-0 left-0 w-full h-0.5 bg-[#8B1E3F]" />}
            </button>

            <button
              id="tab-btn-reviews"
              onClick={() => setActiveTab('reviews')}
              className={`pb-4 text-xs sm:text-sm uppercase tracking-wider font-bold transition-all relative ${
                activeTab === 'reviews' ? 'text-[#8B1E3F]' : 'text-stone-500 hover:text-black'
              }`}
            >
              Client Reviews ({product.reviewCount})
              {activeTab === 'reviews' && <span className="absolute bottom-0 left-0 w-full h-0.5 bg-[#8B1E3F]" />}
            </button>
          </div>

          {/* Tab Content */}
          <div className="pt-8">
            {activeTab === 'details' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-xs sm:text-sm text-stone-700 leading-relaxed">
                <div>
                  <h3 className="font-serif font-bold text-lg text-[#1A1715] mb-3">Product Description</h3>
                  <p>{product.description}</p>
                  {product.blouseLength && (
                    <div className="mt-4 p-3 bg-[#FAF7F2] rounded-lg border border-[#E6D5B8]">
                      <strong>Blouse Fabric:</strong> {product.blouseLength}
                    </div>
                  )}
                  {product.sareeLength && (
                    <div className="mt-2 p-3 bg-[#FAF7F2] rounded-lg border border-[#E6D5B8]">
                      <strong>Saree Length:</strong> {product.sareeLength}
                    </div>
                  )}
                </div>

                <div className="space-y-4">
                  <h3 className="font-serif font-bold text-lg text-[#1A1715]">Fabric Specifications</h3>
                  <table className="w-full text-xs">
                    <tbody className="divide-y divide-[#E6D5B8]/60">
                      <tr>
                        <td className="py-2 font-semibold text-stone-500">Fabric Composition</td>
                        <td className="py-2 font-bold text-stone-900">{product.fabric}</td>
                      </tr>
                      <tr>
                        <td className="py-2 font-semibold text-stone-500">Zari Specification</td>
                        <td className="py-2 text-stone-900">{product.zariType || 'Pure Tested Metallic Zari'}</td>
                      </tr>
                      <tr>
                        <td className="py-2 font-semibold text-stone-500">Weight</td>
                        <td className="py-2 text-stone-900">{product.weightGrams ? `${product.weightGrams} grams (Pure Silk Density)` : 'Standard'}</td>
                      </tr>
                      <tr>
                        <td className="py-2 font-semibold text-stone-500">Care Instructions</td>
                        <td className="py-2 text-stone-900">{product.careInstructions}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {activeTab === 'craft' && (
              <div className="space-y-4 text-xs sm:text-sm text-stone-700 leading-relaxed max-w-3xl">
                <div className="flex items-center gap-3 p-4 bg-[#16423C]/10 border border-[#16423C]/30 rounded-xl text-[#16423C]">
                  <ShieldCheck className="w-6 h-6 shrink-0" />
                  <div>
                    <h4 className="font-bold text-sm">Silk Mark Organization of India Certification</h4>
                    <p className="text-xs">
                      100% natural pure mulberry silk verified through burning & laboratory warp-weft testing.
                    </p>
                  </div>
                </div>
                <p>{product.craftDetails}</p>
              </div>
            )}

            {activeTab === 'shipping' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-xs sm:text-sm text-stone-700">
                <div className="space-y-3">
                  <h4 className="font-bold text-stone-900 flex items-center gap-2">
                    <Truck className="w-4 h-4 text-[#8B1E3F]" /> Domestic & Global Air Transit
                  </h4>
                  <ul className="space-y-2 list-disc list-inside text-stone-600">
                    <li>Free Express Insured shipping on orders above ₹5,000.</li>
                    <li>Orders dispatched in custom velvet heirloom keepsake boxes.</li>
                    <li>Worldwide delivery to USA, UK, UAE, Australia within 4-7 business days via DHL.</li>
                  </ul>
                </div>
                <div className="space-y-3">
                  <h4 className="font-bold text-stone-900 flex items-center gap-2">
                    <RotateCcw className="w-4 h-4 text-[#8B1E3F]" /> 7-Day Exchange Guarantee
                  </h4>
                  <p className="text-stone-600 leading-relaxed">
                    Unstitched sarees and jewelry may be exchanged within 7 days of delivery. Custom tailored items include complimentary alteration support.
                  </p>
                </div>
              </div>
            )}

            {activeTab === 'reviews' && (
              <div className="space-y-8">
                {/* Existing Reviews */}
                <div className="space-y-4">
                  {visibleReviews.length === 0 ? (
                    <p className="text-xs text-stone-500 italic">No reviews yet for this limited edition masterweave. Be the first bride to review!</p>
                  ) : (
                    visibleReviews.map((rev) => (
                      <div key={rev.id} className="p-4 bg-[#FAF7F2] border border-[#E6D5B8] rounded-xl space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-xs text-stone-900">{rev.userName}</span>
                            <span className="text-[11px] text-stone-500">({rev.userCity})</span>
                            {rev.verifiedBuyer && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" title="Verified Buyer" />}
                          </div>
                          <span className="text-[11px] text-stone-400 font-mono">{rev.date}</span>
                        </div>

                        <div className="flex text-amber-400">
                          {[...Array(rev.rating)].map((_, i) => (
                            <Star key={i} className="w-3.5 h-3.5 fill-amber-400" />
                          ))}
                        </div>

                        <h5 className="font-semibold text-xs text-stone-800">{rev.title}</h5>
                        <p className="text-xs text-stone-600 leading-relaxed">{rev.comment}</p>
                      </div>
                    ))
                  )}
                </div>

                {/* Review Submission Form */}
                <form onSubmit={handleAddReview} className="p-6 bg-[#FAF7F2] border border-[#E6D5B8] rounded-xl space-y-4">
                  <h4 className="font-serif font-bold text-base text-stone-900">Share Your Experience</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <input
                      type="text"
                      required
                      value={newReviewAuthor}
                      onChange={(e) => setNewReviewAuthor(e.target.value)}
                      placeholder="Your Full Name"
                      className="text-xs p-2.5 bg-white border border-[#E6D5B8] rounded-lg"
                    />
                    <input
                      type="text"
                      value={newReviewCity}
                      onChange={(e) => setNewReviewCity(e.target.value)}
                      placeholder="City / Country (e.g. Hyderabad, London)"
                      className="text-xs p-2.5 bg-white border border-[#E6D5B8] rounded-lg"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-stone-700 block mb-1">Your Rating:</label>
                    <div className="flex gap-2 text-amber-500">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          key={star}
                          type="button"
                          onClick={() => setNewReviewRating(star)}
                          className="p-1 hover:scale-110 transition-transform"
                        >
                          <Star className={`w-5 h-5 ${star <= newReviewRating ? 'fill-amber-400' : 'text-stone-300'}`} />
                        </button>
                      ))}
                    </div>
                  </div>

                  <textarea
                    required
                    rows={3}
                    value={newReviewComment}
                    onChange={(e) => setNewReviewComment(e.target.value)}
                    placeholder="Tell us about the drape, zari luster, tailoring fit, and fabric quality..."
                    className="w-full text-xs p-3 bg-white border border-[#E6D5B8] rounded-lg focus:outline-hidden focus:border-[#8B1E3F]"
                  />

                  <button
                    type="submit"
                    className="bg-[#8B1E3F] hover:bg-[#721C24] text-white text-xs uppercase font-semibold tracking-wider px-6 py-2.5 rounded-lg transition-colors"
                  >
                    Submit Review
                  </button>
                </form>
              </div>
            )}
          </div>
        </div>
        {relatedProducts.length > 0 && <section className="mt-16 border-t border-[#ddd7cf] pt-12"><div className="flex items-end justify-between"><div><p className="text-[10px] uppercase tracking-[.2em] text-stone-500">Continue the story</p><h2 className="mt-2 font-serif text-4xl">You may also like</h2></div><button onClick={() => navigate('shop')} className="text-[11px] font-semibold uppercase tracking-[.12em] underline underline-offset-4">Shop all</button></div><div className="mt-8 grid grid-cols-2 gap-x-4 gap-y-9 sm:grid-cols-4 sm:gap-x-6">{relatedProducts.map((item) => <ProductCard key={item.id} product={item} />)}</div></section>}
      </div>
    </div>
  );
};
