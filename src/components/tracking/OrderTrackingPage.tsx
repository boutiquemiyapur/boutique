import React, { useState } from 'react';
import { useStore } from '../../context/StoreContext';
import {
  Truck,
  Search,
  CheckCircle2,
  Clock,
  Package,
  MapPin,
  ShieldCheck,
  Phone,
  FileText,
  Scissors,
  ArrowRight
} from 'lucide-react';

export const OrderTrackingPage: React.FC = () => {
  const { orders, currentOrder, formatPrice, navigate, showToast } = useStore();

  const [searchQuery, setSearchQuery] = useState(currentOrder?.orderNumber || 'MB-2026-8841');
  const [activeOrder, setActiveOrder] = useState(
    currentOrder || orders.find((o) => o.orderNumber === 'MB-2026-8841') || orders[0]
  );

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const found = orders.find(
      (o) => o.orderNumber.toLowerCase() === searchQuery.trim().toLowerCase()
    );
    if (found) {
      setActiveOrder(found);
      showToast('Order Found', `Tracking details updated for ${found.orderNumber}`);
    } else {
      showToast('Order Not Found', `No matching order found for "${searchQuery}". Please check your invoice.`, 'error');
    }
  };

  return (
    <div className="bg-[#FAF7F2] min-h-screen py-10 sm:py-16">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center max-w-2xl mx-auto mb-10">
          <span className="text-xs uppercase tracking-[0.25em] font-bold text-[#8B1E3F]">
            BlueDart & Delhivery Luxury Courier
          </span>
          <h1 className="text-2xl sm:text-4xl font-serif font-bold text-[#1A1715] mt-1">
            Live Order & Courier Tracking
          </h1>
          <div className="w-12 h-0.5 bg-[#C5A059] mx-auto mt-2"></div>
          <p className="text-xs text-stone-600 mt-2">
            Track your pure handloom garment from our Hyderabad weaving loom directly to your doorstep.
          </p>
        </div>

        {/* Search Bar */}
        <form onSubmit={handleSearch} className="max-w-xl mx-auto mb-12 flex gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-3.5" />
            <input
              id="tracking-search-input"
              type="text"
              required
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Enter Order ID (e.g. MB-2026-8841)"
              className="w-full pl-10 pr-4 py-3 bg-white border border-[#E6D5B8] rounded-xl text-xs sm:text-sm font-mono focus:outline-hidden focus:border-[#8B1E3F] shadow-xs"
            />
          </div>
          <button
            id="tracking-search-btn"
            type="submit"
            className="bg-[#8B1E3F] hover:bg-[#721C24] text-white text-xs uppercase tracking-wider font-semibold px-6 py-3 rounded-xl shadow-md transition-all"
          >
            Track
          </button>
        </form>

        {activeOrder ? (
          <div className="bg-white border border-[#E6D5B8] rounded-3xl p-6 sm:p-10 shadow-sm space-y-8">
            {/* Top Status Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-[#E6D5B8]">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-serif font-bold text-lg text-stone-900">{activeOrder.orderNumber}</h3>
                  <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full">
                    {activeOrder.orderStatus}
                  </span>
                </div>
                <p className="text-xs text-stone-500 mt-0.5">
                  Placed on {new Date(activeOrder.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                </p>
              </div>

              <div className="text-left sm:text-right">
                <span className="text-[11px] text-stone-400 block">Courier AWB / Tracking #</span>
                <span className="font-mono font-bold text-xs text-[#8B1E3F]">
                  {activeOrder.trackingNumber || 'BD-HYD-9982410'}
                </span>
                <span className="text-[11px] text-stone-500 block mt-0.5">
                  Carrier: <strong>{activeOrder.courierPartner}</strong>
                </span>
              </div>
            </div>

            {/* Stepper Visualization */}
            <div className="py-4">
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-6 relative">
                {/* Step 1 */}
                <div className="flex sm:flex-col items-center sm:text-center gap-3 relative z-10">
                  <div className="w-10 h-10 rounded-full bg-emerald-600 text-white flex items-center justify-center shadow-md">
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-stone-900">Order Placed</h4>
                    <p className="text-[11px] text-stone-500">Verified & Allocated</p>
                  </div>
                </div>

                {/* Step 2 */}
                <div className="flex sm:flex-col items-center sm:text-center gap-3 relative z-10">
                  <div className="w-10 h-10 rounded-full bg-emerald-600 text-white flex items-center justify-center shadow-md">
                    <ShieldCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-stone-900">Silk Mark QA</h4>
                    <p className="text-[11px] text-stone-500">Laboratory Tested</p>
                  </div>
                </div>

                {/* Step 3 */}
                <div className="flex sm:flex-col items-center sm:text-center gap-3 relative z-10">
                  <div className="w-10 h-10 rounded-full bg-emerald-600 text-white flex items-center justify-center shadow-md">
                    <Scissors className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-stone-900">Atelier Tailoring</h4>
                    <p className="text-[11px] text-stone-500">Hand-finished & Packed</p>
                  </div>
                </div>

                {/* Step 4 */}
                <div className="flex sm:flex-col items-center sm:text-center gap-3 relative z-10">
                  <div className="w-10 h-10 rounded-full bg-[#8B1E3F] text-white flex items-center justify-center shadow-md animate-pulse">
                    <Truck className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-[#8B1E3F]">In Transit</h4>
                    <p className="text-[11px] text-stone-500">Expected {activeOrder.estimatedDeliveryDate}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Live Logistics Timeline */}
            <div className="bg-[#FAF7F2] border border-[#E6D5B8] rounded-2xl p-6 space-y-4">
              <h4 className="font-bold uppercase tracking-wider text-xs text-stone-800 flex items-center gap-2">
                <MapPin className="w-4 h-4 text-[#8B1E3F]" /> Live Logistics Waypoint History
              </h4>

              <div className="space-y-4 pl-2 border-l-2 border-[#8B1E3F]/30 text-xs">
                <div className="relative pl-4">
                  <div className="absolute -left-5 top-1 w-2.5 h-2.5 rounded-full bg-[#8B1E3F]" />
                  <span className="font-bold text-stone-900">Secunderabad Express Air Sorting Hub</span>
                  <p className="text-stone-500 text-[11px]">28 Aug 2026, 09:30 AM — Bagged and loaded onto flight to recipient hub.</p>
                </div>

                <div className="relative pl-4">
                  <div className="absolute -left-5 top-1 w-2.5 h-2.5 rounded-full bg-stone-400" />
                  <span className="font-bold text-stone-900">Miyapur Flagship Atelier Fulfillment Center</span>
                  <p className="text-stone-500 text-[11px]">27 Aug 2026, 04:15 PM — Handloom QC approved, packaged in velvet bridal box.</p>
                </div>

                <div className="relative pl-4">
                  <div className="absolute -left-5 top-1 w-2.5 h-2.5 rounded-full bg-stone-400" />
                  <span className="font-bold text-stone-900">Order Confirmed & Artisan Allotted</span>
                  <p className="text-stone-500 text-[11px]">26 Aug 2026, 11:00 AM — Razorpay payment captured.</p>
                </div>
              </div>
            </div>

            {/* Recipient & Items Summary */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-[#E6D5B8] text-xs">
              <div>
                <h4 className="font-bold uppercase tracking-wider text-stone-700 mb-2">Delivery Destination</h4>
                <p className="text-stone-600 leading-relaxed">
                  <strong>{activeOrder.shippingAddress.fullName}</strong><br />
                  {activeOrder.shippingAddress.addressLine1}<br />
                  {activeOrder.shippingAddress.city}, {activeOrder.shippingAddress.state} - {activeOrder.shippingAddress.pincode}<br />
                  Phone: {activeOrder.shippingAddress.phone}
                </p>
              </div>

              <div>
                <h4 className="font-bold uppercase tracking-wider text-stone-700 mb-2">Ensemble Highlights</h4>
                <div className="space-y-2">
                  {activeOrder.items.map((item) => (
                    <div key={item.cartItemId} className="flex justify-between items-center bg-[#FAF7F2] p-2 rounded-lg">
                      <span className="font-semibold text-stone-900 truncate max-w-xs">{item.product.title}</span>
                      <span className="font-serif font-bold text-[#8B1E3F]">{formatPrice(item.product.priceINR)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-white border border-[#E6D5B8] rounded-3xl p-12 text-center">
            <Package className="w-12 h-12 text-stone-300 mx-auto mb-3" />
            <h3 className="text-lg font-serif font-bold text-stone-800">Order Not Found</h3>
            <p className="text-xs text-stone-500 mt-1">Please verify your order number and try again.</p>
          </div>
        )}
      </div>
    </div>
  );
};
