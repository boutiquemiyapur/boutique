import React from 'react';
import { useStore } from '../../context/StoreContext';
import { Category } from '../../types';
import { ArrowRight, Sparkles } from 'lucide-react';

interface CategoryCard {
  title: string;
  category: Category;
  tagline: string;
  image: string;
  itemCount: string;
}

const CATEGORIES: CategoryCard[] = [
  {
    title: 'Kanjeevaram Silks',
    category: 'Kanjeevaram Silks',
    tagline: 'Pure 24K Gold Zari Korvai Weaves',
    image: 'https://images.unsplash.com/photo-1610030469983-98e550d6193c?auto=format&fit=crop&w=800&q=80',
    itemCount: '48 Designs'
  },
  {
    title: 'Bridal Lehengas',
    category: 'Bridal Lehengas',
    tagline: 'Opulent Velvet & Zardozi Handwork',
    image: 'https://images.unsplash.com/photo-1594744803329-e58b31de8bf5?auto=format&fit=crop&w=800&q=80',
    itemCount: '24 Bespoke Sets'
  },
  {
    title: 'Banarasi Brocades',
    category: 'Banarasi Sarees',
    tagline: 'Authentic Varanasi Sonarupa Jaal',
    image: 'https://images.unsplash.com/photo-1617627143750-d86bc21e42bb?auto=format&fit=crop&w=800&q=80',
    itemCount: '36 Masterpieces'
  },
  {
    title: 'Designer Organza & Chanderi',
    category: 'Designer Sarees',
    tagline: 'Hand-Painted Pastels & Pearl Scallops',
    image: 'https://images.unsplash.com/photo-1609357605129-26f69add5d6e?auto=format&fit=crop&w=800&q=80',
    itemCount: '30 Drapes'
  },
  {
    title: 'Unstitched Suits',
    category: 'Unstitched Suits',
    tagline: 'Awadhi Mukaish & 32-Stitch Chikankari',
    image: 'https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b?auto=format&fit=crop&w=800&q=80',
    itemCount: '40 Ensembles'
  },
  {
    title: 'Temple Heritage Jewelry',
    category: 'Temple Jewelry',
    tagline: '22K Antique Micron Gold & Kemp Rubies',
    image: 'https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?auto=format&fit=crop&w=800&q=80',
    itemCount: '20 Curated Pieces'
  }
];

export const CategoryShowcase: React.FC = () => {
  const { navigate, setFilters } = useStore();

  const handleSelectCategory = (category: Category) => {
    setFilters((prev) => ({ ...prev, category, searchQuery: '' }));
    navigate('shop');
  };

  return (
    <section className="py-16 sm:py-20 bg-[#FAF7F2]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center max-w-2xl mx-auto mb-12">
          <span className="text-xs uppercase tracking-[0.25em] font-semibold text-[#8B1E3F]">
            Curated Boutiques
          </span>
          <h2 className="text-2xl sm:text-4xl font-serif font-bold text-[#1A1715] mt-2">
            Explore Heritage Collections
          </h2>
          <div className="w-16 h-0.5 bg-[#C5A059] mx-auto mt-3"></div>
          <p className="text-xs sm:text-sm text-stone-600 mt-3">
            Handcrafted with age-old techniques passed down through generations of master Indian artisans.
          </p>
        </div>

        {/* Category Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
          {CATEGORIES.map((cat, idx) => (
            <div
              key={cat.title}
              id={`category-card-${idx}`}
              onClick={() => handleSelectCategory(cat.category)}
              className="group relative h-96 sm:h-[420px] rounded-2xl overflow-hidden cursor-pointer shadow-md hover:shadow-2xl transition-all duration-500 border border-[#E6D5B8]"
            >
              <img
                src={cat.image}
                alt={cat.title}
                className="w-full h-full object-cover group-hover:scale-108 transition-transform duration-700 ease-out"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent" />

              <div className="absolute inset-0 p-6 sm:p-8 flex flex-col justify-between text-white z-10">
                <div className="flex justify-between items-start">
                  <span className="bg-[#FAF7F2]/20 backdrop-blur-md border border-white/20 text-[11px] font-bold uppercase tracking-wider px-3 py-1 rounded-full text-[#DFBF77]">
                    {cat.itemCount}
                  </span>
                </div>

                <div className="space-y-2">
                  <span className="text-[11px] uppercase tracking-widest text-[#DFBF77] font-semibold">
                    {cat.tagline}
                  </span>
                  <h3 className="text-xl sm:text-2xl font-serif font-bold text-white group-hover:text-[#DFBF77] transition-colors">
                    {cat.title}
                  </h3>
                  <div className="pt-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[#FAF7F2] group-hover:translate-x-1.5 transition-transform">
                    <span>Explore Boutique</span>
                    <ArrowRight className="w-3.5 h-3.5 text-[#DFBF77]" />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
