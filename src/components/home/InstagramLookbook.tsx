import React from 'react';
import { useStore } from '../../context/StoreContext';
import { Instagram, Eye, ShoppingBag } from 'lucide-react';

interface LookbookPost {
  id: string;
  image: string;
  tag: string;
  productId: string;
}

const LOOKBOOK_POSTS: LookbookPost[] = [
  {
    id: 'look-1',
    image: 'https://images.unsplash.com/photo-1610030469983-98e550d6193c?auto=format&fit=crop&w=600&q=80',
    tag: '#ABCollection',
    productId: 'mb-kanjeevaram-01'
  },
  {
    id: 'look-2',
    image: 'https://images.unsplash.com/photo-1594744803329-e58b31de8bf5?auto=format&fit=crop&w=600&q=80',
    tag: '#RoyalVelvetTrousseau',
    productId: 'mb-lehenga-02'
  },
  {
    id: 'look-3',
    image: 'https://images.unsplash.com/photo-1617627143750-d86bc21e42bb?auto=format&fit=crop&w=600&q=80',
    tag: '#BanarasiKadwa',
    productId: 'mb-banarasi-03'
  },
  {
    id: 'look-4',
    image: 'https://images.unsplash.com/photo-1609357605129-26f69add5d6e?auto=format&fit=crop&w=600&q=80',
    tag: '#OrganzaPastels',
    productId: 'mb-organza-04'
  },
  {
    id: 'look-5',
    image: 'https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b?auto=format&fit=crop&w=600&q=80',
    tag: '#LucknowiMukaish',
    productId: 'mb-suit-05'
  },
  {
    id: 'look-6',
    image: 'https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?auto=format&fit=crop&w=600&q=80',
    tag: '#TempleNakshiGold',
    productId: 'mb-jewelry-07'
  }
];

export const InstagramLookbook: React.FC = () => {
  const { navigate } = useStore();

  return (
    <section className="py-16 sm:py-20 bg-[#FAF7F2] border-t border-[#E6D5B8]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-2xl mx-auto mb-10">
          <div className="flex items-center justify-center gap-2 text-xs uppercase tracking-[0.25em] font-semibold text-[#8B1E3F]">
            <Instagram className="w-4 h-4 text-[#8B1E3F]" />
            <span>Social links coming soon</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-serif font-bold text-[#1A1715] mt-1">
            Shoppable Haute Couture Gallery
          </h2>
          <p className="text-xs text-stone-500 mt-2">
            Social profiles will be linked here once AB Collection provides them.
          </p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
          {LOOKBOOK_POSTS.map((post) => (
            <div
              key={post.id}
              id={`lookbook-post-${post.id}`}
              onClick={() => navigate('product-detail', post.productId)}
              className="group relative aspect-square rounded-xl overflow-hidden cursor-pointer shadow-xs hover:shadow-xl transition-all duration-300"
            >
              <img
                src={post.image}
                alt="Instagram Look"
                className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
              />
              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col items-center justify-center text-white p-3 text-center">
                <ShoppingBag className="w-5 h-5 text-[#DFBF77] mb-1" />
                <span className="text-[10px] font-bold uppercase tracking-wider">Shop The Look</span>
                <span className="text-[9px] text-[#DFBF77] mt-0.5">{post.tag}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
