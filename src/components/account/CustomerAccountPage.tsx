import React, { useEffect, useState } from 'react';
import { useStore } from '../../context/StoreContext';
import { CustomMeasurements, Order, ShippingAddress } from '../../types';
import {
  User,
  Scissors,
  Package,
  MapPin,
  Save,
  Clock,
  Truck,
  Plus,
  Trash2,
  CheckCircle2,
  Phone,
  Mail,
  Ruler,
  Heart,
  LogOut, Eye, X
} from 'lucide-react';

export const CustomerAccountPage: React.FC = () => {
  const {
    customer,
    updateCustomerProfile,
    saveMeasurements,
    addSavedAddress,
    updateSavedAddress,
    deleteSavedAddress,
    cancelOrder,
    addToCart,
    orders,
    wishlist,
    products,
    toggleWishlist,
    formatPrice,
    navigate,
    showToast,
    logout
  } = useStore();

  const [activeTab, setActiveTab] = useState<'vault' | 'orders' | 'wishlist' | 'profile' | 'addresses'>('profile');

  // Profile fields
  const [name, setName] = useState(customer.fullName);
  const [email, setEmail] = useState(customer.email);
  const [phone, setPhone] = useState(customer.phone);
  const [address, setAddress] = useState<ShippingAddress>({ fullName: customer.fullName, phone: customer.phone, email: customer.email, addressLine1: '', city: '', state: '', pincode: '', country: 'India' });
  const [editingAddressId, setEditingAddressId] = useState<string | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [cancellingOrder, setCancellingOrder] = useState<Order | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Measurements fields
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
      specialNotes: 'Please ensure 2-inch interior seam margins.'
    }
  );

  useEffect(() => {
    setName(customer.fullName);
    setEmail(customer.email);
    setPhone(customer.phone);
    setAddress((current) => ({ ...current, fullName: customer.fullName, phone: customer.phone, email: customer.email }));
    if (customer.savedMeasurements) setMeasurements(customer.savedMeasurements);
  }, [customer]);

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    updateCustomerProfile({
      fullName: name,
      phone
    });
  };

  const handleSaveMeasurements = (e: React.FormEvent) => {
    e.preventDefault();
    saveMeasurements(measurements);
    showToast('Measurements Saved', 'Your custom measurements are now ready for checkout.');
  };

  const handleSaveAddress = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!address.addressLine1 || !address.city || !address.state || !address.pincode) {
      showToast('Address Incomplete', 'Complete the required address details before saving.', 'error');
      return;
    }
    setIsSaving(true);
    try {
      if (editingAddressId) await updateSavedAddress(editingAddressId, address);
      else await addSavedAddress(address);
      setEditingAddressId(null);
      setAddress({ fullName: customer.fullName, phone: customer.phone, email: customer.email, addressLine1: '', city: '', state: '', pincode: '', country: 'India' });
    } catch { showToast('Could not save address', 'Please check your connection and try again.', 'error'); } finally { setIsSaving(false); }
  };

  const cancelSelectedOrder = async () => {
    if (!cancellingOrder) return;
    setIsSaving(true);
    try { await cancelOrder(cancellingOrder.id); setCancellingOrder(null); }
    catch (error) { showToast('Could not cancel order', error instanceof Error ? error.message : 'Please try again.', 'error'); }
    finally { setIsSaving(false); }
  };
  const buyAgain = async (order: Order) => {
    setIsSaving(true);
    try { for (const item of order.items) await addToCart(item.product, item.selectedColor, item.selectedSize, item.quantity, item.isCustomTailored, item.customMeasurements, item.giftPackaging, item.giftNote); showToast('Added to bag', 'The order items were added to your shopping bag.'); }
    finally { setIsSaving(false); }
  };

  return (
    <div className="bg-[#FAF7F2] min-h-screen py-10 sm:py-16">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-6 flex flex-col gap-4 border-b border-[#E6D5B8] pb-6 sm:mb-8 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <span className="text-xs font-bold uppercase tracking-[0.2em] text-[#8B1E3F]">AB Collection account</span>
            <h1 className="mt-1 break-words font-serif text-2xl font-bold text-[#1A1715] sm:text-3xl">My Account</h1>
          </div>
          <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-center sm:justify-end">
            <span className="min-w-0 break-words text-xs leading-5 text-stone-600">Welcome, <strong>{customer.fullName || 'there'}</strong></span>
            <button onClick={() => void logout()} className="inline-flex min-h-11 shrink-0 items-center justify-center gap-1.5 rounded-lg bg-[#2c2926] px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-[#8B1E3F] active:scale-[0.98]" aria-label="Log out"><LogOut className="h-4 w-4" />Log out</button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="mb-8 grid grid-cols-1 gap-2 rounded-2xl border border-[#E6D5B8] bg-white p-2 sm:flex sm:gap-6 sm:rounded-none sm:border-x-0 sm:border-t-0 sm:bg-transparent sm:p-0 lg:gap-8">
          <button
            id="tab-account-profile"
            onClick={() => setActiveTab('profile')}
            className={`relative flex min-h-11 w-full items-center gap-2 rounded-lg px-3 py-3 text-left text-xs font-bold uppercase tracking-wider transition-all sm:min-h-0 sm:w-auto sm:rounded-none sm:px-0 sm:pb-3 ${activeTab === 'profile' ? 'bg-[#8B1E3F]/8 text-[#8B1E3F] sm:bg-transparent' : 'text-stone-600 hover:bg-stone-100 hover:text-black sm:hover:bg-transparent'}`}
          >
            <User className="h-4 w-4 shrink-0" /> Personal Profile
            {activeTab === 'profile' && <span className="absolute bottom-0 left-0 hidden h-0.5 w-full bg-[#8B1E3F] sm:block" />}
          </button>
          <button
            id="tab-account-orders"
            onClick={() => setActiveTab('orders')}
            className={`relative flex min-h-11 w-full items-center gap-2 rounded-lg px-3 py-3 text-left text-xs font-bold uppercase tracking-wider transition-all sm:min-h-0 sm:w-auto sm:rounded-none sm:px-0 sm:pb-3 ${activeTab === 'orders' ? 'bg-[#8B1E3F]/8 text-[#8B1E3F] sm:bg-transparent' : 'text-stone-600 hover:bg-stone-100 hover:text-black sm:hover:bg-transparent'}`}
          >
            <Package className="h-4 w-4 shrink-0" /> Order History
            {activeTab === 'orders' && <span className="absolute bottom-0 left-0 hidden h-0.5 w-full bg-[#8B1E3F] sm:block" />}
          </button>
          <button
            id="tab-account-addresses"
            onClick={() => setActiveTab('addresses')}
            className={`relative flex min-h-11 w-full items-center gap-2 rounded-lg px-3 py-3 text-left text-xs font-bold uppercase tracking-wider transition-all sm:min-h-0 sm:w-auto sm:rounded-none sm:px-0 sm:pb-3 ${activeTab === 'addresses' ? 'bg-[#8B1E3F]/8 text-[#8B1E3F] sm:bg-transparent' : 'text-stone-600 hover:bg-stone-100 hover:text-black sm:hover:bg-transparent'}`}
          >
            <MapPin className="h-4 w-4 shrink-0" /> Addresses
            {activeTab === 'addresses' && <span className="absolute bottom-0 left-0 hidden h-0.5 w-full bg-[#8B1E3F] sm:block" />}
          </button>
          <button
            id="tab-account-wishlist"
            onClick={() => setActiveTab('wishlist')}
            className={`relative flex min-h-11 w-full items-center gap-2 rounded-lg px-3 py-3 text-left text-xs font-bold uppercase tracking-wider transition-all sm:min-h-0 sm:w-auto sm:rounded-none sm:px-0 sm:pb-3 ${activeTab === 'wishlist' ? 'bg-[#8B1E3F]/8 text-[#8B1E3F] sm:bg-transparent' : 'text-stone-600 hover:bg-stone-100 hover:text-black sm:hover:bg-transparent'}`}
          >
            <Heart className="h-4 w-4 shrink-0" /> Wishlist
            {activeTab === 'wishlist' && <span className="absolute bottom-0 left-0 hidden h-0.5 w-full bg-[#8B1E3F] sm:block" />}
          </button>
          <button
            id="tab-account-vault"
            onClick={() => setActiveTab('vault')}
            className={`relative flex min-h-11 w-full items-center gap-2 rounded-lg px-3 py-3 text-left text-xs font-bold uppercase tracking-wider transition-all sm:min-h-0 sm:w-auto sm:rounded-none sm:px-0 sm:pb-3 ${activeTab === 'vault' ? 'bg-[#8B1E3F]/8 text-[#8B1E3F] sm:bg-transparent' : 'text-stone-600 hover:bg-stone-100 hover:text-black sm:hover:bg-transparent'}`}
          >
            <Scissors className="h-4 w-4 shrink-0" /> Saved Measurement Vault
            {activeTab === 'vault' && <span className="absolute bottom-0 left-0 hidden h-0.5 w-full bg-[#8B1E3F] sm:block" />}
          </button>
        </div>
        {/* Tab 1: Measurements Vault */}
        {activeTab === 'vault' && (
          <div className="bg-white border border-[#E6D5B8] rounded-3xl p-6 sm:p-10 shadow-xs space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#E6D5B8]">
              <div>
                <h3 className="font-serif font-bold text-lg text-stone-900 flex items-center gap-2">
                  <Ruler className="w-5 h-5 text-[#8B1E3F]" /> Saved Measurements
                </h3>
                <p className="text-xs text-stone-500 mt-0.5">
                  Save your measurements once. They will fill in automatically whenever you choose custom tailoring.
                </p>
              </div>

              <button
                onClick={() => navigate('tailoring-guide')}
                className="text-xs font-semibold text-[#8B1E3F] underline flex items-center gap-1"
              >
                View Measurement Guide
              </button>
            </div>

            <form onSubmit={handleSaveMeasurements} className="space-y-6">
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 text-xs">
                <div>
                  <label className="font-bold text-stone-700 block mb-1">Bust (Inches) *</label>
                  <input
                    type="number"
                    step="0.5"
                    value={measurements.bust}
                    onChange={(e) => setMeasurements({ ...measurements, bust: parseFloat(e.target.value) || 0 })}
                    className="w-full p-2.5 bg-[#FAF7F2] border border-[#E6D5B8] rounded-lg font-mono"
                  />
                </div>

                <div>
                  <label className="font-bold text-stone-700 block mb-1">Waist (Inches) *</label>
                  <input
                    type="number"
                    step="0.5"
                    value={measurements.waist}
                    onChange={(e) => setMeasurements({ ...measurements, waist: parseFloat(e.target.value) || 0 })}
                    className="w-full p-2.5 bg-[#FAF7F2] border border-[#E6D5B8] rounded-lg font-mono"
                  />
                </div>

                <div>
                  <label className="font-bold text-stone-700 block mb-1">Hips (Inches)</label>
                  <input
                    type="number"
                    step="0.5"
                    value={measurements.hips}
                    onChange={(e) => setMeasurements({ ...measurements, hips: parseFloat(e.target.value) || 0 })}
                    className="w-full p-2.5 bg-[#FAF7F2] border border-[#E6D5B8] rounded-lg font-mono"
                  />
                </div>

                <div>
                  <label className="font-bold text-stone-700 block mb-1">Shoulder Width (Inches) *</label>
                  <input
                    type="number"
                    step="0.5"
                    value={measurements.shoulder}
                    onChange={(e) => setMeasurements({ ...measurements, shoulder: parseFloat(e.target.value) || 0 })}
                    className="w-full p-2.5 bg-[#FAF7F2] border border-[#E6D5B8] rounded-lg font-mono"
                  />
                </div>

                <div>
                  <label className="font-bold text-stone-700 block mb-1">Armhole Circumference *</label>
                  <input
                    type="number"
                    step="0.5"
                    value={measurements.armHole}
                    onChange={(e) => setMeasurements({ ...measurements, armHole: parseFloat(e.target.value) || 0 })}
                    className="w-full p-2.5 bg-[#FAF7F2] border border-[#E6D5B8] rounded-lg font-mono"
                  />
                </div>

                <div>
                  <label className="font-bold text-stone-700 block mb-1">Sleeve Length *</label>
                  <input
                    type="number"
                    step="0.5"
                    value={measurements.sleeveLength}
                    onChange={(e) => setMeasurements({ ...measurements, sleeveLength: parseFloat(e.target.value) || 0 })}
                    className="w-full p-2.5 bg-[#FAF7F2] border border-[#E6D5B8] rounded-lg font-mono"
                  />
                </div>

                <div>
                  <label className="font-bold text-stone-700 block mb-1">Front Neck Depth</label>
                  <input
                    type="number"
                    step="0.5"
                    value={measurements.frontNeckDepth}
                    onChange={(e) => setMeasurements({ ...measurements, frontNeckDepth: parseFloat(e.target.value) || 0 })}
                    className="w-full p-2.5 bg-[#FAF7F2] border border-[#E6D5B8] rounded-lg font-mono"
                  />
                </div>

                <div>
                  <label className="font-bold text-stone-700 block mb-1">Back Neck Depth</label>
                  <input
                    type="number"
                    step="0.5"
                    value={measurements.backNeckDepth}
                    onChange={(e) => setMeasurements({ ...measurements, backNeckDepth: parseFloat(e.target.value) || 0 })}
                    className="w-full p-2.5 bg-[#FAF7F2] border border-[#E6D5B8] rounded-lg font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                <div>
                  <label className="font-bold text-stone-700 block mb-1">Preferred Blouse Style</label>
                  <select
                    value={measurements.blouseStyle}
                    onChange={(e) => setMeasurements({ ...measurements, blouseStyle: e.target.value as any })}
                    className="w-full p-2.5 bg-[#FAF7F2] border border-[#E6D5B8] rounded-lg font-semibold text-stone-800"
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
                  <label className="font-bold text-stone-700 block mb-1">Inner Lining Preference</label>
                  <select
                    value={measurements.liningPreference}
                    onChange={(e) => setMeasurements({ ...measurements, liningPreference: e.target.value as any })}
                    className="w-full p-2.5 bg-[#FAF7F2] border border-[#E6D5B8] rounded-lg font-semibold text-stone-800"
                  >
                    <option value="Butter Silk">Premium Butter Silk</option>
                    <option value="Pure Cotton">100% Pure Breathable Cotton</option>
                    <option value="Satin Silk">Heavy Duchess Satin</option>
                  </select>
                </div>

                <div>
                  <label className="font-bold text-stone-700 block mb-1">Bra Padding</label>
                  <select
                    value={measurements.paddingOption}
                    onChange={(e) => setMeasurements({ ...measurements, paddingOption: e.target.value as any })}
                    className="w-full p-2.5 bg-[#FAF7F2] border border-[#E6D5B8] rounded-lg font-semibold text-stone-800"
                  >
                    <option value="With Bra Pads">With Built-in Bra Pads</option>
                    <option value="Without Pads">Without Pads (Natural)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="font-bold text-stone-700 block text-xs mb-1">Special Tailoring Notes</label>
                <textarea
                  rows={2}
                  value={measurements.specialNotes}
                  onChange={(e) => setMeasurements({ ...measurements, specialNotes: e.target.value })}
                  placeholder="e.g., Leave 2.5 inches margin on armhole, heavy latkans on back dori..."
                  className="w-full p-2.5 bg-[#FAF7F2] border border-[#E6D5B8] rounded-lg text-xs"
                />
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  className="bg-[#8B1E3F] hover:bg-[#721C24] text-white text-xs uppercase tracking-wider font-semibold px-8 py-3.5 rounded-xl flex items-center gap-2 shadow-md transition-all"
                >
                  <Save className="w-4 h-4" /> Save Measurements
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Tab 2: Orders */}
        {activeTab === 'orders' && (
          <div className="space-y-6">
            {orders.map((order) => (
              <div
                key={order.id}
                className="bg-white border border-[#E6D5B8] rounded-3xl p-6 sm:p-8 shadow-xs space-y-4"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#E6D5B8] text-xs">
                  <div>
                    <h3 className="font-serif font-bold text-base text-stone-900">{order.orderNumber}</h3>
                    <p className="text-stone-500 mt-0.5">
                      Placed on {new Date(order.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </p>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className={`text-[10px] font-bold uppercase tracking-wider px-3 py-1 rounded-full ${order.orderStatus === 'Cancelled' ? 'bg-stone-200 text-stone-700' : order.orderStatus === 'Delivered' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>{order.orderStatus}</span>
                  </div>
                </div>

                <div className="divide-y divide-[#E6D5B8]/60">
                  {order.items.map((item) => (
                    <div key={item.cartItemId} className="py-3 flex items-center gap-4 text-xs">
                      <img
                        src={item.product.images[0]}
                        alt=""
                        className="w-14 h-18 object-cover rounded-md shrink-0 border border-[#E6D5B8]"
                      />
                      <div className="flex-1 min-w-0">
                        <h4 className="font-bold text-stone-900 truncate">{item.product.title}</h4>
                        <p className="text-stone-500">
                          {item.selectedColor} • {item.selectedSize} (Qty: {item.quantity})
                        </p>
                        {item.isCustomTailored && (
                          <span className="text-[10px] text-[#8B1E3F] font-bold flex items-center gap-1 mt-0.5">
                            <Scissors className="w-2.5 h-2.5" /> Custom Tailored Blouse
                          </span>
                        )}
                      </div>
                      <div className="font-serif font-bold text-[#8B1E3F]">
                        {formatPrice(item.product.priceINR * item.quantity)}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="pt-3 border-t border-[#E6D5B8] flex items-center justify-between text-xs font-bold text-stone-800">
                  <span>Grand Total:</span>
                  <span className="font-serif text-base text-[#8B1E3F]">{formatPrice(order.totalINR)}</span>
                </div>
                <div className="flex flex-wrap gap-2 pt-1">
                  <button onClick={() => setSelectedOrder(order)} className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-[#D8C9BC] px-3 text-xs font-semibold text-stone-700"><Eye className="h-4 w-4" />View details</button>
                  {['Order Placed', 'Confirmed', 'Processing', 'Artisan Tailoring', 'Ready for Dispatch', 'Quality Inspection'].includes(order.orderStatus) && <button onClick={() => setCancellingOrder(order)} className="min-h-10 rounded-lg border border-red-200 bg-red-50 px-3 text-xs font-semibold text-red-700">Cancel order</button>}
                  {(order.orderStatus === 'Delivered' || order.orderStatus === 'Cancelled') && <button disabled={isSaving} onClick={() => void buyAgain(order)} className="min-h-10 rounded-lg bg-[#1A1715] px-3 text-xs font-semibold text-white disabled:opacity-50">Buy again</button>}
                </div>
              </div>
            ))}
            {!orders.length && <div className="rounded-3xl border border-dashed border-[#D8C9BC] bg-white p-10 text-center text-sm text-stone-500"><Package className="mx-auto mb-3 h-7 w-7" />Your orders will appear here after checkout.</div>}
          </div>
        )}

        {activeTab === 'wishlist' && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {products.filter((product) => wishlist.includes(product.id)).map((product) => (
              <article key={product.id} className="overflow-hidden rounded-2xl border border-[#E6D5B8] bg-white">
                <button onClick={() => navigate('product-detail', product.id)} className="block w-full text-left"><img src={product.images[0]} alt={product.title} className="h-64 w-full object-cover" /></button>
                <div className="flex items-start justify-between gap-3 p-4"><div><button onClick={() => navigate('product-detail', product.id)} className="font-serif text-lg text-stone-900">{product.title}</button><p className="mt-1 text-xs text-stone-500">{product.category}</p><p className="mt-2 font-semibold text-[#8B1E3F]">{formatPrice(product.priceINR)}</p></div><button onClick={() => toggleWishlist(product.id)} className="p-2 text-[#8B1E3F]" aria-label={`Remove ${product.title} from wishlist`}><Heart className="h-5 w-5 fill-current" /></button></div>
              </article>
            ))}
            {!wishlist.length && <div className="col-span-full border border-dashed border-[#D8C9BC] bg-white p-10 text-center text-sm text-stone-500"><Heart className="mx-auto mb-3 h-6 w-6" />Your saved styles will appear here.</div>}
          </div>
        )}

        {activeTab === 'addresses' && (
          <div className="grid gap-6 lg:grid-cols-[1fr_1.1fr]">
            <section className="rounded-3xl border border-[#E6D5B8] bg-white p-6 sm:p-8"><h3 className="font-serif text-xl text-stone-900">Saved delivery addresses</h3><div className="mt-5 space-y-3">{customer.savedAddresses.map((saved, index) => <div key={saved.id || `${saved.addressLine1}-${index}`} className="border border-[#E6D5B8] bg-[#FAF7F2] p-4 text-xs text-stone-600"><div className="flex justify-between gap-2"><p className="font-semibold text-stone-900">{saved.fullName} {saved.isDefault && <span className="ml-1 text-[10px] text-[#8B1E3F]">DEFAULT</span>}</p><div className="flex gap-2"><button onClick={() => { setEditingAddressId(saved.id || `legacy-${index}`); setAddress(saved); }} className="font-semibold text-[#8B1E3F]">Edit</button><button onClick={() => { if (window.confirm('Are you sure you want to delete this address?')) void deleteSavedAddress(saved.id || `legacy-${index}`).catch(() => showToast('Could not delete address', 'Please try again.', 'error')); }} className="font-semibold text-red-700">Delete</button></div></div><p className="mt-1">{saved.addressLine1}{saved.addressLine2 ? `, ${saved.addressLine2}` : ''}</p><p>{saved.city}, {saved.state} {saved.pincode}</p><p className="mt-1">{saved.phone}</p></div>)}{!customer.savedAddresses.length && <p className="py-8 text-center text-sm text-stone-500">No saved addresses yet.</p>}</div></section>
            <section className="rounded-3xl border border-[#E6D5B8] bg-white p-6 sm:p-8"><h3 className="font-serif text-xl text-stone-900">{editingAddressId ? 'Edit address' : 'Add an address'}</h3><form onSubmit={handleSaveAddress} className="mt-5 grid gap-3 text-xs sm:grid-cols-2"><label>Full name<input value={address.fullName} onChange={(event) => setAddress({ ...address, fullName: event.target.value })} required className="mt-1 w-full rounded-lg border border-[#E6D5B8] bg-[#FAF7F2] p-2.5" /></label><label>Phone<input value={address.phone} onChange={(event) => setAddress({ ...address, phone: event.target.value })} required className="mt-1 w-full rounded-lg border border-[#E6D5B8] bg-[#FAF7F2] p-2.5" /></label><label className="sm:col-span-2">Address line 1<input value={address.addressLine1} onChange={(event) => setAddress({ ...address, addressLine1: event.target.value })} required className="mt-1 w-full rounded-lg border border-[#E6D5B8] bg-[#FAF7F2] p-2.5" /></label><label className="sm:col-span-2">Address line 2<input value={address.addressLine2 || ''} onChange={(event) => setAddress({ ...address, addressLine2: event.target.value })} className="mt-1 w-full rounded-lg border border-[#E6D5B8] bg-[#FAF7F2] p-2.5" /></label><label>City<input value={address.city} onChange={(event) => setAddress({ ...address, city: event.target.value })} required className="mt-1 w-full rounded-lg border border-[#E6D5B8] bg-[#FAF7F2] p-2.5" /></label><label>State<input value={address.state} onChange={(event) => setAddress({ ...address, state: event.target.value })} required className="mt-1 w-full rounded-lg border border-[#E6D5B8] bg-[#FAF7F2] p-2.5" /></label><label>Pincode<input value={address.pincode} onChange={(event) => setAddress({ ...address, pincode: event.target.value })} required className="mt-1 w-full rounded-lg border border-[#E6D5B8] bg-[#FAF7F2] p-2.5" /></label><label>Country<input value={address.country} onChange={(event) => setAddress({ ...address, country: event.target.value })} required className="mt-1 w-full rounded-lg border border-[#E6D5B8] bg-[#FAF7F2] p-2.5" /></label><button disabled={isSaving} className="mt-2 inline-flex w-fit items-center gap-2 rounded-lg bg-[#8B1E3F] px-5 py-3 text-xs font-semibold uppercase tracking-wider text-white disabled:opacity-50 sm:col-span-2"><Plus className="h-4 w-4" />{isSaving ? 'Saving…' : editingAddressId ? 'Save changes' : 'Save address'}</button></form></section>
          </div>
        )}

        {/* Profile */}
        {activeTab === 'profile' && (
          <div className="bg-white border border-[#E6D5B8] rounded-3xl p-6 sm:p-10 shadow-xs max-w-2xl">
            <h3 className="font-serif font-bold text-lg text-stone-900 mb-6">Contact & Account Details</h3>
            <form onSubmit={handleSaveProfile} className="space-y-4 text-xs">
              <div>
                <label className="font-bold text-stone-700 block mb-1">Full Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full p-2.5 bg-[#FAF7F2] border border-[#E6D5B8] rounded-lg"
                />
              </div>

              <div>
                <label className="font-bold text-stone-700 block mb-1">Email Address</label>
                <input
                  type="email"
                  value={email}
                  readOnly
                  aria-describedby="account-email-help"
                  className="w-full cursor-not-allowed p-2.5 bg-stone-100 border border-[#E6D5B8] rounded-lg text-stone-500"
                />
                <p id="account-email-help" className="mt-1 text-[10px] text-stone-500">Your sign-in email is managed securely by Firebase Authentication.</p>
              </div>

              <div>
                <label className="font-bold text-stone-700 block mb-1">Phone Number (WhatsApp)</label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full p-2.5 bg-[#FAF7F2] border border-[#E6D5B8] rounded-lg"
                />
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  className="bg-[#8B1E3F] hover:bg-[#721C24] text-white text-xs uppercase font-semibold tracking-wider px-6 py-3 rounded-lg transition-colors"
                >
                  Update Profile Details
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
      {(selectedOrder || cancellingOrder) && <div className="fixed inset-0 z-50 flex items-end bg-black/45 p-0 sm:items-center sm:justify-center sm:p-4" role="dialog" aria-modal="true">
        <div className="max-h-[92vh] w-full overflow-y-auto rounded-t-3xl bg-white p-6 shadow-2xl sm:max-w-xl sm:rounded-3xl">
          <div className="mb-5 flex items-start justify-between gap-4"><div><h2 className="font-serif text-xl font-bold text-stone-900">{cancellingOrder ? 'Cancel order' : 'Order details'}</h2><p className="mt-1 text-xs text-stone-500">{(cancellingOrder || selectedOrder)?.orderNumber}</p></div><button onClick={() => { setSelectedOrder(null); setCancellingOrder(null); }} className="rounded-lg p-2 text-stone-600"><X className="h-5 w-5" /></button></div>
          {cancellingOrder ? <div className="space-y-5 text-sm text-stone-700"><p>Are you sure you want to cancel this order? This cannot be undone.</p><div className="flex justify-end gap-3"><button onClick={() => setCancellingOrder(null)} className="min-h-11 px-4 text-xs font-semibold">Keep order</button><button disabled={isSaving} onClick={() => void cancelSelectedOrder()} className="min-h-11 rounded-lg bg-red-700 px-4 text-xs font-semibold text-white disabled:opacity-50">{isSaving ? 'Cancelling…' : 'Cancel order'}</button></div></div> : selectedOrder && <div className="space-y-5 text-xs text-stone-700"><div className="grid grid-cols-2 gap-3 rounded-xl bg-[#FAF7F2] p-4"><p><b>Status</b><br />{selectedOrder.orderStatus}</p><p><b>Payment</b><br />{selectedOrder.paymentMethod === 'cod' ? 'Cash on delivery' : selectedOrder.paymentMethod} · {selectedOrder.paymentStatus}</p><p><b>Order date</b><br />{new Date(selectedOrder.createdAt).toLocaleDateString('en-IN')}</p><p><b>Total</b><br />{formatPrice(selectedOrder.totalINR)}</p></div><div><b>Items</b>{selectedOrder.items.map((item) => <p key={item.cartItemId} className="mt-2">{item.product.title} — {item.selectedColor}, {item.selectedSize}, Qty {item.quantity}</p>)}</div><div><b>Delivery address</b><p className="mt-1">{selectedOrder.shippingAddress.fullName}, {selectedOrder.shippingAddress.addressLine1}, {selectedOrder.shippingAddress.city}, {selectedOrder.shippingAddress.state} {selectedOrder.shippingAddress.pincode}</p></div><div><b>Price breakdown</b><p className="mt-1">Subtotal {formatPrice(selectedOrder.subtotalINR)} · Shipping {formatPrice(selectedOrder.shippingCostINR)} · GST {formatPrice(selectedOrder.taxGstINR)}</p></div>{selectedOrder.cancellation && <div className="rounded-xl bg-stone-100 p-4"><b>Cancellation</b><p className="mt-1">Cancelled on {selectedOrder.cancellation.cancelledAt}</p></div>}</div>}
        </div>
      </div>}
    </div>
  );
};
