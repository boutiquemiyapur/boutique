import React, { useState } from 'react';
import { useStore } from '../../context/StoreContext';
import {
  ShieldCheck,
  Award,
  Truck,
  RotateCcw,
  Mail,
  Phone,
  MapPin,
  Sparkles,
  Heart,
  ArrowRight
} from 'lucide-react';

export const Footer: React.FC = () => {
  const { navigate, setFilters, showToast } = useStore();
  const [newsletterEmail, setNewsletterEmail] = useState('');

  const handleSubscribe = (e: React.FormEvent) => {
    e.preventDefault();
    if (newsletterEmail.trim()) {
      showToast(
        'Subscribed to Miyapur Royale!',
        'Thank you! Use promo code WELCOME10 for 10% off your first heirloom order.'
      );
      setNewsletterEmail('');
    }
  };

  return (
    <footer className="bg-[#1A1715] text-[#FAF7F2] pt-16 pb-12 border-t border-[#C5A059]/30">
      {/* Brand Value Props Banner */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-16 border-b border-[#FAF7F2]/10">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-full bg-[#8B1E3F]/30 border border-[#C5A059]/40 flex items-center justify-center shrink-0">
              <Award className="w-6 h-6 text-[#DFBF77]" />
            </div>
            <div>
              <h4 className="text-sm font-semibold tracking-wide text-white uppercase font-sans">
                100% Pure Handloom
              </h4>
              <p className="text-xs text-[#EFE7DA]/70 mt-1 leading-relaxed">
                Silk Mark certified authentic Kanjeevarams and Varanasi Kadwa weaves.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-full bg-[#8B1E3F]/30 border border-[#C5A059]/40 flex items-center justify-center shrink-0">
              <Sparkles className="w-6 h-6 text-[#DFBF77]" />
            </div>
            <div>
              <h4 className="text-sm font-semibold tracking-wide text-white uppercase font-sans">
                Bespoke Atelier Fit
              </h4>
              <p className="text-xs text-[#EFE7DA]/70 mt-1 leading-relaxed">
                Made-to-measure blouse tailoring & custom lehenga sizing with 2-inch margins.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-full bg-[#8B1E3F]/30 border border-[#C5A059]/40 flex items-center justify-center shrink-0">
              <Truck className="w-6 h-6 text-[#DFBF77]" />
            </div>
            <div>
              <h4 className="text-sm font-semibold tracking-wide text-white uppercase font-sans">
                Express Worldwide Delivery
              </h4>
              <p className="text-xs text-[#EFE7DA]/70 mt-1 leading-relaxed">
                Insured express air courier across India, USA, UK, UAE, Canada, and Australia.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-full bg-[#8B1E3F]/30 border border-[#C5A059]/40 flex items-center justify-center shrink-0">
              <RotateCcw className="w-6 h-6 text-[#DFBF77]" />
            </div>
            <div>
              <h4 className="text-sm font-semibold tracking-wide text-white uppercase font-sans">
                Easy 7-Day Returns
              </h4>
              <p className="text-xs text-[#EFE7DA]/70 mt-1 leading-relaxed">
                Hassle-free exchange policy with dedicated bridal trousseau consultants.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Footer Links */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-10">
          {/* Column 1: Brand Story */}
          <div className="lg:col-span-2 space-y-4">
            <h3 className="font-brand font-bold text-2xl tracking-[0.2em] text-[#DFBF77]">
              MIYAPUR BOUTIQUE
            </h3>
            <p className="text-xs text-[#EFE7DA]/80 leading-relaxed max-w-sm font-sans">
              Founded in Hyderabad, Miyapur Boutique celebrates timeless Indian haute couture. From pure gold tested zari Kanjeevarams to hand-embroidered velvet bridal lehengas, our atelier weaves tradition with contemporary luxury.
            </p>
            <div className="pt-2 text-xs text-[#EFE7DA]/70 space-y-1.5">
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-[#DFBF77] shrink-0" />
                <span>Flagship Atelier: Road No. 36, Jubilee Hills & Miyapur Main Rd, Hyderabad 500049</span>
              </div>
              <div className="flex items-center gap-2">
                <Phone className="w-4 h-4 text-[#DFBF77] shrink-0" />
                <span>WhatsApp Concierge: +91 98490 88219 (10 AM - 8 PM IST)</span>
              </div>
              <div className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-[#DFBF77] shrink-0" />
                <span>couture@miyapurboutique.com</span>
              </div>
            </div>
          </div>

          {/* Column 2: Collections */}
          <div className="space-y-3">
            <h4 className="text-xs font-semibold tracking-widest uppercase text-[#DFBF77]">
              Collections
            </h4>
            <ul className="space-y-2 text-xs text-[#EFE7DA]/80 font-sans">
              <li>
                <button
                  onClick={() => {
                    setFilters((prev) => ({ ...prev, category: 'Kanjeevaram Silks' }));
                    navigate('shop');
                  }}
                  className="hover:text-white transition-colors"
                >
                  Kanjeevaram Silks
                </button>
              </li>
              <li>
                <button
                  onClick={() => {
                    setFilters((prev) => ({ ...prev, category: 'Banarasi Sarees' }));
                    navigate('shop');
                  }}
                  className="hover:text-white transition-colors"
                >
                  Banarasi Brocades
                </button>
              </li>
              <li>
                <button
                  onClick={() => {
                    setFilters((prev) => ({ ...prev, category: 'Bridal Lehengas' }));
                    navigate('shop');
                  }}
                  className="hover:text-white transition-colors"
                >
                  Bridal Lehengas
                </button>
              </li>
              <li>
                <button
                  onClick={() => {
                    setFilters((prev) => ({ ...prev, category: 'Designer Sarees' }));
                    navigate('shop');
                  }}
                  className="hover:text-white transition-colors"
                >
                  Organza & Chanderi
                </button>
              </li>
              <li>
                <button
                  onClick={() => {
                    setFilters((prev) => ({ ...prev, category: 'Unstitched Suits' }));
                    navigate('shop');
                  }}
                  className="hover:text-white transition-colors"
                >
                  Lucknowi Chikankari
                </button>
              </li>
              <li>
                <button
                  onClick={() => {
                    setFilters((prev) => ({ ...prev, category: 'Temple Jewelry' }));
                    navigate('shop');
                  }}
                  className="hover:text-white transition-colors"
                >
                  Temple Antique Jewelry
                </button>
              </li>
            </ul>
          </div>

          {/* Column 3: Customer Care */}
          <div className="space-y-3">
            <h4 className="text-xs font-semibold tracking-widest uppercase text-[#DFBF77]">
              Bespoke Concierge
            </h4>
            <ul className="space-y-2 text-xs text-[#EFE7DA]/80 font-sans">
              <li>
                <button onClick={() => navigate('tailoring-guide')} className="hover:text-white transition-colors">
                  Custom Blouse Measurement Guide
                </button>
              </li>
              <li>
                <button onClick={() => navigate('order-tracking')} className="hover:text-white transition-colors">
                  Live Order Shipment Tracking
                </button>
              </li>
              <li>
                <button onClick={() => navigate('account')} className="hover:text-white transition-colors">
                  Saved Measurement Vault
                </button>
              </li>
              <li>
                <button onClick={() => navigate('about')} className="hover:text-white transition-colors">
                  Artisan Handloom Guild
                </button>
              </li>
              <li>
                <button onClick={() => navigate('contact')} className="hover:text-white transition-colors">
                  Book Virtual Video Consultation
                </button>
              </li>
              <li>
                <button onClick={() => navigate('admin')} className="hover:text-[#DFBF77] font-semibold transition-colors">
                  Boutique Admin Portal
                </button>
              </li>
            </ul>
          </div>

          {/* Column 4: Newsletter */}
          <div className="space-y-3">
            <h4 className="text-xs font-semibold tracking-widest uppercase text-[#DFBF77]">
              Join the Royale Guild
            </h4>
            <p className="text-xs text-[#EFE7DA]/70 leading-relaxed font-sans">
              Subscribe for private bridal previews, trunk shows, and an instant 10% coupon code.
            </p>
            <form onSubmit={handleSubscribe} className="space-y-2">
              <input
                id="footer-newsletter-input"
                type="email"
                required
                value={newsletterEmail}
                onChange={(e) => setNewsletterEmail(e.target.value)}
                placeholder="Enter your email address"
                className="w-full px-3.5 py-2.5 text-xs bg-[#FAF7F2]/10 border border-[#C5A059]/40 rounded-md text-white placeholder:text-[#EFE7DA]/50 focus:outline-hidden focus:border-[#DFBF77]"
              />
              <button
                id="footer-newsletter-btn"
                type="submit"
                className="w-full bg-[#8B1E3F] hover:bg-[#721C24] text-white text-xs uppercase font-semibold tracking-wider py-2.5 rounded-md flex items-center justify-center gap-1.5 transition-colors shadow-md"
              >
                Claim 10% Privilege Code <ArrowRight className="w-3 h-3" />
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* Bottom Copyright & Security */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 border-t border-[#FAF7F2]/10 flex flex-col sm:flex-row items-center justify-between gap-4 text-[11px] text-[#EFE7DA]/60">
        <div>
          © {new Date().getFullYear()} MIYAPUR BOUTIQUE PRIVATE LIMITED. All rights reserved. Registered Handloom & Haute Couture Partner.
        </div>
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5 text-[#DFBF77]" /> 256-Bit SSL Encrypted
          </span>
          <span>•</span>
          <span>Verified by Silk Mark India</span>
        </div>
      </div>
    </footer>
  );
};
