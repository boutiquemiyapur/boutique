import React, { useState, useEffect } from 'react';
import { useStore } from '../../context/StoreContext';
import { ArrowRight, Sparkles, ChevronLeft, ChevronRight, Scissors } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface Slide {
  id: number;
  tagline: string;
  headline: string;
  subhead: string;
  ctaText: string;
  categoryTarget?: string;
  image: string;
  accentBadge?: string;
}

const SLIDES: Slide[] = [
  {
    id: 1,
    tagline: 'The Royal Muhurtham Edit • 2026',
    headline: 'Imperial Pure Kanjeevaram Silks',
    subhead: 'Mastercrafted with 24K Pure Gold Tested Zari, Three-Shuttle Korvai Weaves & Silk Mark Guarantee.',
    ctaText: 'Explore Kanjeevarams',
    categoryTarget: 'Kanjeevaram Silks',
    image: 'https://images.unsplash.com/photo-1610030469983-98e550d6193c?auto=format&fit=crop&w=1800&q=85',
    accentBadge: '100% Authentic Handloom'
  },
  {
    id: 2,
    tagline: 'Haute Bridal Trousseau',
    headline: 'Zardozi & Velvet Bridal Lehengas',
    subhead: 'Opulent Kalidar silhouettes hand-embroidered with dabka, nakshi, and Austrian Swarovski crystals.',
    ctaText: 'Discover Bridal Couture',
    categoryTarget: 'Bridal Lehengas',
    image: 'https://images.unsplash.com/photo-1594744803329-e58b31de8bf5?auto=format&fit=crop&w=1800&q=85',
    accentBadge: 'Complimentary Bespoke Tailoring'
  },
  {
    id: 3,
    tagline: 'Varanasi Heritage Weaves',
    headline: 'Handwoven Banarasi Kadwa Brocades',
    subhead: 'Centuries-old royal floral sonrupa jaal woven by hereditary master artisans on historic pit looms.',
    ctaText: 'View Banarasi Collection',
    categoryTarget: 'Banarasi Sarees',
    image: 'https://images.unsplash.com/photo-1617627143750-d86bc21e42bb?auto=format&fit=crop&w=1800&q=85',
    accentBadge: 'Heirloom Masterpieces'
  }
];

export const HeroBanner: React.FC = () => {
  const { navigate, setFilters } = useStore();
  const [currentSlide, setCurrentSlide] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % SLIDES.length);
    }, 6500);
    return () => clearInterval(timer);
  }, []);

  const slide = SLIDES[currentSlide];

  const handleCtaClick = () => {
    if (slide.categoryTarget) {
      setFilters((prev) => ({ ...prev, category: slide.categoryTarget as any, searchQuery: '' }));
    }
    navigate('shop');
  };

  return (
    <section className="relative w-full h-[580px] sm:h-[680px] lg:h-[750px] overflow-hidden bg-[#1A1715]">
      {/* Background Slides */}
      <AnimatePresence mode="wait">
        <motion.div
          key={slide.id}
          initial={{ opacity: 0, scale: 1.05 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 1 }}
          className="absolute inset-0"
        >
          <img
            src={slide.image}
            alt={slide.headline}
            className="w-full h-full object-cover object-top filter brightness-[0.72] contrast-[1.05]"
          />
          {/* Subtle vignette gradient overlays */}
          <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/40 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#1A1715] via-transparent to-black/30" />
        </motion.div>
      </AnimatePresence>

      {/* Content Container */}
      <div className="relative max-w-7xl mx-auto h-full px-6 sm:px-10 lg:px-12 flex flex-col justify-center text-white z-10">
        <motion.div
          key={`content-${slide.id}`}
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="max-w-2xl space-y-4 sm:space-y-6"
        >
          {slide.accentBadge && (
            <div className="inline-flex items-center gap-2 bg-[#FAF7F2]/15 backdrop-blur-md border border-[#DFBF77]/40 px-3.5 py-1.5 rounded-full text-[11px] font-bold uppercase tracking-widest text-[#DFBF77]">
              <Sparkles className="w-3.5 h-3.5" />
              <span>{slide.accentBadge}</span>
            </div>
          )}

          <div className="space-y-2">
            <span className="block text-xs sm:text-sm uppercase tracking-[0.25em] text-[#EFE7DA]/90 font-serif">
              {slide.tagline}
            </span>
            <h1 className="text-3xl sm:text-5xl lg:text-6xl font-serif font-bold text-[#FDFBF7] tracking-tight leading-[1.1] drop-shadow-md">
              {slide.headline}
            </h1>
          </div>

          <p className="text-xs sm:text-sm text-[#EFE7DA]/85 font-sans leading-relaxed max-w-xl">
            {slide.subhead}
          </p>

          <div className="pt-2 flex flex-wrap items-center gap-4">
            <button
              id="hero-primary-cta-btn"
              onClick={handleCtaClick}
              className="bg-[#8B1E3F] hover:bg-[#721C24] text-white text-xs sm:text-sm font-semibold uppercase tracking-widest px-7 py-3.5 rounded-lg flex items-center gap-2.5 shadow-xl hover:shadow-2xl transition-all"
            >
              <span>{slide.ctaText}</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            <button
              id="hero-tailoring-cta-btn"
              onClick={() => navigate('tailoring-guide')}
              className="bg-white/10 hover:bg-white/20 backdrop-blur-md text-white border border-[#DFBF77]/50 text-xs sm:text-sm font-semibold uppercase tracking-widest px-6 py-3.5 rounded-lg flex items-center gap-2 transition-all"
            >
              <Scissors className="w-4 h-4 text-[#DFBF77]" />
              <span>Bespoke Fitting</span>
            </button>
          </div>
        </motion.div>
      </div>

      {/* Slide Navigation Arrows */}
      <div className="absolute bottom-10 right-6 sm:right-12 z-20 flex items-center gap-3">
        <button
          id="hero-prev-slide-btn"
          onClick={() => setCurrentSlide((prev) => (prev === 0 ? SLIDES.length - 1 : prev - 1))}
          className="w-10 h-10 rounded-full border border-white/30 bg-black/40 backdrop-blur-md text-white flex items-center justify-center hover:bg-[#8B1E3F] hover:border-[#8B1E3F] transition-all"
          aria-label="Previous slide"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>

        {/* Slide Indicators */}
        <div className="flex gap-2">
          {SLIDES.map((s, idx) => (
            <button
              key={s.id}
              onClick={() => setCurrentSlide(idx)}
              className={`h-1.5 rounded-full transition-all ${
                currentSlide === idx ? 'w-8 bg-[#DFBF77]' : 'w-2 bg-white/40'
              }`}
              aria-label={`Go to slide ${idx + 1}`}
            />
          ))}
        </div>

        <button
          id="hero-next-slide-btn"
          onClick={() => setCurrentSlide((prev) => (prev + 1) % SLIDES.length)}
          className="w-10 h-10 rounded-full border border-white/30 bg-black/40 backdrop-blur-md text-white flex items-center justify-center hover:bg-[#8B1E3F] hover:border-[#8B1E3F] transition-all"
          aria-label="Next slide"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>
    </section>
  );
};
