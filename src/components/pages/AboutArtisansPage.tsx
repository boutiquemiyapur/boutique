import React from 'react';
import { useStore } from '../../context/StoreContext';
import { ShieldCheck, Award, Users, Sparkles, Heart, ArrowRight } from 'lucide-react';

export const AboutArtisansPage: React.FC = () => {
  const { navigate } = useStore();

  return (
    <div className="bg-[#FAF7F2] min-h-screen py-10 sm:py-16">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
        {/* Header */}
        <div className="text-center max-w-2xl mx-auto space-y-3">
          <span className="text-xs uppercase tracking-[0.25em] font-bold text-[#8B1E3F]">
            The Miyapur Manifesto
          </span>
          <h1 className="text-3xl sm:text-5xl font-serif font-bold text-[#1A1715]">
            Where Sacred Weaves Meet Master Craft
          </h1>
          <div className="w-12 h-0.5 bg-[#C5A059] mx-auto mt-2"></div>
          <p className="text-xs sm:text-sm text-stone-600 leading-relaxed font-sans">
            Since 1994, Miyapur Boutique has stood as a guardian of India’s most revered textile legacies—uniting master weaver lineages from Kanchipuram to Varanasi directly with global couture patrons.
          </p>
        </div>

        {/* 3 Pillars */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white border border-[#E6D5B8] rounded-2xl p-6 shadow-xs space-y-3 text-xs">
            <div className="w-12 h-12 rounded-full bg-[#16423C]/15 text-[#16423C] flex items-center justify-center">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <h3 className="font-serif font-bold text-base text-stone-900">Silk Mark Guaranteed</h3>
            <p className="text-stone-600 leading-relaxed">
              Every silk filament in our sarees is 100% natural mulberry silk, authenticated through stringent burn and laboratory warp-weft assays.
            </p>
          </div>

          <div className="bg-white border border-[#E6D5B8] rounded-2xl p-6 shadow-xs space-y-3 text-xs">
            <div className="w-12 h-12 rounded-full bg-[#8B1E3F]/15 text-[#8B1E3F] flex items-center justify-center">
              <Award className="w-6 h-6" />
            </div>
            <h3 className="font-serif font-bold text-base text-stone-900">24K Tested Pure Zari</h3>
            <p className="text-stone-600 leading-relaxed">
              Our master Kanjeevarams and Banarasis utilize pure silver core wire electroplated with genuine 24-carat gold, preserving lustrous heirloom brilliance for centuries.
            </p>
          </div>

          <div className="bg-white border border-[#E6D5B8] rounded-2xl p-6 shadow-xs space-y-3 text-xs">
            <div className="w-12 h-12 rounded-full bg-[#C5A059]/20 text-[#8B1E3F] flex items-center justify-center">
              <Users className="w-6 h-6" />
            </div>
            <h3 className="font-serif font-bold text-base text-stone-900">Fair Wages & Guild Direct</h3>
            <p className="text-stone-600 leading-relaxed">
              By circumventing middlemen traders, 100% of fair artisan wages go directly to 350+ hereditary weaver families across Telangana, Tamil Nadu, and Uttar Pradesh.
            </p>
          </div>
        </div>

        {/* Hyderabad Flagship Story */}
        <div className="bg-white border border-[#E6D5B8] rounded-3xl p-8 sm:p-12 shadow-xs grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
          <div className="space-y-4 text-xs sm:text-sm text-stone-700 leading-relaxed">
            <h2 className="text-2xl font-serif font-bold text-stone-900">The Hyderabad Atelier</h2>
            <p>
              Located in the heart of Telangana, our flagship atelier houses our master pattern cutters, hand-embroidery karigars, and bridal stylists.
            </p>
            <p>
              Whether you visit in person or connect across time zones over high-definition video consultations, our personalized concierge treats every bridal trousseau with royal reverence.
            </p>
            <div className="pt-2">
              <button
                onClick={() => navigate('shop')}
                className="bg-[#8B1E3F] hover:bg-[#721C24] text-white text-xs uppercase font-semibold tracking-wider px-6 py-3 rounded-xl flex items-center gap-2 transition-colors"
              >
                <span>Explore the Handloom Catalog</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="rounded-2xl overflow-hidden shadow-lg border border-[#E6D5B8] aspect-4/3">
            <img
              src="https://images.unsplash.com/photo-1610030469983-98e550d6193c?auto=format&fit=crop&w=800&q=80"
              alt="Hyderabad Atelier Weavers"
              className="w-full h-full object-cover"
            />
          </div>
        </div>
      </div>
    </div>
  );
};
