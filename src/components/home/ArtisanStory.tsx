import React from 'react';
import { useStore } from '../../context/StoreContext';
import { Award, ShieldCheck, Heart, Sparkles, Scissors, Users, ArrowRight } from 'lucide-react';

export const ArtisanStory: React.FC = () => {
  const { navigate } = useStore();

  return (
    <section className="py-16 sm:py-24 bg-[#1A1715] text-[#FAF7F2] relative overflow-hidden">
      {/* Background Subtle Motifs */}
      <div className="absolute inset-0 opacity-5 pointer-events-none bg-[radial-gradient(#C5A059_1px,transparent_1px)] [background-size:24px_24px]"></div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          {/* Images Montage */}
          <div className="relative">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-4">
                <div className="rounded-2xl overflow-hidden shadow-2xl border border-[#DFBF77]/30 aspect-4/5">
                  <img
                    src="https://images.unsplash.com/photo-1617627143750-d86bc21e42bb?auto=format&fit=crop&w=800&q=80"
                    alt="Master Handloom Weaver"
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="bg-[#8B1E3F]/40 backdrop-blur-md p-5 rounded-2xl border border-[#DFBF77]/30 text-center">
                  <div className="font-serif text-3xl font-bold text-[#DFBF77]">350+</div>
                  <div className="text-xs uppercase tracking-wider text-[#EFE7DA] mt-1">
                    Master Artisan Families Empowered
                  </div>
                </div>
              </div>

              <div className="space-y-4 pt-8">
                <div className="bg-[#FAF7F2]/10 backdrop-blur-md p-5 rounded-2xl border border-white/20 text-center">
                  <div className="font-serif text-3xl font-bold text-[#DFBF77]">100%</div>
                  <div className="text-xs uppercase tracking-wider text-[#EFE7DA] mt-1">
                    Silk Mark India Certified
                  </div>
                </div>
                <div className="rounded-2xl overflow-hidden shadow-2xl border border-[#DFBF77]/30 aspect-4/5">
                  <img
                    src="https://images.unsplash.com/photo-1610030469983-98e550d6193c?auto=format&fit=crop&w=800&q=80"
                    alt="Pure Zari Weaving Process"
                    className="w-full h-full object-cover"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Text Content */}
          <div className="space-y-6">
            <div className="inline-flex items-center gap-2 bg-[#8B1E3F]/40 border border-[#DFBF77]/40 px-3.5 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest text-[#DFBF77]">
              <Award className="w-3.5 h-3.5" />
              <span>Living Heritage Since 1994</span>
            </div>

            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-serif font-bold text-[#FDFBF7] leading-tight">
              Preserving Sacred Looms, Empowering Generations
            </h2>

            <p className="text-xs sm:text-sm text-[#EFE7DA]/80 leading-relaxed font-sans">
              AB Collection’s brand story and sourcing information will be added after client approval.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <div className="flex items-start gap-3 p-3.5 bg-white/5 rounded-xl border border-white/10">
                <ShieldCheck className="w-5 h-5 text-[#DFBF77] shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-xs font-semibold text-white uppercase tracking-wider">
                    Tested Gold Zari
                  </h4>
                  <p className="text-[11px] text-[#EFE7DA]/70 mt-0.5">
                    Authentic pure metallic zari that retains lustre across generations.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3.5 bg-white/5 rounded-xl border border-white/10">
                <Scissors className="w-5 h-5 text-[#DFBF77] shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-xs font-semibold text-white uppercase tracking-wider">
                    Our Hyderabad Workshop
                  </h4>
                  <p className="text-[11px] text-[#EFE7DA]/70 mt-0.5">
                    Custom blouse design with hand-sewn Maggam & Zardozi embroidery.
                  </p>
                </div>
              </div>
            </div>

            <div className="pt-4 flex flex-wrap items-center gap-4">
              <button
                id="artisan-story-learn-more-btn"
                onClick={() => navigate('about')}
                className="bg-[#8B1E3F] hover:bg-[#721C24] text-white text-xs uppercase font-semibold tracking-widest px-7 py-3.5 rounded-lg flex items-center gap-2 shadow-lg transition-all"
              >
                <span>Read Our Artisan Manifesto</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
