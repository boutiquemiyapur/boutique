import React, { useState } from 'react';
import { useStore } from '../../context/StoreContext';
import {
  X,
  ShoppingBag,
  Plus,
  Minus,
  Trash2,
  Gift,
  Tag,
  ArrowRight,
  ShieldCheck,
  Scissors,
  Check
} from 'lucide-react';
import { motion } from 'motion/react';
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock';

export const CartDrawer: React.FC = () => {
  const {
    isCartDrawerOpen,
    setIsCartDrawerOpen,
    cart,
    updateCartQuantity,
    removeFromCart,
    formatPrice,
    cartSubtotalINR,
    cartTailoringTotalINR,
    cartDiscountINR,
    cartTaxINR,
    cartShippingINR,
    cartTotalINR,
    appliedCoupon,
    applyCoupon,
    removeCoupon,
    freeShippingThresholdINR,
    navigate,
    requireAuth
  } = useStore();

  useBodyScrollLock(isCartDrawerOpen);

  const [couponInput, setCouponInput] = useState('');
  const [showGiftOptions, setShowGiftOptions] = useState(false);
  const [giftNote, setGiftNote] = useState('');

  if (!isCartDrawerOpen) return null;

  const freeShippingProgress = Math.min(100, (cartSubtotalINR / freeShippingThresholdINR) * 100);
  const amountNeededForFreeShipping = Math.max(0, freeShippingThresholdINR - cartSubtotalINR);

  const handleApplyCoupon = (e: React.FormEvent) => {
    e.preventDefault();
    if (couponInput.trim()) {
      const success = applyCoupon(couponInput);
      if (success) setCouponInput('');
    }
  };

  return (
    <div
      id="cart-drawer-backdrop"
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs transition-opacity"
      onClick={() => setIsCartDrawerOpen(false)}
    >
      <motion.div
        id="cart-drawer-container"
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'tween', duration: 0.3 }}
        onClick={(e) => e.stopPropagation()}
        className="fixed inset-y-0 right-0 max-w-lg w-full bg-[#FAF7F2] shadow-2xl flex flex-col z-50 border-l border-[#E6D5B8]"
      >
        {/* Header */}
        <div className="p-5 border-b border-[#E6D5B8] flex items-center justify-between bg-white">
          <div className="flex items-center gap-2">
            <ShoppingBag className="w-5 h-5 text-[#8B1E3F]" />
            <h2 className="text-lg font-serif font-bold text-[#1A1715]">
              Your Shopping Bag ({cart.length})
            </h2>
          </div>
          <button
            id="close-cart-drawer-btn"
            onClick={() => setIsCartDrawerOpen(false)}
            className="p-1 text-stone-500 hover:text-black rounded-full hover:bg-stone-100"
            aria-label="Close Bag"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Free Shipping Progress Bar */}
        <div className="bg-[#FAF4ED] px-5 py-3 border-b border-[#E6D5B8]">
          <div className="flex items-center justify-between text-xs font-semibold text-stone-700 mb-1.5">
            {amountNeededForFreeShipping === 0 ? (
              <span className="text-emerald-700 flex items-center gap-1 font-bold">
                <Check className="w-3.5 h-3.5" /> Congratulations! You unlocked Free Express Shipping
              </span>
            ) : (
              <span>
                Add <strong className="text-[#8B1E3F]">{formatPrice(amountNeededForFreeShipping)}</strong> more for Free Shipping
              </span>
            )}
            <span className="text-[11px] text-stone-500 font-mono">{Math.round(freeShippingProgress)}%</span>
          </div>
          <div className="w-full h-2 bg-stone-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-[#C5A059] to-[#8B1E3F] transition-all duration-500 rounded-full"
              style={{ width: `${freeShippingProgress}%` }}
            />
          </div>
        </div>

        {/* Line Items List */}
        <div className="flex-1 overflow-y-auto overscroll-contain p-5 space-y-4">
          {cart.length === 0 ? (
            <div className="text-center py-16">
              <ShoppingBag className="w-12 h-12 text-stone-300 mx-auto mb-3" />
              <h3 className="text-base font-serif font-semibold text-stone-700">Your Bag is Empty</h3>
              <p className="text-xs text-stone-500 mt-1 max-w-xs mx-auto">
                Explore our handwoven Kanjeevarams, bridal lehengas, and custom festive styles.
              </p>
              <button
                id="empty-cart-shop-now-btn"
                onClick={() => {
                  setIsCartDrawerOpen(false);
                  navigate('shop');
                }}
                className="mt-6 inline-flex items-center gap-1.5 bg-[#8B1E3F] text-white text-xs uppercase tracking-wider font-semibold px-6 py-3 rounded-lg hover:bg-[#721C24] transition-colors shadow-md"
              >
                Explore Collection <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          ) : (
            cart.map((item) => (
              <div
                key={item.cartItemId}
                id={`cart-item-${item.cartItemId}`}
                className="flex gap-4 p-3.5 bg-white border border-[#E6D5B8] rounded-xl shadow-xs hover:border-[#C5A059] transition-all"
              >
                <img
                  src={item.product.images[0]}
                  alt={item.product.title}
                  className="w-20 h-24 object-cover rounded-lg shrink-0 cursor-pointer"
                  onClick={() => {
                    setIsCartDrawerOpen(false);
                    navigate('product-detail', item.product.id);
                  }}
                />

                <div className="flex-1 min-w-0 flex flex-col justify-between">
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <h4
                        onClick={() => {
                          setIsCartDrawerOpen(false);
                          navigate('product-detail', item.product.id);
                        }}
                        className="text-xs font-semibold text-[#1A1715] line-clamp-1 cursor-pointer hover:text-[#8B1E3F]"
                      >
                        {item.product.title}
                      </h4>
                      <button
                        id={`delete-cart-item-${item.cartItemId}`}
                        onClick={() => removeFromCart(item.cartItemId)}
                        className="text-stone-400 hover:text-rose-600 p-1"
                        aria-label="Remove item"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="flex flex-wrap gap-2 text-[11px] text-stone-500 mt-1">
                      <span>Color: <strong className="text-stone-800">{item.selectedColor}</strong></span>
                      <span>•</span>
                      <span>Size: <strong className="text-stone-800">{item.selectedSize}</strong></span>
                    </div>

                    {item.isCustomTailored && (
                      <div className="mt-1 inline-flex items-center gap-1 text-[10px] font-bold text-[#8B1E3F] bg-[#8B1E3F]/10 px-2 py-0.5 rounded-sm">
                        <Scissors className="w-2.5 h-2.5" /> Custom Made-to-Measure (+{formatPrice(item.tailoringFeeINR)})
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between mt-3 pt-2 border-t border-stone-100">
                    <div className="flex items-center border border-[#E6D5B8] rounded-md bg-[#FAF7F2]">
                      <button
                        id={`cart-minus-qty-${item.cartItemId}`}
                        onClick={() => updateCartQuantity(item.cartItemId, item.quantity - 1)}
                        className="p-1 text-stone-600 hover:text-black"
                        aria-label="Decrease quantity"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="px-2 text-xs font-semibold font-mono text-stone-800">
                        {item.quantity}
                      </span>
                      <button
                        id={`cart-plus-qty-${item.cartItemId}`}
                        onClick={() => updateCartQuantity(item.cartItemId, item.quantity + 1)}
                        className="p-1 text-stone-600 hover:text-black"
                        aria-label="Increase quantity"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>

                    <div className="text-right">
                      <span className="text-xs font-serif font-bold text-[#8B1E3F]">
                        {formatPrice((item.product.priceINR + (item.isCustomTailored ? item.tailoringFeeINR : 0)) * item.quantity)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}

          {/* Gift Packaging Box */}
          {cart.length > 0 && (
            <div className="bg-white border border-[#E6D5B8] rounded-xl p-3.5 space-y-2">
              <div
                className="flex items-center justify-between cursor-pointer"
                onClick={() => setShowGiftOptions(!showGiftOptions)}
              >
                <div className="flex items-center gap-2">
                  <Gift className="w-4 h-4 text-[#C5A059]" />
                  <span className="text-xs font-semibold text-stone-800">Complimentary Velvet Gift Box & Note</span>
                </div>
                <span className="text-xs text-[#8B1E3F] font-bold">{showGiftOptions ? 'Hide' : 'Add'}</span>
              </div>
              {showGiftOptions && (
                <div className="pt-2">
                  <textarea
                    id="gift-note-textarea"
                    value={giftNote}
                    onChange={(e) => setGiftNote(e.target.value)}
                    placeholder="Write a personalized heartfelt message to be printed on royal gilded parchment..."
                    className="w-full text-xs p-2.5 border border-[#E6D5B8] rounded-md bg-[#FAF7F2] focus:outline-hidden focus:border-[#8B1E3F]"
                    rows={2}
                  />
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer & Checkout Area */}
        {cart.length > 0 && (
          <div className="p-5 border-t border-[#E6D5B8] bg-white space-y-3 shadow-lg">
            {/* Promo Code Input */}
            <form onSubmit={handleApplyCoupon} className="flex gap-2">
              <div className="relative flex-1">
                <Tag className="w-3.5 h-3.5 text-stone-400 absolute left-3 top-2.5" />
                <input
                  id="coupon-code-input"
                  type="text"
                  value={couponInput}
                  onChange={(e) => setCouponInput(e.target.value)}
                  placeholder="Enter promo code (e.g. WELCOME10)"
                  className="w-full pl-8 pr-3 py-2 text-xs border border-[#E6D5B8] rounded-md uppercase font-mono focus:outline-hidden focus:border-[#8B1E3F] bg-[#FAF7F2]"
                />
              </div>
              <button
                id="apply-coupon-btn"
                type="submit"
                className="bg-[#1A1715] hover:bg-[#8B1E3F] text-white text-xs font-semibold uppercase px-4 py-2 rounded-md transition-colors"
              >
                Apply
              </button>
            </form>

            {appliedCoupon && (
              <div className="flex items-center justify-between text-xs bg-emerald-50 text-emerald-800 border border-emerald-200 px-3 py-1.5 rounded-md">
                <span>Code <strong>{appliedCoupon.code}</strong> applied (-{formatPrice(cartDiscountINR)})</span>
                <button
                  id="remove-applied-coupon-btn"
                  onClick={removeCoupon}
                  className="text-xs text-rose-600 font-bold hover:underline"
                >
                  Remove
                </button>
              </div>
            )}

            {/* Price breakdown */}
            <div className="space-y-1.5 text-xs text-stone-600 pt-2 border-t border-stone-100">
              <div className="flex justify-between">
                <span>Subtotal</span>
                <span className="font-semibold text-stone-900">{formatPrice(cartSubtotalINR)}</span>
              </div>
              {cartTailoringTotalINR > 0 && (
                <div className="flex justify-between">
                  <span>Custom Tailoring Charges</span>
                  <span className="font-semibold text-stone-900">+{formatPrice(cartTailoringTotalINR)}</span>
                </div>
              )}
              {cartDiscountINR > 0 && (
                <div className="flex justify-between text-emerald-700">
                  <span>Special Discount</span>
                  <span className="font-semibold">-{formatPrice(cartDiscountINR)}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span>Estimated GST (5%)</span>
                <span>{formatPrice(cartTaxINR)}</span>
              </div>
              <div className="flex justify-between">
                <span>Shipping</span>
                <span>{cartShippingINR === 0 ? <strong className="text-emerald-700 font-bold">FREE</strong> : formatPrice(cartShippingINR)}</span>
              </div>
              <div className="flex justify-between text-sm font-serif font-bold text-[#8B1E3F] pt-2 border-t border-stone-200">
                <span>Grand Total</span>
                <span>{formatPrice(cartTotalINR)}</span>
              </div>
            </div>

            {/* Checkout CTA */}
            <button
              id="proceed-to-checkout-btn"
              onClick={() => {
                setIsCartDrawerOpen(false);
                requireAuth('checkout');
              }}
              className="w-full bg-[#8B1E3F] hover:bg-[#721C24] text-white font-semibold text-xs uppercase tracking-widest py-3.5 px-4 rounded-lg flex items-center justify-center gap-2 shadow-lg hover:shadow-xl transition-all"
            >
              Proceed to Secure Checkout <ArrowRight className="w-4 h-4" />
            </button>

            <div className="flex items-center justify-center gap-2 text-[10px] text-stone-400">
              <ShieldCheck className="w-3.5 h-3.5 text-[#C5A059]" /> 100% Authentic Handloom & Secure 256-Bit SSL Checkout
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
};
