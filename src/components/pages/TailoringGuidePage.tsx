import React from 'react';
import { useStore } from '../../context/StoreContext';
import { Scissors, Ruler, CheckCircle2, AlertCircle, ArrowRight, Video } from 'lucide-react';

export const TailoringGuidePage: React.FC = () => {
  const { navigate } = useStore();

  return (
    <div className="bg-[#FAF7F2] min-h-screen py-10 sm:py-16">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
        {/* Header */}
        <div className="text-center max-w-2xl mx-auto space-y-3">
          <div className="inline-flex items-center gap-2 bg-[#8B1E3F]/10 text-[#8B1E3F] text-xs uppercase tracking-widest font-bold px-3 py-1 rounded-full">
            <Scissors className="w-3.5 h-3.5" /> Custom Tailoring
          </div>
          <h1 className="text-3xl sm:text-4xl font-serif font-bold text-[#1A1715]">
            Custom Blouse & Lehenga Measuring Guide
          </h1>
          <p className="text-xs sm:text-sm text-stone-600 leading-relaxed font-sans">
            Follow our master draper’s visual guide to capture exact inches. All custom stitched garments come with 2-inch inner side margins for effortless future alterations.
          </p>
        </div>

        {/* 3 Step Visual Process */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white border border-[#E6D5B8] rounded-2xl p-6 shadow-xs space-y-3 text-xs">
            <div className="w-10 h-10 rounded-full bg-[#8B1E3F] text-[#DFBF77] font-serif font-bold text-base flex items-center justify-center">
              1
            </div>
            <h3 className="font-serif font-bold text-base text-stone-900">Bust & Apex Point</h3>
            <p className="text-stone-600 leading-relaxed">
              Wrap the measuring tape comfortably around the fullest part of your bust (apex point) wearing your intended bridal brassiere. Keep the tape level across your back.
            </p>
          </div>

          <div className="bg-white border border-[#E6D5B8] rounded-2xl p-6 shadow-xs space-y-3 text-xs">
            <div className="w-10 h-10 rounded-full bg-[#8B1E3F] text-[#DFBF77] font-serif font-bold text-base flex items-center justify-center">
              2
            </div>
            <h3 className="font-serif font-bold text-base text-stone-900">Underbust & Natural Waist</h3>
            <p className="text-stone-600 leading-relaxed">
              Measure snugly right beneath your bust line where the blouse waistband will rest. Do not pull the tape too tight; allow normal breathing room.
            </p>
          </div>

          <div className="bg-white border border-[#E6D5B8] rounded-2xl p-6 shadow-xs space-y-3 text-xs">
            <div className="w-10 h-10 rounded-full bg-[#8B1E3F] text-[#DFBF77] font-serif font-bold text-base flex items-center justify-center">
              3
            </div>
            <h3 className="font-serif font-bold text-base text-stone-900">Shoulder & Armhole</h3>
            <p className="text-stone-600 leading-relaxed">
              Measure across the upper back from the tip of the left shoulder bone to the right. Loop the tape around the armpit joint to get your armhole circumference.
            </p>
          </div>
        </div>

        {/* Neckline Styles Overview */}
        <div className="bg-white border border-[#E6D5B8] rounded-3xl p-8 sm:p-10 shadow-xs space-y-6">
          <h2 className="text-xl sm:text-2xl font-serif font-bold text-stone-900">
            Popular Blouse Styles
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 text-xs">
            <div className="p-4 bg-[#FAF7F2] rounded-xl border border-[#E6D5B8] space-y-2">
              <h4 className="font-bold text-stone-900 text-sm">Princess Cut with Padded Cups</h4>
              <p className="text-stone-600 leading-relaxed">
                Sculpted vertical princess seams tailored to contour your curves without horizontal darts. Ideal for heavy Kanjeevaram and Banarasi zari silks.
              </p>
            </div>

            <div className="p-4 bg-[#FAF7F2] rounded-xl border border-[#E6D5B8] space-y-2">
              <h4 className="font-bold text-stone-900 text-sm">Deep Sweetheart & V-Neck</h4>
              <p className="text-stone-600 leading-relaxed">
                Romantic bridal cut that elegantly frames statement temple chokers and Polki collar necklaces.
              </p>
            </div>

            <div className="p-4 bg-[#FAF7F2] rounded-xl border border-[#E6D5B8] space-y-2">
              <h4 className="font-bold text-stone-900 text-sm">High Collar Keyhole Back</h4>
              <p className="text-stone-600 leading-relaxed">
                Contemporary royal aesthetic featuring hand-embroidered Zardozi borders and pearl tassel latkans.
              </p>
            </div>
          </div>
        </div>

        {/* Virtual Video Assistance Banner */}
        <div className="bg-gradient-to-r from-[#8B1E3F] to-[#5C1026] rounded-3xl p-8 sm:p-10 text-white flex flex-col sm:flex-row items-center justify-between gap-6 shadow-xl">
          <div className="space-y-2 text-center sm:text-left">
            <h3 className="font-serif font-bold text-xl sm:text-2xl">Want a Master Tailor to Guide You on Video?</h3>
            <p className="text-xs text-[#EFE7DA]/90 max-w-lg">
              Book a complimentary 15-minute 1-on-1 virtual video call with our Hyderabad tailoring expert.
            </p>
          </div>

          <button
            onClick={() => navigate('contact')}
            className="bg-[#FAF7F2] text-[#8B1E3F] hover:bg-white text-xs uppercase font-bold tracking-widest px-6 py-3.5 rounded-xl flex items-center gap-2 shrink-0 shadow-md transition-all"
          >
            <Video className="w-4 h-4" /> Book Virtual Fitting
          </button>
        </div>
      </div>
    </div>
  );
};
