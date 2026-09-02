import React, { useEffect, useState } from 'react';
import { useStore } from '../../context/StoreContext';
import { PaymentMethod, ShippingAddress, ShippingMethod } from '../../types';
import {
  ShieldCheck,
  Lock,
  Truck,
  Banknote,
  ArrowRight,
  ChevronLeft,
  CheckCircle2,
  Sparkles,
  Scissors
} from 'lucide-react';

export const CheckoutPage: React.FC = () => {
  const {
    cart,
    customer,
    authStatus,
    isCustomerDataReady,
    requireAuth,
    formatPrice,
    cartSubtotalINR,
    cartTailoringTotalINR,
    cartDiscountINR,
    cartTaxINR,
    cartShippingINR,
    cartTotalINR,
    appliedCoupon,
    createOrder,
    navigate,
    showToast
  } = useStore();

  const [step, setStep] = useState<1 | 2 | 3>(1);

  // Only real authenticated profile data may prefill checkout. Missing values
  // remain blank; country defaults to India without inventing customer data.
  const profileAddress = customer.savedAddresses[0];
  const [address, setAddress] = useState<ShippingAddress>({
    fullName: '', phone: '', email: '', addressLine1: '', addressLine2: '',
    city: '', state: '', pincode: '', country: 'India'
  });

  useEffect(() => {
    if (!isCustomerDataReady) return;
    setAddress((current) => ({
      fullName: current.fullName || profileAddress?.fullName || customer.fullName || '',
      phone: current.phone || profileAddress?.phone || customer.phone || '',
      email: current.email || profileAddress?.email || customer.email || '',
      addressLine1: current.addressLine1 || profileAddress?.addressLine1 || '',
      addressLine2: current.addressLine2 || profileAddress?.addressLine2 || '',
      city: current.city || profileAddress?.city || '',
      state: current.state || profileAddress?.state || '',
      pincode: current.pincode || profileAddress?.pincode || '',
      country: current.country || profileAddress?.country || 'India'
    }));
  }, [customer, isCustomerDataReady, profileAddress]);

  const [shippingMethod, setShippingMethod] = useState<ShippingMethod>('standard');
  const [paymentMethod] = useState<PaymentMethod>('cod');
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);

  useEffect(() => {
    if (authStatus !== 'authenticated') requireAuth('checkout');
  }, [authStatus, requireAuth]);

  if (authStatus !== 'authenticated') return null;

  if (!isCustomerDataReady) {
    return <div className="grid min-h-[60vh] place-items-center text-sm text-stone-500">Loading your checkout details...</div>;
  }

  if (cart.length === 0) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-20 text-center">
        <h2 className="text-2xl font-serif font-bold text-stone-900">Your Shopping Bag is Empty</h2>
        <p className="text-xs text-stone-500 mt-2">Add your favourite handloom outfits to continue to checkout.</p>
        <button
          onClick={() => navigate('shop')}
          className="mt-6 bg-[#8B1E3F] text-white text-xs uppercase tracking-wider font-semibold px-6 py-3 rounded-lg"
        >
          Explore Collection
        </button>
      </div>
    );
  }

  const handlePlaceOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isProcessingPayment) return;
    if (authStatus !== 'authenticated') {
      requireAuth('checkout');
      return;
    }
    setIsProcessingPayment(true);
    try {
      const newOrder = await createOrder(address, shippingMethod, paymentMethod);
      showToast('Order Placed Successfully!', `Order #${newOrder.orderNumber} has been recorded.`);
      navigate('order-confirmation', undefined, newOrder.id);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'The order could not be recorded. Please try again.';
      showToast('Order not placed', message, 'error');
    } finally {
      setIsProcessingPayment(false);
    }
  };

  const finalShippingCost = shippingMethod === 'express' ? 350 : cartShippingINR;
  const grandTotal = cartSubtotalINR + cartTailoringTotalINR - cartDiscountINR + cartTaxINR + finalShippingCost;

  return (
    <div className="bg-[#FAF7F2] min-h-screen py-8 sm:py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Checkout Header */}
        <div className="flex items-center justify-between pb-6 border-b border-[#E6D5B8] mb-8">
          <div>
            <button
              onClick={() => navigate('shop')}
              className="text-xs text-stone-500 hover:text-[#8B1E3F] flex items-center gap-1 mb-1"
            >
              <ChevronLeft className="w-3.5 h-3.5" /> Return to Catalog
            </button>
            <h1 className="text-2xl sm:text-3xl font-serif font-bold text-[#1A1715]">
              AB Collection secure checkout
            </h1>
          </div>

          <div className="flex items-center gap-2 text-xs text-emerald-800 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-lg">
            <Lock className="w-4 h-4 text-emerald-600" />
            <span className="font-semibold">256-Bit SSL Encrypted</span>
          </div>
        </div>

        {/* Step Indicator */}
        <div className="flex items-center justify-center gap-4 sm:gap-12 mb-10 max-w-xl mx-auto text-xs uppercase tracking-wider font-semibold">
          <button
            onClick={() => setStep(1)}
            className={`flex items-center gap-2 pb-2 border-b-2 transition-all ${
              step >= 1 ? 'border-[#8B1E3F] text-[#8B1E3F]' : 'border-stone-300 text-stone-400'
            }`}
          >
            <span className="w-5 h-5 rounded-full bg-[#8B1E3F] text-white flex items-center justify-center text-[10px]">
              1
            </span>
            <span>Delivery Address</span>
          </button>

          <button
            onClick={() => {
              if (address.fullName && address.addressLine1) setStep(2);
            }}
            className={`flex items-center gap-2 pb-2 border-b-2 transition-all ${
              step >= 2 ? 'border-[#8B1E3F] text-[#8B1E3F]' : 'border-stone-300 text-stone-400'
            }`}
          >
            <span className="w-5 h-5 rounded-full bg-[#8B1E3F] text-white flex items-center justify-center text-[10px]">
              2
            </span>
            <span>Shipping Speed</span>
          </button>

          <button
            onClick={() => {
              if (address.fullName && address.addressLine1) setStep(3);
            }}
            className={`flex items-center gap-2 pb-2 border-b-2 transition-all ${
              step === 3 ? 'border-[#8B1E3F] text-[#8B1E3F]' : 'border-stone-300 text-stone-400'
            }`}
          >
            <span className="w-5 h-5 rounded-full bg-[#8B1E3F] text-white flex items-center justify-center text-[10px]">
              3
            </span>
            <span>Payment</span>
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12">
          {/* Main Checkout Form Column (7 Cols) */}
          <div className="lg:col-span-7 space-y-6">
            {/* Step 1: Address */}
            {step === 1 && (
              <div className="bg-white border border-[#E6D5B8] rounded-2xl p-6 sm:p-8 shadow-xs space-y-6">
                <h3 className="font-serif font-bold text-lg text-stone-900 flex items-center gap-2">
                  <Truck className="w-5 h-5 text-[#8B1E3F]" /> Shipping Destination
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  <div>
                    <label className="font-bold text-stone-700 block mb-1">Full Recipient Name *</label>
                    <input
                      id="checkout-fullname"
                      type="text"
                      required
                      value={address.fullName}
                      onChange={(e) => setAddress({ ...address, fullName: e.target.value })}
                      placeholder="Enter your full name"
                      className="w-full p-2.5 bg-[#FAF7F2] border border-[#E6D5B8] rounded-lg"
                    />
                  </div>

                  <div>
                    <label className="font-bold text-stone-700 block mb-1">Phone Number (with WhatsApp) *</label>
                    <input
                      id="checkout-phone"
                      type="tel"
                      required
                      value={address.phone}
                      onChange={(e) => setAddress({ ...address, phone: e.target.value })}
                      placeholder="+91 XXXXX XXXXX"
                      className="w-full p-2.5 bg-[#FAF7F2] border border-[#E6D5B8] rounded-lg"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="font-bold text-stone-700 block mb-1">Email Address for Invoice & Tracking *</label>
                    <input
                      id="checkout-email"
                      type="email"
                      required
                      value={address.email}
                      onChange={(e) => setAddress({ ...address, email: e.target.value })}
                      placeholder="Enter your email address"
                      className="w-full p-2.5 bg-[#FAF7F2] border border-[#E6D5B8] rounded-lg"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="font-bold text-stone-700 block mb-1">Street Address / Villa / Apartment *</label>
                    <input
                      id="checkout-address1"
                      type="text"
                      required
                      value={address.addressLine1}
                      onChange={(e) => setAddress({ ...address, addressLine1: e.target.value })}
                      placeholder="House / Flat / Street address"
                      className="w-full p-2.5 bg-[#FAF7F2] border border-[#E6D5B8] rounded-lg"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="font-bold text-stone-700 block mb-1">Landmark (Optional)</label>
                    <input
                      id="checkout-address2"
                      type="text"
                      value={address.addressLine2 || ''}
                      onChange={(e) => setAddress({ ...address, addressLine2: e.target.value })}
                      placeholder="Nearby landmark"
                      className="w-full p-2.5 bg-[#FAF7F2] border border-[#E6D5B8] rounded-lg"
                    />
                  </div>

                  <div>
                    <label className="font-bold text-stone-700 block mb-1">City *</label>
                    <input
                      id="checkout-city"
                      type="text"
                      required
                      value={address.city}
                      onChange={(e) => setAddress({ ...address, city: e.target.value })}
                      placeholder="Enter city"
                      className="w-full p-2.5 bg-[#FAF7F2] border border-[#E6D5B8] rounded-lg"
                    />
                  </div>

                  <div>
                    <label className="font-bold text-stone-700 block mb-1">State / Province *</label>
                    <input
                      id="checkout-state"
                      type="text"
                      required
                      value={address.state}
                      onChange={(e) => setAddress({ ...address, state: e.target.value })}
                      placeholder="Enter state"
                      className="w-full p-2.5 bg-[#FAF7F2] border border-[#E6D5B8] rounded-lg"
                    />
                  </div>

                  <div>
                    <label className="font-bold text-stone-700 block mb-1">PIN / Postal Code *</label>
                    <input
                      id="checkout-pincode"
                      type="text"
                      required
                      maxLength={6}
                      value={address.pincode}
                      onChange={(e) => setAddress({ ...address, pincode: e.target.value })}
                      placeholder="500000"
                      className="w-full p-2.5 bg-[#FAF7F2] border border-[#E6D5B8] rounded-lg font-mono"
                    />
                  </div>

                  <div>
                    <label className="font-bold text-stone-700 block mb-1">Country *</label>
                    <input
                      id="checkout-country"
                      type="text"
                      required
                      value={address.country}
                      onChange={(e) => setAddress({ ...address, country: e.target.value })}
                      placeholder="India"
                      className="w-full p-2.5 bg-[#FAF7F2] border border-[#E6D5B8] rounded-lg"
                    />
                  </div>
                </div>

                <div className="pt-4 flex justify-end">
                  <button
                    id="checkout-step1-continue-btn"
                    onClick={() => {
                      if (!address.fullName || !address.addressLine1 || !address.pincode) {
                        showToast('Missing Details', 'Please fill in all required address fields.', 'error');
                        return;
                      }
                      setStep(2);
                    }}
                    className="bg-[#8B1E3F] hover:bg-[#721C24] text-white text-xs uppercase tracking-widest font-semibold px-8 py-3.5 rounded-lg flex items-center gap-2 shadow-md transition-all"
                  >
                    <span>Continue to Shipping Method</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {/* Step 2: Shipping Method */}
            {step === 2 && (
              <div className="bg-white border border-[#E6D5B8] rounded-2xl p-6 sm:p-8 shadow-xs space-y-6">
                <h3 className="font-serif font-bold text-lg text-stone-900 flex items-center gap-2">
                  <Truck className="w-5 h-5 text-[#8B1E3F]" /> Choose Courier Shipping Speed
                </h3>

                <div className="space-y-3">
                  <label
                    className={`flex items-start justify-between p-4 rounded-xl border cursor-pointer transition-all ${
                      shippingMethod === 'standard'
                        ? 'border-[#8B1E3F] bg-[#8B1E3F]/5'
                        : 'border-[#E6D5B8] hover:border-stone-400'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <input
                        type="radio"
                        name="shipping_method"
                        checked={shippingMethod === 'standard'}
                        onChange={() => setShippingMethod('standard')}
                        className="mt-1 accent-[#8B1E3F]"
                      />
                      <div>
                        <h4 className="text-xs font-bold text-stone-900">Standard Insured Courier (BlueDart / Delhivery)</h4>
                        <p className="text-[11px] text-stone-500 mt-0.5">Delivered in 4-6 business days with tamper-proof packaging.</p>
                      </div>
                    </div>
                    <span className="text-xs font-bold text-stone-900">
                      {cartSubtotalINR >= 5000 ? 'FREE' : formatPrice(450)}
                    </span>
                  </label>

                  <label
                    className={`flex items-start justify-between p-4 rounded-xl border cursor-pointer transition-all ${
                      shippingMethod === 'express'
                        ? 'border-[#8B1E3F] bg-[#8B1E3F]/5'
                        : 'border-[#E6D5B8] hover:border-stone-400'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <input
                        type="radio"
                        name="shipping_method"
                        checked={shippingMethod === 'express'}
                        onChange={() => setShippingMethod('express')}
                        className="mt-1 accent-[#8B1E3F]"
                      />
                      <div>
                        <h4 className="text-xs font-bold text-stone-900 flex items-center gap-1.5">
                          <Sparkles className="w-3.5 h-3.5 text-[#DFBF77]" /> Priority Air Express (1-2 Days)
                        </h4>
                        <p className="text-[11px] text-stone-500 mt-0.5">Same-day dispatch from Hyderabad with order tracking support.</p>
                      </div>
                    </div>
                    <span className="text-xs font-bold text-[#8B1E3F]">
                      +{formatPrice(350)}
                    </span>
                  </label>
                </div>

                <div className="pt-4 flex justify-between">
                  <button
                    onClick={() => setStep(1)}
                    className="text-xs font-semibold text-stone-600 hover:text-black py-2"
                  >
                    ← Back to Address
                  </button>
                  <button
                    id="checkout-step2-continue-btn"
                    onClick={() => setStep(3)}
                    className="bg-[#8B1E3F] hover:bg-[#721C24] text-white text-xs uppercase tracking-widest font-semibold px-8 py-3.5 rounded-lg flex items-center gap-2 shadow-md transition-all"
                  >
                    <span>Review COD order</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {/* Step 3: COD confirmation */}
            {step === 3 && (
              <form onSubmit={handlePlaceOrder} className="bg-white border border-[#E6D5B8] rounded-2xl p-6 sm:p-8 shadow-xs space-y-6">
                <h3 className="font-serif font-bold text-lg text-stone-900 flex items-center gap-2"><Banknote className="w-5 h-5 text-[#8B1E3F]" /> Cash on Delivery</h3>
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 space-y-1"><p className="font-bold">Cash on Delivery Confirmation</p><p className="text-[11px]">Our team will call <strong>{address.phone}</strong> to confirm dispatch. Please keep the payable amount ready at delivery.</p></div>

                <div className="pt-4 flex items-center justify-between border-t border-[#E6D5B8]">
                  <button
                    type="button"
                    onClick={() => setStep(2)}
                    className="text-xs font-semibold text-stone-600 hover:text-black"
                  >
                    ← Back to Shipping
                  </button>

                  <button
                    id="checkout-place-order-submit-btn"
                    type="submit"
                    disabled={isProcessingPayment}
                    className="bg-[#8B1E3F] hover:bg-[#721C24] text-white text-xs uppercase tracking-widest font-bold px-8 py-4 rounded-xl shadow-xl hover:shadow-2xl transition-all disabled:opacity-50 flex items-center gap-2"
                  >
                    {isProcessingPayment ? (
                      <span>Recording order...</span>
                    ) : (
                      <>
                        <ShieldCheck className="w-4 h-4 text-[#DFBF77]" />
                        <span>Place COD order - {formatPrice(grandTotal)}</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>

          {/* Order Summary Column (5 Cols) */}
          <div className="lg:col-span-5 space-y-6">
            <div className="bg-white border border-[#E6D5B8] rounded-2xl p-6 shadow-xs space-y-4">
              <h3 className="font-serif font-bold text-base text-stone-900 pb-3 border-b border-[#E6D5B8]">
                Order Items ({cart.reduce((s, i) => s + i.quantity, 0)})
              </h3>

              <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
                {cart.map((item) => (
                  <div key={item.cartItemId} className="flex gap-3 text-xs">
                    <img
                      src={item.product.images[0]}
                      alt=""
                      className="w-14 h-18 object-cover rounded-md shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <h4 className="font-semibold text-stone-900 truncate">{item.product.title}</h4>
                      <p className="text-[11px] text-stone-500 mt-0.5">
                        {item.selectedColor} • {item.selectedSize} (Qty: {item.quantity})
                      </p>
                      {item.isCustomTailored && (
                        <span className="text-[10px] text-[#8B1E3F] font-bold flex items-center gap-1 mt-0.5">
                          <Scissors className="w-2.5 h-2.5" /> Custom Tailoring (+{formatPrice(item.tailoringFeeINR)})
                        </span>
                      )}
                    </div>
                    <div className="font-serif font-bold text-[#8B1E3F]">
                      {formatPrice((item.product.priceINR + (item.isCustomTailored ? item.tailoringFeeINR : 0)) * item.quantity)}
                    </div>
                  </div>
                ))}
              </div>

              {/* Price Details */}
              <div className="pt-3 border-t border-[#E6D5B8] space-y-2 text-xs text-stone-600">
                <div className="flex justify-between">
                  <span>Bag Subtotal</span>
                  <span className="font-semibold text-stone-900">{formatPrice(cartSubtotalINR)}</span>
                </div>
                {cartTailoringTotalINR > 0 && (
                  <div className="flex justify-between">
                    <span>Custom Tailoring Fee</span>
                    <span className="font-semibold text-stone-900">+{formatPrice(cartTailoringTotalINR)}</span>
                  </div>
                )}
                {cartDiscountINR > 0 && (
                  <div className="flex justify-between text-emerald-700">
                    <span>Promo Code ({appliedCoupon?.code})</span>
                    <span className="font-semibold">-{formatPrice(cartDiscountINR)}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span>GST Tax (5%)</span>
                  <span>{formatPrice(cartTaxINR)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Shipping</span>
                  <span>{finalShippingCost === 0 ? <strong className="text-emerald-700">FREE</strong> : formatPrice(finalShippingCost)}</span>
                </div>
                <div className="flex justify-between text-base font-serif font-bold text-[#8B1E3F] pt-3 border-t border-[#E6D5B8]">
                  <span>Total Amount Payable</span>
                  <span>{formatPrice(grandTotal)}</span>
                </div>
              </div>
            </div>

            {/* Authenticity Guarantee Card */}
            <div className="bg-[#FAF4ED] border border-[#DFBF77]/40 rounded-2xl p-4 flex items-start gap-3">
              <ShieldCheck className="w-6 h-6 text-[#8B1E3F] shrink-0 mt-0.5" />
              <div className="text-xs text-stone-700">
                <h4 className="font-bold text-[#8B1E3F]">AB Collection order information</h4>
                <p className="mt-0.5 text-stone-600">
                  Every order includes physical Silk Mark India hologram cards and arrives in our velvet gift box.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
