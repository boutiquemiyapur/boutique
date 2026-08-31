import React, { useEffect, useRef, useState } from 'react';
import { ArrowRight, ChevronLeft, ChevronRight } from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useStore } from '../../context/StoreContext';
import bannerOne from '../../../media/B1.png';
import bannerTwo from '../../../media/B2.png';
import bannerThree from '../../../media/B3.png';

type HeroSlide = {
  id: string;
  image: string;
  alt: string;
  eyebrow: string;
  title: string;
  description: string;
  cta: string;
  ctaDestination: string;
  desktopPositionClass: string;
  mobilePositionClass: string;
};

const SLIDES: HeroSlide[] = [
  {
    id: 'timeless-elegance', image: bannerOne,
    alt: 'AB Collection embroidered occasionwear in emerald, blue, and maroon',
    eyebrow: 'AB Collection', title: 'Timeless Elegance',
    description: 'Discover refined styles for every special moment.', cta: 'Shop now', ctaDestination: '/shop',
    desktopPositionClass: 'lg:object-[50%_36%]', mobilePositionClass: 'object-[50%_50%]'
  },
  {
    id: 'every-occasion', image: bannerTwo,
    alt: 'AB Collection boutique styles with detailed embroidery',
    eyebrow: 'The Collection', title: 'Crafted for Every Occasion',
    description: 'Explore beautifully detailed boutique styles designed to make an impression.', cta: 'Explore collection', ctaDestination: '/shop',
    desktopPositionClass: 'lg:object-[50%_34%]', mobilePositionClass: 'object-[62%_50%]'
  },
  {
    id: 'new-arrivals', image: bannerThree,
    alt: 'AB Collection maroon embroidered outfit from the latest collection',
    eyebrow: 'New Arrivals', title: 'Elegance in Every Detail',
    description: 'Discover our latest boutique collection.', cta: 'View new arrivals', ctaDestination: '/shop',
    desktopPositionClass: 'lg:object-[50%_35%]', mobilePositionClass: 'object-[52%_50%]'
  }
];

const AUTOPLAY_INTERVAL = 5000;
const INTERACTION_PAUSE = 7000;
const SWIPE_THRESHOLD = 48;

export const HeroBanner: React.FC = () => {
  const { navigate, cms } = useStore();
  const prefersReducedMotion = useReducedMotion();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const pauseTimeoutRef = useRef<number | null>(null);
  const touchStartXRef = useRef<number | null>(null);
  const slides: HeroSlide[] = cms.banners.length ? cms.banners.map((banner) => ({
    id: banner.id, image: banner.image, alt: banner.title, eyebrow: cms.content.homeEyebrow,
    title: banner.title, description: banner.subtitle, cta: banner.ctaText, ctaDestination: banner.ctaDestination,
    desktopPositionClass: 'lg:object-[50%_36%]', mobilePositionClass: 'object-[50%_50%]'
  })) : SLIDES;

  const clearInteractionPause = () => {
    if (pauseTimeoutRef.current !== null) {
      window.clearTimeout(pauseTimeoutRef.current);
      pauseTimeoutRef.current = null;
    }
  };

  const pauseAfterInteraction = () => {
    clearInteractionPause();
    setIsPaused(true);
    pauseTimeoutRef.current = window.setTimeout(() => {
      setIsPaused(false);
      pauseTimeoutRef.current = null;
    }, INTERACTION_PAUSE);
  };

  const goToSlide = (nextIndex: number, pauseAfter = true) => {
    setCurrentIndex((nextIndex + slides.length) % slides.length);
    if (pauseAfter) pauseAfterInteraction();
  };

  const next = () => goToSlide(currentIndex + 1);
  const previous = () => goToSlide(currentIndex - 1);
  const currentSlide = slides[currentIndex] || slides[0];

  useEffect(() => {
    // Cache the next Vite-bundled visual while the current banner is visible.
    const nextImage = new Image();
    nextImage.src = slides[(currentIndex + 1) % slides.length].image;
  }, [currentIndex, slides]);

  useEffect(() => {
    if (isPaused || prefersReducedMotion) return undefined;
    const timer = window.setInterval(() => setCurrentIndex((index) => (index + 1) % slides.length), AUTOPLAY_INTERVAL);
    return () => window.clearInterval(timer);
  }, [isPaused, slides.length]);

  useEffect(() => () => clearInteractionPause(), []);

  const onTouchStart = (event: React.TouchEvent<HTMLElement>) => { touchStartXRef.current = event.touches[0]?.clientX ?? null; };
  const onTouchEnd = (event: React.TouchEvent<HTMLElement>) => {
    const startX = touchStartXRef.current;
    const endX = event.changedTouches[0]?.clientX;
    touchStartXRef.current = null;
    if (startX === null || endX === undefined || Math.abs(endX - startX) < SWIPE_THRESHOLD) return;
    if (endX < startX) next(); else previous();
  };

  return <section
    className="relative isolate min-h-[540px] overflow-hidden bg-[#2a201d] sm:min-h-[590px] lg:h-[620px] lg:min-h-0 xl:h-[650px]"
    aria-roledescription="carousel"
    aria-label="AB Collection highlights"
    onMouseEnter={() => setIsPaused(true)}
    onMouseLeave={() => { clearInteractionPause(); setIsPaused(false); }}
    onFocusCapture={() => setIsPaused(true)}
    onBlurCapture={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node)) { clearInteractionPause(); setIsPaused(false); } }}
    onTouchStart={onTouchStart}
    onTouchEnd={onTouchEnd}
  >
    <AnimatePresence initial={false} mode="sync">
      <motion.div key={currentSlide.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: prefersReducedMotion ? 0 : 0.8, ease: 'easeInOut' }} className="absolute inset-0">
        <img src={currentSlide.image} alt={currentSlide.alt} className={`h-full w-full object-cover ${currentSlide.mobilePositionClass} ${currentSlide.desktopPositionClass}`} fetchPriority={currentIndex === 0 ? 'high' : 'auto'} loading={currentIndex === 0 ? 'eager' : 'lazy'} />
        <div className="absolute inset-0 bg-gradient-to-t from-[#201613]/72 via-[#201613]/18 to-transparent sm:bg-gradient-to-r sm:from-[#201613]/48 sm:via-[#201613]/12 sm:to-transparent" aria-hidden="true" />
      </motion.div>
    </AnimatePresence>

    <div className="relative mx-auto flex min-h-[540px] max-w-[1440px] items-end px-6 pb-24 pt-20 sm:min-h-[590px] sm:px-10 sm:pb-28 lg:h-[620px] lg:min-h-0 lg:items-center lg:px-16 lg:py-20 xl:h-[650px]">
      <motion.div key={`content-${currentSlide.id}`} initial={{ opacity: 0, y: prefersReducedMotion ? 0 : 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: prefersReducedMotion ? 0 : 0.55, delay: prefersReducedMotion ? 0 : 0.18, ease: 'easeOut' }} className="max-w-xs text-white sm:max-w-md">
        <p className="text-[10px] font-semibold uppercase tracking-[.28em] text-white/90 sm:text-[11px]">{currentSlide.eyebrow}</p>
        <h1 className="mt-4 font-serif text-[2.65rem] leading-[.92] drop-shadow-[0_2px_12px_rgba(0,0,0,.28)] sm:text-6xl lg:text-7xl">{currentSlide.title}</h1>
        <p className="mt-4 max-w-sm text-sm leading-6 text-white/95 sm:mt-5 sm:text-base sm:leading-7">{currentSlide.description}</p>
        <button onClick={() => navigate(currentSlide.ctaDestination === '/about' ? 'about' : currentSlide.ctaDestination === '/contact' ? 'contact' : 'shop')} className="mt-8 inline-flex items-center gap-2 border border-white/80 bg-white px-6 py-3 text-[11px] font-semibold uppercase tracking-[.14em] text-[#2c2926] transition hover:bg-transparent hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white">
          {currentSlide.cta}<ArrowRight className="h-4 w-4" />
        </button>
      </motion.div>
    </div>

    <button aria-label="Previous banner" onClick={previous} className="absolute left-3 top-1/2 z-10 grid h-10 w-10 -translate-y-1/2 place-items-center border border-white/55 bg-black/20 text-white transition hover:bg-white hover:text-[#2c2926] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white sm:left-5 sm:h-11 sm:w-11" type="button"><ChevronLeft className="h-5 w-5" /></button>
    <button aria-label="Next banner" onClick={next} className="absolute right-3 top-1/2 z-10 grid h-10 w-10 -translate-y-1/2 place-items-center border border-white/55 bg-black/20 text-white transition hover:bg-white hover:text-[#2c2926] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white sm:right-5 sm:h-11 sm:w-11" type="button"><ChevronRight className="h-5 w-5" /></button>

    <div className="absolute inset-x-0 bottom-7 z-10 flex justify-center gap-2" role="group" aria-label="Select banner">
      {slides.map((slide, index) => <button key={slide.id} type="button" onClick={() => goToSlide(index)} aria-label={`Show ${slide.title}`} aria-current={index === currentIndex ? 'true' : undefined} className={`h-2.5 rounded-full border border-white/70 transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white ${index === currentIndex ? 'w-8 bg-white' : 'w-2.5 bg-white/20 hover:bg-white/60'}`} />)}
    </div>
  </section>;
};
