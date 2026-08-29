import React from 'react';
import { Star, CheckCircle2, Quote, Sparkles } from 'lucide-react';

interface Testimonial {
  id: string;
  name: string;
  city: string;
  role: string;
  avatar: string;
  rating: number;
  productPurchased: string;
  comment: string;
}

const TESTIMONIALS: Testimonial[] = [
  {
    id: 't-1',
    name: 'Dr. Radhika Menon',
    city: 'Bangalore & London',
    role: 'Bride (Muhurtham Ceremony)',
    avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=200&q=80',
    rating: 5,
    productPurchased: 'Maharani Crimson Gold Pure Kanjeevaram Saree',
    comment: 'The Korvai handloom weaving on this Kanjeevaram is majestic! The custom stitched blouse fit like a glove with zero adjustments needed on my wedding morning.'
  },
  {
    id: 't-2',
    name: 'Aishwarya Reddy',
    city: 'Hyderabad',
    role: 'Trousseau Client',
    avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=200&q=80',
    rating: 5,
    productPurchased: 'Noor-E-Chashm Velvet Zardozi Bridal Lehenga Set',
    comment: 'The double dupatta draping and heavy velvet flare made me feel like royalty. Miyapur Boutique is our entire family’s destination for all weddings.'
  },
  {
    id: 't-3',
    name: 'Nandita Singhania',
    city: 'Mumbai & Dubai',
    role: 'Wedding Guest & Sangeet',
    avatar: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&w=200&q=80',
    rating: 5,
    productPurchased: 'Varanasi Royal Katan Silk Kadwa Brocade Saree',
    comment: 'Authentic Banarasi Kadwa weave without loose threads behind. International express air shipping to Dubai arrived in just 3 days!'
  }
];

export const CustomerReviews: React.FC = () => {
  return (
    <section className="py-16 sm:py-20 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <span className="text-xs uppercase tracking-[0.25em] font-semibold text-[#8B1E3F]">
            Client Testimonials
          </span>
          <h2 className="text-2xl sm:text-4xl font-serif font-bold text-[#1A1715] mt-1">
            Loved by Brides Worldwide
          </h2>
          <div className="w-12 h-0.5 bg-[#C5A059] mx-auto mt-2"></div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {TESTIMONIALS.map((t) => (
            <div
              key={t.id}
              id={`testimonial-card-${t.id}`}
              className="bg-[#FAF7F2] border border-[#E6D5B8] rounded-2xl p-6 sm:p-8 flex flex-col justify-between shadow-xs hover:shadow-xl transition-all duration-300 relative group"
            >
              <Quote className="w-8 h-8 text-[#C5A059]/30 absolute top-6 right-6" />

              <div>
                <div className="flex items-center gap-1 text-amber-500 mb-4">
                  {[...Array(t.rating)].map((_, i) => (
                    <Star key={i} className="w-4 h-4 fill-amber-400 text-amber-400" />
                  ))}
                </div>

                <p className="text-xs sm:text-sm text-stone-700 leading-relaxed italic">
                  "{t.comment}"
                </p>

                <div className="mt-4 pt-3 border-t border-[#E6D5B8]/60 text-[11px] text-[#8B1E3F] font-semibold">
                  Purchased: {t.productPurchased}
                </div>
              </div>

              <div className="flex items-center gap-3.5 mt-6 pt-4 border-t border-[#E6D5B8]">
                <img
                  src={t.avatar}
                  alt={t.name}
                  className="w-11 h-11 rounded-full object-cover border border-[#DFBF77]"
                />
                <div>
                  <div className="flex items-center gap-1.5">
                    <h4 className="text-xs font-bold text-[#1A1715]">{t.name}</h4>
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" title="Verified Customer" />
                  </div>
                  <p className="text-[11px] text-stone-500">{t.city} • {t.role}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
