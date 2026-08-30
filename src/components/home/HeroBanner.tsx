import React, { useEffect, useState } from 'react';
import { ArrowRight, ChevronLeft, ChevronRight } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useStore } from '../../context/StoreContext';

// These neutral, editable launch banners intentionally make no unverified
// product claim. They can be replaced by admin-managed image banners later.
const SLIDES = [
  { id: 'discover', eyebrow: 'AB Collection', title: 'Discover the collection', body: 'Browse the latest pieces and enquire about current availability.', cta: 'Shop now', tone: 'from-[#37302d] via-[#6d5b52] to-[#cabaaa]' },
  { id: 'new', eyebrow: 'AB Collection', title: 'New arrivals', body: 'See the newest additions to the catalog as they become available.', cta: 'Explore collection', tone: 'from-[#3f4140] via-[#77736d] to-[#d7c9b9]' },
  { id: 'tailoring', eyebrow: 'AB Collection', title: 'Made for your moment', body: 'Explore sizing and tailoring information before placing an order.', cta: 'Explore tailoring', tone: 'from-[#413330] via-[#846158] to-[#d5b5a0]', view: 'tailoring-guide' as const }
];

export const HeroBanner: React.FC = () => {
  const { navigate } = useStore();
  const [index, setIndex] = useState(0);
  useEffect(() => { const timer = window.setInterval(() => setIndex((current) => (current + 1) % SLIDES.length), 6500); return () => window.clearInterval(timer); }, []);
  const slide = SLIDES[index];
  const next = () => setIndex((current) => (current + 1) % SLIDES.length);
  const previous = () => setIndex((current) => (current - 1 + SLIDES.length) % SLIDES.length);
  return <section className="relative min-h-[560px] overflow-hidden bg-[#272421] sm:min-h-[650px]"><AnimatePresence mode="wait"><motion.div key={slide.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: .7 }} className={`absolute inset-0 bg-gradient-to-br ${slide.tone}`}><div className="absolute inset-0 opacity-40 [background-image:radial-gradient(circle_at_20%_15%,#fff8_0,transparent_28%),radial-gradient(circle_at_80%_80%,#fff5_0,transparent_26%)]" /></motion.div></AnimatePresence><div className="relative mx-auto flex min-h-[560px] max-w-[1440px] items-center px-6 py-20 sm:min-h-[650px] sm:px-10 lg:px-16"><motion.div key={`copy-${slide.id}`} initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .6, delay: .15 }} className="max-w-2xl text-white"><p className="text-[11px] uppercase tracking-[.25em] text-white/70">{slide.eyebrow}</p><h1 className="mt-4 font-serif text-5xl leading-[.95] sm:text-7xl">{slide.title}</h1><p className="mt-6 max-w-lg text-sm leading-6 text-white/85 sm:text-base">{slide.body}</p><button onClick={() => navigate(slide.view || 'shop')} className="mt-8 inline-flex items-center gap-2 border border-white bg-white px-6 py-3 text-[11px] font-semibold uppercase tracking-[.13em] text-[#2c2926] transition hover:bg-transparent hover:text-white">{slide.cta}<ArrowRight className="h-4 w-4" /></button></motion.div></div><div className="absolute bottom-8 right-6 flex items-center gap-3 sm:right-10"><button aria-label="Previous banner" onClick={previous} className="grid h-10 w-10 place-items-center border border-white/40 text-white hover:bg-white/15"><ChevronLeft className="h-5 w-5" /></button><div className="flex gap-2">{SLIDES.map((item, itemIndex) => <button key={item.id} aria-label={`Show banner ${itemIndex + 1}`} onClick={() => setIndex(itemIndex)} className={`h-1.5 ${index === itemIndex ? 'w-8 bg-white' : 'w-2 bg-white/50'}`} />)}</div><button aria-label="Next banner" onClick={next} className="grid h-10 w-10 place-items-center border border-white/40 text-white hover:bg-white/15"><ChevronRight className="h-5 w-5" /></button></div></section>;
};
