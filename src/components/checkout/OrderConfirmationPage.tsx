import React, { useEffect } from 'react';
import { useStore } from '../../context/StoreContext';
import {
  CheckCircle2,
  Truck,
  Printer,
  ArrowRight,
  Scissors
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { BrandMark } from '../../config/brand';

export const OrderConfirmationPage: React.FC = () => {
  const { currentOrder, formatPrice, navigate } = useStore();

  useEffect(() => {
    try {
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#8B1E3F', '#DFBF77', '#16423C', '#C5A059']
      });
    } catch {
      // safe fallback
    }
  }, []);

  if (!currentOrder) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-20 text-center">
        <h2 className="text-2xl font-serif">No Recent Order Found</h2>
        <button
          onClick={() => navigate('shop')}
          className="mt-4 bg-[#8B1E3F] text-white text-xs uppercase px-6 py-3 rounded-lg"
        >
          Return to Boutique
        </button>
      </div>
    );
  }

  return (
    <div className="bg-[#FAF7F2] min-h-screen py-10 sm:py-16">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Success Card Header */}
        <div className="bg-white border border-[#E6D5B8] rounded-3xl p-8 sm:p-12 shadow-sm text-center space-y-4">
          <div className="flex justify-center"><BrandMark className="text-lg" /></div>
          <div className="w-16 h-16 rounded-full bg-emerald-100 border-2 border-emerald-500 text-emerald-600 mx-auto flex items-center justify-center shadow-md">
            <CheckCircle2 className="w-10 h-10" />
          </div>

          <span className="text-xs uppercase tracking-[0.25em] font-bold text-[#8B1E3F]">
            Order request received
          </span>

          <h1 className="text-2xl sm:text-4xl font-serif font-bold text-[#1A1715]">
            Thank You, {currentOrder.shippingAddress.fullName}!
          </h1>

          <p className="text-xs sm:text-sm text-stone-600 max-w-lg mx-auto font-sans leading-relaxed">
            Your Cash on Delivery order <strong>#{currentOrder.orderNumber}</strong> is recorded. Fulfilment and dispatch details will be shown in your order status when they are available.
          </p>

          <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
            <button
              id="confirm-track-order-btn"
              onClick={() => navigate('order-tracking', undefined, currentOrder.id)}
              className="bg-[#8B1E3F] hover:bg-[#721C24] text-white text-xs uppercase font-semibold tracking-wider px-6 py-3 rounded-xl flex items-center gap-2 shadow-md transition-all"
            >
              <Truck className="w-4 h-4" /> View order status
            </button>

            <button
              id="confirm-print-btn"
              onClick={() => window.print()}
              className="bg-stone-100 hover:bg-stone-200 text-stone-800 text-xs uppercase font-semibold tracking-wider px-6 py-3 rounded-xl flex items-center gap-2 transition-all"
            >
              <Printer className="w-4 h-4" /> Print order summary
            </button>
          </div>
        </div>

        {/* Order Details Breakdown */}
        <div className="mt-8 bg-white border border-[#E6D5B8] rounded-3xl p-6 sm:p-8 shadow-xs space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#E6D5B8] text-xs">
            <div>
              <span className="text-stone-400">Order Number:</span>
              <span className="font-mono font-bold text-stone-900 ml-1.5">{currentOrder.orderNumber}</span>
            </div>
            {currentOrder.estimatedDeliveryDate && <div>
              <span className="text-stone-400">Estimated Delivery:</span>
              <span className="font-bold text-emerald-800 ml-1.5">{currentOrder.estimatedDeliveryDate}</span>
            </div>}
            <div>
              <span className="text-stone-400">Payment:</span>
              <span className="font-bold text-stone-900 uppercase ml-1.5">{currentOrder.paymentMethod.replace('_', ' ')} · {currentOrder.paymentStatus}</span>
            </div>
          </div>

          {/* Items */}
          <div className="space-y-4">
            <h3 className="font-serif font-bold text-base text-stone-900">Ensembles in Order</h3>
            <div className="divide-y divide-[#E6D5B8]/60">
              {currentOrder.items.map((item) => (
                <div key={item.cartItemId} className="py-3 flex items-center gap-4 text-xs">
                  <img
                    src={item.product.images[0]}
                    alt=""
                    className="w-16 h-20 object-cover rounded-lg shrink-0 border border-[#E6D5B8]"
                  />
                  <div className="flex-1 min-w-0">
                    <h4 className="font-bold text-stone-900">{item.product.title}</h4>
                    <p className="text-stone-500 mt-0.5">
                      Color: {item.selectedColor} • Size: {item.selectedSize} • Qty: {item.quantity}
                    </p>
                    {item.isCustomTailored && (
                      <span className="text-[11px] text-[#8B1E3F] font-semibold flex items-center gap-1 mt-1">
                        <Scissors className="w-3 h-3" /> Bespoke Made-to-Measure Custom Blouse Included
                      </span>
                    )}
                  </div>
                  <div className="text-right font-serif font-bold text-sm text-[#8B1E3F]">
                    {formatPrice((item.product.priceINR + (item.isCustomTailored ? item.tailoringFeeINR : 0)) * item.quantity)}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Shipping & Financial Breakdown */}
          <div className="pt-6 border-t border-[#E6D5B8] grid grid-cols-1 md:grid-cols-2 gap-8 text-xs">
            <div className="space-y-2">
              <h4 className="font-bold uppercase tracking-wider text-stone-800">Delivery Address</h4>
              <p className="text-stone-600 leading-relaxed">
                <strong>{currentOrder.shippingAddress.fullName}</strong><br />
                {currentOrder.shippingAddress.addressLine1}<br />
                {currentOrder.shippingAddress.addressLine2 && <>{currentOrder.shippingAddress.addressLine2}<br /></>}
                {currentOrder.shippingAddress.city}, {currentOrder.shippingAddress.state} - {currentOrder.shippingAddress.pincode}<br />
                Phone: {currentOrder.shippingAddress.phone}
              </p>
            </div>

            <div className="space-y-2 bg-[#FAF7F2] p-4 rounded-xl border border-[#E6D5B8]">
              <div className="flex justify-between text-stone-600">
                <span>Subtotal</span>
                <span>{formatPrice(currentOrder.subtotalINR)}</span>
              </div>
              {currentOrder.couponDiscountINR > 0 && (
                <div className="flex justify-between text-emerald-700 font-semibold">
                  <span>Discount</span>
                  <span>-{formatPrice(currentOrder.couponDiscountINR)}</span>
                </div>
              )}
              <div className="flex justify-between text-stone-600">
                <span>GST Tax (5%)</span>
                <span>{formatPrice(currentOrder.taxGstINR)}</span>
              </div>
              <div className="flex justify-between text-stone-600">
                <span>Shipping</span>
                <span>{currentOrder.shippingCostINR === 0 ? 'FREE' : formatPrice(currentOrder.shippingCostINR)}</span>
              </div>
              <div className="flex justify-between text-base font-serif font-bold text-[#8B1E3F] pt-2 border-t border-[#E6D5B8]">
                <span>Total payable on delivery</span>
                <span>{formatPrice(currentOrder.totalINR)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Continue Shopping CTA */}
        <div className="mt-8 text-center">
          <button
            id="confirmation-continue-shopping-btn"
            onClick={() => navigate('shop')}
            className="inline-flex items-center gap-2 text-xs uppercase tracking-widest font-bold text-[#8B1E3F] hover:text-[#721C24]"
          >
            <span>Continue Exploring Collections</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
