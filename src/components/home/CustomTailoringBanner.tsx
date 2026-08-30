import React from 'react';
import { useStore } from '../../context/StoreContext';
import { Scissors, Ruler, Sparkles, CheckCircle2, ArrowRight } from 'lucide-react';

export const CustomTailoringBanner: React.FC = () => {
  const { navigate } = useStore();

  return (
    <section className="py-16 sm:py-20 bg-[#FAF4ED] border-b border-[#E6D5B8]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-gradient-to-r from-[#8B1E3F] to-[#5C1026] rounded-3xl p-8 sm:p-12 lg:p-16 text-white shadow-2xl relative overflow-hidden">
          {/* Decorative Pattern overlay */}
          <div className="absolute right-0 top-0 w-96 h-96 bg-[#DFBF77]/10 rounded-full blur-3xl pointer-events-none" />

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center relative z-10">
            <div className="lg:col-span-8 space-y-4">
              <div className="inline-flex items-center gap-2 bg-white/15 backdrop-blur-md px-3.5 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest text-[#DFBF77]">
                <Scissors className="w-3.5 h-3.5" />
                <span>AB Collection tailoring</span>
              </div>

              <h2 className="text-2xl sm:text-4xl lg:text-5xl font-serif font-bold leading-tight">
                Flawless Made-to-Measure Custom Blouse & Lehenga Tailoring
              </h2>

              <p className="text-xs sm:text-sm text-[#EFE7DA]/90 leading-relaxed max-w-2xl font-sans">
                Never worry about standard size mismatches again. Our senior master tailors draft unique custom patterns for your exact bust, waist, shoulder, armhole, and neckline measurements.
              </p>

              {/* Feature points */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 text-xs">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-[#DFBF77] shrink-0" />
                  <span>2-Inch Alteration Margins</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-[#DFBF77] shrink-0" />
                  <span>Premium Butter Silk Lining</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-[#DFBF77] shrink-0" />
                  <span>Maggam & Zardozi Necklines</span>
                </div>
              </div>
            </div>

            <div className="lg:col-span-4 flex flex-col sm:flex-row lg:flex-col gap-3 justify-center">
              <button
                id="tailoring-banner-guide-btn"
                onClick={() => navigate('tailoring-guide')}
                className="w-full bg-[#FAF7F2] text-[#8B1E3F] hover:bg-white text-xs uppercase font-bold tracking-widest py-4 px-6 rounded-xl flex items-center justify-center gap-2 shadow-lg transition-all"
              >
                <Ruler className="w-4 h-4" />
                <span>Measurement Guide</span>
              </button>

              <button
                id="tailoring-banner-account-vault-btn"
                onClick={() => navigate('account')}
                className="w-full bg-white/10 hover:bg-white/20 border border-white/30 text-white text-xs uppercase font-semibold tracking-widest py-4 px-6 rounded-xl flex items-center justify-center gap-2 transition-all"
              >
                <span>Save Measurements in Vault</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
