import React, { useEffect, useState } from 'react';
import { CheckCircle2, Package, Search } from 'lucide-react';
import { useStore } from '../../context/StoreContext';
import type { Order } from '../../types';

const statusTone = (status: Order['orderStatus']) =>
  status === 'Cancelled' ? 'bg-rose-100 text-rose-800' : status === 'Delivered' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800';

export const OrderTrackingPage: React.FC = () => {
  const { orders, currentOrder, formatPrice, showToast } = useStore();
  const [searchQuery, setSearchQuery] = useState(currentOrder?.orderNumber ?? '');
  const [activeOrder, setActiveOrder] = useState<Order | null>(currentOrder ?? orders[0] ?? null);

  useEffect(() => {
    if (currentOrder) {
      setActiveOrder(currentOrder);
      setSearchQuery(currentOrder.orderNumber);
    }
  }, [currentOrder]);

  const handleSearch = (event: React.FormEvent) => {
    event.preventDefault();
    const found = orders.find((order) => order.orderNumber.toLowerCase() === searchQuery.trim().toLowerCase());
    if (!found) {
      setActiveOrder(null);
      showToast('Order not found', 'Check the order number and try again.', 'error');
      return;
    }
    setActiveOrder(found);
  };

  return (
    <main className="min-h-screen bg-[#FAF7F2] py-12 sm:py-16">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        <header className="mx-auto mb-10 max-w-2xl text-center">
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-[#8B1E3F]">Order status</p>
          <h1 className="mt-2 font-serif text-3xl text-[#1A1715] sm:text-4xl">Follow your order</h1>
          <p className="mt-3 text-sm leading-relaxed text-stone-600">Status updates are shown when they have been recorded by the boutique. Courier tracking appears only after dispatch details are available.</p>
        </header>

        <form onSubmit={handleSearch} className="mx-auto mb-10 flex max-w-xl gap-2">
          <label className="sr-only" htmlFor="tracking-search-input">Order number</label>
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-3.5 h-4 w-4 text-stone-400" aria-hidden="true" />
            <input id="tracking-search-input" required value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Enter your order number" className="w-full border border-[#E6D5B8] bg-white py-3 pl-10 pr-4 text-sm outline-none transition focus:border-[#8B1E3F]" />
          </div>
          <button type="submit" className="bg-[#8B1E3F] px-6 py-3 text-xs font-semibold uppercase tracking-wider text-white transition hover:bg-[#721C24]">Find order</button>
        </form>

        {!activeOrder ? (
          <section className="border border-[#E6D5B8] bg-white px-6 py-14 text-center">
            <Package className="mx-auto h-11 w-11 text-stone-300" aria-hidden="true" />
            <h2 className="mt-4 font-serif text-2xl text-stone-900">Order not found</h2>
            <p className="mt-2 text-sm text-stone-500">Use the order number from your order confirmation.</p>
          </section>
        ) : (
          <section className="border border-[#E6D5B8] bg-white p-6 sm:p-10">
            <div className="flex flex-col justify-between gap-5 border-b border-[#E6D5B8] pb-6 sm:flex-row sm:items-start">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="font-serif text-2xl text-stone-900">{activeOrder.orderNumber}</h2>
                  <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${statusTone(activeOrder.orderStatus)}`}>{activeOrder.orderStatus}</span>
                </div>
                <p className="mt-2 text-xs text-stone-500">Placed {new Date(activeOrder.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })} · COD payment: {activeOrder.paymentStatus}</p>
              </div>
              {activeOrder.trackingNumber ? (
                <div className="text-left sm:text-right">
                  <p className="text-[11px] uppercase tracking-wider text-stone-400">Courier tracking number</p>
                  <p className="mt-1 font-mono text-sm font-semibold text-[#8B1E3F]">{activeOrder.trackingNumber}</p>
                  {activeOrder.courierPartner && <p className="mt-1 text-xs text-stone-500">{activeOrder.courierPartner}</p>}
                </div>
              ) : <p className="max-w-xs text-xs leading-relaxed text-stone-500 sm:text-right">A courier reference has not been assigned yet.</p>}
            </div>

            <div className="py-8">
              <h3 className="text-xs font-bold uppercase tracking-[0.18em] text-stone-700">Order timeline</h3>
              <ol className="mt-5 space-y-5 border-l border-[#C5A059]/60 pl-5">
                {activeOrder.timeline.map((event, index) => (
                  <li key={`${event.status}-${index}`} className="relative">
                    <span className={`absolute -left-[1.8rem] top-1 flex h-4 w-4 items-center justify-center rounded-full ${event.completed ? 'bg-[#8B1E3F] text-white' : 'border border-[#C5A059] bg-[#FAF7F2] text-transparent'}`}><CheckCircle2 className="h-3 w-3" aria-hidden="true" /></span>
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <h4 className="text-sm font-semibold text-stone-900">{event.status}</h4>
                      <time className="text-xs text-stone-500">{event.timestamp}</time>
                    </div>
                    <p className="mt-1 text-sm leading-relaxed text-stone-600">{event.description}</p>
                    {event.location && <p className="mt-1 text-xs text-stone-500">{event.location}</p>}
                  </li>
                ))}
              </ol>
              {activeOrder.timeline.length === 0 && <p className="mt-4 text-sm text-stone-500">No fulfilment update has been recorded yet.</p>}
            </div>

            <div className="grid gap-8 border-t border-[#E6D5B8] pt-7 text-sm md:grid-cols-2">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-[0.18em] text-stone-700">Delivery address</h3>
                <address className="mt-3 not-italic leading-relaxed text-stone-600"><strong className="text-stone-900">{activeOrder.shippingAddress.fullName}</strong><br />{activeOrder.shippingAddress.addressLine1}<br />{activeOrder.shippingAddress.city}, {activeOrder.shippingAddress.state} — {activeOrder.shippingAddress.pincode}</address>
              </div>
              <div>
                <h3 className="text-xs font-bold uppercase tracking-[0.18em] text-stone-700">Order summary</h3>
                <div className="mt-3 space-y-2 text-stone-600">{activeOrder.items.map((item) => <p key={item.cartItemId} className="flex justify-between gap-4"><span>{item.product.title} × {item.quantity}</span><span>{formatPrice(item.product.priceINR * item.quantity)}</span></p>)}<p className="flex justify-between border-t border-[#E6D5B8] pt-3 font-semibold text-stone-900"><span>Total payable on delivery</span><span>{formatPrice(activeOrder.totalINR)}</span></p></div>
              </div>
            </div>
          </section>
        )}
      </div>
    </main>
  );
};
