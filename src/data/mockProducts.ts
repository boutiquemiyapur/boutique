import { Product } from '../types';

export const INITIAL_PRODUCTS: Product[] = [
  {
    id: 'mb-kanjeevaram-01',
    title: 'Maharani Crimson Gold Pure Kanjeevaram Silk Saree',
    subtitle: 'Woven with 24K Pure Gold Tested Zari & Korvai Korai Temple Border',
    sku: 'MB-KJ-7701',
    category: 'Kanjeevaram Silks',
    fabric: 'Kanjeevaram Silk',
    occasion: 'Bridal Trousseau',
    priceINR: 42500,
    originalPriceINR: 52000,
    discountPercentage: 18,
    rating: 4.9,
    reviewCount: 48,
    images: [
      'https://images.unsplash.com/photo-1610030469983-98e550d6193c?auto=format&fit=crop&w=1200&q=85',
      'https://images.unsplash.com/photo-1617627143750-d86bc21e42bb?auto=format&fit=crop&w=1200&q=85',
      'https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b?auto=format&fit=crop&w=1200&q=85'
    ],
    colors: [
      {
        colorName: 'Royal Crimson & Gold',
        colorHex: '#8B1E3F',
        images: ['https://images.unsplash.com/photo-1610030469983-98e550d6193c?auto=format&fit=crop&w=1200&q=85']
      },
      {
        colorName: 'Peacock Teal & Gold',
        colorHex: '#005F73',
        images: ['https://images.unsplash.com/photo-1617627143750-d86bc21e42bb?auto=format&fit=crop&w=1200&q=85']
      }
    ],
    availableSizes: ['Unstitched', 'Custom Made-to-Measure'],
    stockCount: 4,
    isReadyToShip: true,
    isBestseller: true,
    isNewArrival: false,
    isHandloomCertified: true,
    zariType: 'Pure Gold Zari',
    description: 'An ode to timeless South Indian bridal grandeur. This handcrafted Kanjeevaram silk saree is woven on traditional pit looms in Kanchipuram using the intricate three-shuttle Korvai weaving technique. Adorned with regal Mayil (peacock) and Rudraksha motifs in pure tested gold zari.',
    craftDetails: 'Handloom certified with Silk Mark India certification. Each saree takes approximately 220 artisan hours to weave by master weavers in Tamil Nadu.',
    careInstructions: 'Dry clean only. Store wrapped in pure unbleached muslin cloth with cedar balls. Avoid spraying perfume directly on zari work.',
    includesBlousePiece: true,
    blouseLength: '0.8 meters unstitched matching contrast brocade blouse fabric included',
    sareeLength: '5.5 meters (Total 6.3m with blouse piece)',
    weightGrams: 850,
    customStitchingAvailable: true,
    customStitchingFeeINR: 1800,
    tags: ['Bridal', 'Kanjeevaram', 'Pure Silk', 'Silk Mark', 'Gold Zari'],
    reviews: [
      {
        id: 'rev-1',
        userName: 'Aishwarya Reddy',
        userCity: 'Hyderabad',
        rating: 5,
        date: '14 Oct 2025',
        title: 'Breathtaking drape for my wedding muhurtham!',
        comment: 'The weight of the pure silk and the sheen of the gold zari is majestic. The custom blouse stitching came out with a pinpoint bespoke fit.',
        verifiedBuyer: true
      },
      {
        id: 'rev-2',
        userName: 'Dr. Radhika Menon',
        userCity: 'Bangalore',
        rating: 5,
        date: '28 Nov 2025',
        title: 'Authentic pure heirloom quality.',
        comment: 'You can immediately tell the difference between powerloom fakes and this authentic Korvai handloom. Miyapur Boutique is my absolute favorite.',
        verifiedBuyer: true
      }
    ]
  },
  {
    id: 'mb-lehenga-02',
    title: 'Noor-E-Chashm Velvet Zardozi Bridal Lehenga Set',
    subtitle: 'Hand-Embroidered with Dabka, Nakshi, Swarovski Crystals & Resham',
    sku: 'MB-LH-9904',
    category: 'Bridal Lehengas',
    fabric: 'Velvet',
    occasion: 'Bridal Trousseau',
    priceINR: 89500,
    originalPriceINR: 110000,
    discountPercentage: 19,
    rating: 5.0,
    reviewCount: 32,
    images: [
      'https://images.unsplash.com/photo-1594744803329-e58b31de8bf5?auto=format&fit=crop&w=1200&q=85',
      'https://images.unsplash.com/photo-1546804784-896d0dca3805?auto=format&fit=crop&w=1200&q=85',
      'https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b?auto=format&fit=crop&w=1200&q=85'
    ],
    colors: [
      {
        colorName: 'Deep Burgundy Wine',
        colorHex: '#58111A',
        images: ['https://images.unsplash.com/photo-1594744803329-e58b31de8bf5?auto=format&fit=crop&w=1200&q=85']
      },
      {
        colorName: 'Royal Emerald Velvet',
        colorHex: '#16423C',
        images: ['https://images.unsplash.com/photo-1546804784-896d0dca3805?auto=format&fit=crop&w=1200&q=85']
      }
    ],
    availableSizes: ['XS', 'S', 'M', 'L', 'XL', 'Custom Made-to-Measure'],
    stockCount: 3,
    isReadyToShip: false,
    isBestseller: true,
    isNewArrival: true,
    isHandloomCertified: false,
    zariType: 'Antique Zari',
    description: 'An opulent bridal ensemble crafted from micro-velvet featuring a 6-meter dramatic flare. Hand-embellished by master Zardozi artisans in Old Hyderabad with antique gold metallic threads, French knot resham work, and shimmering micro-crystals.',
    craftDetails: 'Set includes handcrafted Kalidar lehenga skirt with double cancan lining, matching embroidered blouse, and dual dupattas (one velvet shoulder dupatta and one light embroidered organza veil).',
    careInstructions: 'Professional bridal dry clean only. Store in acid-free garment case.',
    includesBlousePiece: true,
    weightGrams: 3200,
    customStitchingAvailable: true,
    customStitchingFeeINR: 0,
    tags: ['Bridal Lehenga', 'Velvet', 'Zardozi', 'Double Dupatta', 'Couture'],
    reviews: [
      {
        id: 'rev-3',
        userName: 'Samhita Rao',
        userCity: 'Dallas, USA',
        rating: 5,
        date: '05 Jan 2026',
        title: 'Ordered for my destination wedding — dream come true!',
        comment: 'The double dupatta and velvet richness looked regal on camera. Shipping to USA was super fast and well boxed.',
        verifiedBuyer: true
      }
    ]
  },
  {
    id: 'mb-banarasi-03',
    title: 'Varanasi Royal Katan Silk Kadwa Brocade Saree',
    subtitle: 'Antique Sonarupa Floral Jaal with Handwoven Meenakari Accents',
    sku: 'MB-BN-4421',
    category: 'Banarasi Sarees',
    fabric: 'Banarasi Katan Silk',
    occasion: 'Wedding Guest',
    priceINR: 34900,
    originalPriceINR: 42000,
    discountPercentage: 17,
    rating: 4.8,
    reviewCount: 29,
    images: [
      'https://images.unsplash.com/photo-1617627143750-d86bc21e42bb?auto=format&fit=crop&w=1200&q=85',
      'https://images.unsplash.com/photo-1610030469983-98e550d6193c?auto=format&fit=crop&w=1200&q=85'
    ],
    colors: [
      {
        colorName: 'Imperial Mustard Gold & Rani Pink',
        colorHex: '#D4AF37',
        images: ['https://images.unsplash.com/photo-1617627143750-d86bc21e42bb?auto=format&fit=crop&w=1200&q=85']
      }
    ],
    availableSizes: ['Unstitched', 'Custom Made-to-Measure'],
    stockCount: 6,
    isReadyToShip: true,
    isBestseller: true,
    isNewArrival: false,
    isHandloomCertified: true,
    zariType: 'Tested Zari',
    description: 'A masterpiece from the holy ghats of Varanasi. Woven on authentic handlooms with pure mulberry Katan silk warp and weft, featuring the prestigious Kadwa weaving technique where each floral buta is individually engraved with gold and silver zari.',
    craftDetails: 'Kadwa technique leaves no floating threads on the reverse side of the saree, ensuring unmatched comfort against the skin.',
    careInstructions: 'Dry clean only. Avoid moisture exposure.',
    includesBlousePiece: true,
    blouseLength: '1.0 meter woven brocade piece included',
    sareeLength: '5.5 meters',
    weightGrams: 780,
    customStitchingAvailable: true,
    customStitchingFeeINR: 1500,
    tags: ['Banarasi', 'Kadwa', 'Katan Silk', 'Meenakari', 'Heritage'],
    reviews: [
      {
        id: 'rev-4',
        userName: 'Sonal Kapoor',
        userCity: 'Mumbai',
        rating: 5,
        date: '19 Jan 2026',
        title: 'True Banarasi heritage quality',
        comment: 'The Kadwa weave is clean on the reverse side. The drape is so soft yet holds crisp pleats all evening.',
        verifiedBuyer: true
      }
    ]
  },
  {
    id: 'mb-organza-04',
    title: 'Gulmarg Hand-Painted French Rose Silk Organza Saree',
    subtitle: 'Scalloped Cutwork Border with Pearl & Cutdana Hand Embroidery',
    sku: 'MB-OG-5512',
    category: 'Designer Sarees',
    fabric: 'Organza Silk',
    occasion: 'Cocktail & Evening',
    priceINR: 19800,
    originalPriceINR: 24500,
    discountPercentage: 19,
    rating: 4.9,
    reviewCount: 41,
    images: [
      'https://images.unsplash.com/photo-1609357605129-26f69add5d6e?auto=format&fit=crop&w=1200&q=85',
      'https://images.unsplash.com/photo-1610030469983-98e550d6193c?auto=format&fit=crop&w=1200&q=85'
    ],
    colors: [
      {
        colorName: 'Blush Rose Pink',
        colorHex: '#E8B4B8',
        images: ['https://images.unsplash.com/photo-1609357605129-26f69add5d6e?auto=format&fit=crop&w=1200&q=85']
      },
      {
        colorName: 'Champagne Ivory',
        colorHex: '#EFE7DA',
        images: ['https://images.unsplash.com/photo-1609357605129-26f69add5d6e?auto=format&fit=crop&w=1200&q=85']
      }
    ],
    availableSizes: ['Unstitched', 'Custom Made-to-Measure'],
    stockCount: 8,
    isReadyToShip: true,
    isBestseller: false,
    isNewArrival: true,
    isHandloomCertified: false,
    zariType: 'Thread Embroidery',
    description: 'Ethereal lightness meets modern romanticism. Crafted in sheer pure silk organza, hand-painted with pastel English floral blooms and finished with laser-cut scalloped borders embroidered with seed pearls and glass cutdana.',
    craftDetails: 'Comes with a heavy raw silk designer blouse piece featuring matching pearl spray embroidery on the sleeves and neckline.',
    careInstructions: 'Dry clean only. Steam press gently on lowest heat setting.',
    includesBlousePiece: true,
    blouseLength: '1.0 meter embellished raw silk piece',
    sareeLength: '5.5 meters',
    weightGrams: 420,
    customStitchingAvailable: true,
    customStitchingFeeINR: 1500,
    tags: ['Organza', 'Hand Painted', 'Pastels', 'Designer Saree', 'Summer Wedding'],
    reviews: [
      {
        id: 'rev-5',
        userName: 'Nandita Sen',
        userCity: 'Kolkata',
        rating: 5,
        date: '02 Feb 2026',
        title: 'Received endless compliments at the reception!',
        comment: 'So airy, delicate and elegant. The pearl scalloping adds an exquisite finish.',
        verifiedBuyer: true
      }
    ]
  },
  {
    id: 'mb-suit-05',
    title: 'Lucknowi Mukaish & Chikankari Georgette Unstitched Suit Set',
    subtitle: '3-Piece Set with 32-Stitch Intricate Needlework & Chiffon Dupatta',
    sku: 'MB-CK-3108',
    category: 'Unstitched Suits',
    fabric: 'Chikankari Cotton',
    occasion: 'Festive & Puja',
    priceINR: 14500,
    originalPriceINR: 17900,
    discountPercentage: 19,
    rating: 4.7,
    reviewCount: 38,
    images: [
      'https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b?auto=format&fit=crop&w=1200&q=85',
      'https://images.unsplash.com/photo-1609357605129-26f69add5d6e?auto=format&fit=crop&w=1200&q=85'
    ],
    colors: [
      {
        colorName: 'Powder Blue & Silver',
        colorHex: '#A0C4E2',
        images: ['https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b?auto=format&fit=crop&w=1200&q=85']
      },
      {
        colorName: 'Mint Sage Green',
        colorHex: '#9BB89A',
        images: ['https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b?auto=format&fit=crop&w=1200&q=85']
      }
    ],
    availableSizes: ['Unstitched', 'Custom Made-to-Measure'],
    stockCount: 10,
    isReadyToShip: true,
    isBestseller: true,
    isNewArrival: false,
    isHandloomCertified: true,
    zariType: 'Silver Zari',
    description: 'A tribute to the Awadhi royal courts of Lucknow. Pure viscose georgette kurta length adorned with Bakhiya, Phanda, and Keel Kangan stitches, studded with handmade silver Mukaish dots for a subtle festive sparkle.',
    craftDetails: 'Set includes: 3.0m Kurta Fabric with heavy front & sleeve embroidery, 2.5m Bottom fabric with hem border, 2.5m Pure Chiffon Dupatta with all-over chikankari butis and mukaish work.',
    careInstructions: 'Hand wash gently in cold water with mild detergent or dry clean.',
    includesBlousePiece: false,
    weightGrams: 650,
    customStitchingAvailable: true,
    customStitchingFeeINR: 1600,
    tags: ['Chikankari', 'Lucknowi', 'Mukaish', 'Unstitched', 'Pastels'],
    reviews: [
      {
        id: 'rev-6',
        userName: 'Farah Khan',
        userCity: 'Delhi',
        rating: 5,
        date: '12 Feb 2026',
        title: 'Exquisite hand embroidery!',
        comment: 'Authentic Lucknowi craft at honest pricing. The pure chiffon dupatta is so soft and dreamy.',
        verifiedBuyer: true
      }
    ]
  },
  {
    id: 'mb-anarkali-06',
    title: 'Jahanara Royal Emerald Pure Silk Anarkali Gown',
    subtitle: '56-Kali Floor-Length Kalidar with Gotta Patti & Marodi Neckline',
    sku: 'MB-AK-8120',
    category: 'Anarkalis & Kurtis',
    fabric: 'Raw Silk',
    occasion: 'Sangeet & Mehendi',
    priceINR: 28500,
    originalPriceINR: 35000,
    discountPercentage: 18,
    rating: 4.9,
    reviewCount: 26,
    images: [
      'https://images.unsplash.com/photo-1546804784-896d0dca3805?auto=format&fit=crop&w=1200&q=85',
      'https://images.unsplash.com/photo-1594744803329-e58b31de8bf5?auto=format&fit=crop&w=1200&q=85'
    ],
    colors: [
      {
        colorName: 'Royal Emerald Green',
        colorHex: '#16423C',
        images: ['https://images.unsplash.com/photo-1546804784-896d0dca3805?auto=format&fit=crop&w=1200&q=85']
      },
      {
        colorName: 'Deep Ochre Mustard',
        colorHex: '#C5A059',
        images: ['https://images.unsplash.com/photo-1546804784-896d0dca3805?auto=format&fit=crop&w=1200&q=85']
      }
    ],
    availableSizes: ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'Custom Made-to-Measure'],
    stockCount: 5,
    isReadyToShip: true,
    isBestseller: false,
    isNewArrival: true,
    isHandloomCertified: false,
    zariType: 'Antique Zari',
    description: 'An architectural 56-kali silhouette in rich Chanderi raw silk that swishes gracefully with every step. Finished with handcrafted real zari gota patti laces along the colossal hemline and an intricate hand-marodi embroidered yoke.',
    craftDetails: 'Paired with matching stretch churidar pants and a contrast heavy woven Banarasi tissue dupatta.',
    careInstructions: 'Dry clean only. Store hanging in breathable garment bag.',
    includesBlousePiece: false,
    weightGrams: 1450,
    customStitchingAvailable: true,
    customStitchingFeeINR: 0,
    tags: ['Anarkali', 'Gotta Patti', 'Sangeet Wear', 'Emerald Green', 'Heritage Silks'],
    reviews: [
      {
        id: 'rev-7',
        userName: 'Meghna Varma',
        userCity: 'Chennai',
        rating: 5,
        date: '21 Feb 2026',
        title: 'Royal flare and twirl!',
        comment: 'The twirl on this anarkali is unmatched. Wore it to my brother s sangeet and felt like royalty.',
        verifiedBuyer: true
      }
    ]
  },
  {
    id: 'mb-jewelry-07',
    title: 'Temple Heritage Nakshi Lakshmi Choker & Jhumka Set',
    subtitle: 'Handcrafted in 22K Gold Antique Micron Polish with Kemp Rubies',
    sku: 'MB-JW-1092',
    category: 'Temple Jewelry',
    fabric: 'Raw Silk',
    occasion: 'Bridal Trousseau',
    priceINR: 12800,
    originalPriceINR: 16000,
    discountPercentage: 20,
    rating: 5.0,
    reviewCount: 19,
    images: [
      'https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?auto=format&fit=crop&w=1200&q=85',
      'https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?auto=format&fit=crop&w=1200&q=85'
    ],
    colors: [
      {
        colorName: 'Antique South Gold with Kemp Ruby',
        colorHex: '#C5A059',
        images: ['https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?auto=format&fit=crop&w=1200&q=85']
      }
    ],
    availableSizes: ['Unstitched'],
    stockCount: 7,
    isReadyToShip: true,
    isBestseller: true,
    isNewArrival: false,
    isHandloomCertified: false,
    description: 'Inspired by the ancient Chola dynasty temple architecture of Thanjavur. Features Goddess Lakshmi seated upon a lotus, flanked by dancing peacocks carved in 3D Nakshi repoussé work, encrusted with natural kemp stones and fresh water pearls.',
    craftDetails: 'Solid brass and copper base with 2.5 micron long-life 22K antique gold electroplating. Includes matching heavy temple jhumkas.',
    careInstructions: 'Keep away from moisture, hairsprays, and perfumes. Wipe with soft cotton after use.',
    includesBlousePiece: false,
    weightGrams: 280,
    customStitchingAvailable: false,
    customStitchingFeeINR: 0,
    tags: ['Temple Jewelry', 'Lakshmi Choker', 'Kemp Stones', 'Bridal Jewelry', 'Antique Gold'],
    reviews: [
      {
        id: 'rev-8',
        userName: 'Kalyani S.',
        userCity: 'Coimbatore',
        rating: 5,
        date: '01 Mar 2026',
        title: 'Stunning temple craftsmanship',
        comment: 'Looks identical to real 22k gold heirloom jewelry. The finish and stone setting is flawless.',
        verifiedBuyer: true
      }
    ]
  },
  {
    id: 'mb-indowestern-08',
    title: 'Mirage Draped Pre-Stitched Concept Saree with Embroidered Cape',
    subtitle: 'Italian Silk Georgette with Mirror Work & Pearl Embellished Bustier',
    sku: 'MB-IW-6219',
    category: 'Indo-Western',
    fabric: 'Georgette',
    occasion: 'Cocktail & Evening',
    priceINR: 24500,
    originalPriceINR: 29900,
    discountPercentage: 18,
    rating: 4.8,
    reviewCount: 22,
    images: [
      'https://images.unsplash.com/photo-1566737236500-c8ac43014a67?auto=format&fit=crop&w=1200&q=85',
      'https://images.unsplash.com/photo-1609357605129-26f69add5d6e?auto=format&fit=crop&w=1200&q=85'
    ],
    colors: [
      {
        colorName: 'Champagne Taupe',
        colorHex: '#C5A880',
        images: ['https://images.unsplash.com/photo-1566737236500-c8ac43014a67?auto=format&fit=crop&w=1200&q=85']
      },
      {
        colorName: 'Midnight Obsidian',
        colorHex: '#1A1A1A',
        images: ['https://images.unsplash.com/photo-1566737236500-c8ac43014a67?auto=format&fit=crop&w=1200&q=85']
      }
    ],
    availableSizes: ['XS', 'S', 'M', 'L', 'XL', 'Custom Made-to-Measure'],
    stockCount: 4,
    isReadyToShip: true,
    isBestseller: false,
    isNewArrival: true,
    isHandloomCertified: false,
    zariType: 'Thread Embroidery',
    description: 'Designed for effortless contemporary glamour. Features pre-pleated Italian georgette drape with concealed zipper closure, paired with a hand-embroidered mirror-work structured bustier and a sheer waterfall cape jacket.',
    craftDetails: 'Drapes on in 30 seconds with no safety pins or traditional saree tucking required. Tailored with in-built slimming lining.',
    careInstructions: 'Dry clean only.',
    includesBlousePiece: true,
    weightGrams: 890,
    customStitchingAvailable: true,
    customStitchingFeeINR: 0,
    tags: ['Pre-Stitched Saree', 'Indo-Western', 'Cape Set', 'Cocktail Glam', 'Ready to Wear'],
    reviews: [
      {
        id: 'rev-9',
        userName: 'Ananya Singhania',
        userCity: 'London, UK',
        rating: 5,
        date: '08 Mar 2026',
        title: 'Easiest saree I have ever worn!',
        comment: 'Zips up like a skirt and looks runway ready. Received so many compliments in London.',
        verifiedBuyer: true
      }
    ]
  },
  {
    id: 'mb-kanjeevaram-09',
    title: 'Ayodhya Golden Sun Shimmer Kanjeevaram Bridal Silk',
    subtitle: 'Tissue Brocade Body with Contrast Morpankhi Blue Zari Pallu',
    sku: 'MB-KJ-8812',
    category: 'Kanjeevaram Silks',
    fabric: 'Kanjeevaram Silk',
    occasion: 'Bridal Trousseau',
    priceINR: 54000,
    originalPriceINR: 65000,
    discountPercentage: 17,
    rating: 5.0,
    reviewCount: 35,
    images: [
      'https://images.unsplash.com/photo-1617627143750-d86bc21e42bb?auto=format&fit=crop&w=1200&q=85',
      'https://images.unsplash.com/photo-1610030469983-98e550d6193c?auto=format&fit=crop&w=1200&q=85'
    ],
    colors: [
      {
        colorName: 'Sun Gold & Morpankhi Blue',
        colorHex: '#DFBF77',
        images: ['https://images.unsplash.com/photo-1617627143750-d86bc21e42bb?auto=format&fit=crop&w=1200&q=85']
      }
    ],
    availableSizes: ['Unstitched', 'Custom Made-to-Measure'],
    stockCount: 2,
    isReadyToShip: true,
    isBestseller: true,
    isNewArrival: true,
    isHandloomCertified: true,
    zariType: 'Pure Gold Zari',
    description: 'A royal bridal heirloom woven with gold tissue warp and weft for a continuous radiant glow. Features authentic Kanchipuram temple gopuram borders and a grand heavy pallu depicting the sacred Kalasam motifs.',
    craftDetails: 'Double-warp 3-ply mulberry silk, certified by Silk Mark India.',
    careInstructions: 'Dry clean only. Roll in muslin fabric. Refold every 6 months along fresh crease lines.',
    includesBlousePiece: true,
    blouseLength: '0.85m contrast tissue blouse fabric with heavy border',
    sareeLength: '5.5 meters',
    weightGrams: 920,
    customStitchingAvailable: true,
    customStitchingFeeINR: 1800,
    tags: ['Kanjeevaram', 'Tissue Silk', 'Gold Zari', 'Bridal Saree', 'Handloom'],
    reviews: []
  },
  {
    id: 'mb-banarasi-10',
    title: 'Rani Bagh Handwoven Banarasi Shikargah Jangla Silk Saree',
    subtitle: 'Centuries-Old Royal Hunting Scene Motif Woven in Pure Gold & Silver Zari',
    sku: 'MB-BN-9031',
    category: 'Banarasi Sarees',
    fabric: 'Banarasi Katan Silk',
    occasion: 'Reception & Party',
    priceINR: 48900,
    originalPriceINR: 58000,
    discountPercentage: 16,
    rating: 4.9,
    reviewCount: 18,
    images: [
      'https://images.unsplash.com/photo-1610030469983-98e550d6193c?auto=format&fit=crop&w=1200&q=85',
      'https://images.unsplash.com/photo-1617627143750-d86bc21e42bb?auto=format&fit=crop&w=1200&q=85'
    ],
    colors: [
      {
        colorName: 'Deep Wine Plum',
        colorHex: '#4A1525',
        images: ['https://images.unsplash.com/photo-1610030469983-98e550d6193c?auto=format&fit=crop&w=1200&q=85']
      }
    ],
    availableSizes: ['Unstitched', 'Custom Made-to-Measure'],
    stockCount: 3,
    isReadyToShip: true,
    isBestseller: false,
    isNewArrival: false,
    isHandloomCertified: true,
    zariType: 'Pure Gold Zari',
    description: 'The crowning jewel of Banarasi handloom artistry. Shikargah depicts flora and fauna in a continuous tapestry of intricately woven creepers, deer, peacocks, and tigers using traditional jacquard and throw shuttles.',
    craftDetails: 'Takes over 45 days of painstaking manual weaving by heritage master weavers in Varanasi.',
    careInstructions: 'Dry clean only. Store in pure cotton bag.',
    includesBlousePiece: true,
    blouseLength: '1.0m matching rich brocade piece',
    sareeLength: '5.5 meters',
    weightGrams: 890,
    customStitchingAvailable: true,
    customStitchingFeeINR: 1800,
    tags: ['Shikargah', 'Banarasi', 'Jangla', 'Handloom', 'Collector Piece'],
    reviews: []
  },
  {
    id: 'mb-lehenga-11',
    title: 'Gul-E-Bahar Pastel Mint Organza Floral Embroidered Lehenga',
    subtitle: 'Soft Tulle Cancan Flare with 3D Resham Florals & Pearl Choli',
    sku: 'MB-LH-3342',
    category: 'Bridal Lehengas',
    fabric: 'Organza Silk',
    occasion: 'Sangeet & Mehendi',
    priceINR: 46000,
    originalPriceINR: 55000,
    discountPercentage: 16,
    rating: 4.8,
    reviewCount: 15,
    images: [
      'https://images.unsplash.com/photo-1609357605129-26f69add5d6e?auto=format&fit=crop&w=1200&q=85',
      'https://images.unsplash.com/photo-1594744803329-e58b31de8bf5?auto=format&fit=crop&w=1200&q=85'
    ],
    colors: [
      {
        colorName: 'Mint Sage Pastel',
        colorHex: '#A3C4BC',
        images: ['https://images.unsplash.com/photo-1609357605129-26f69add5d6e?auto=format&fit=crop&w=1200&q=85']
      }
    ],
    availableSizes: ['XS', 'S', 'M', 'L', 'XL', 'Custom Made-to-Measure'],
    stockCount: 5,
    isReadyToShip: false,
    isBestseller: false,
    isNewArrival: true,
    isHandloomCertified: false,
    description: 'Dreamy, ethereal daytime bridal silhouette in pastel mint organza. Lavishly embroidered with pastel resham floral blooms, micro-sequins, and a scalloped organza dupatta with pearl drops.',
    craftDetails: 'Custom stitched to your exact measurements with customizable neckline, padding, and sleeve lengths.',
    careInstructions: 'Dry clean only.',
    includesBlousePiece: true,
    weightGrams: 1850,
    customStitchingAvailable: true,
    customStitchingFeeINR: 0,
    tags: ['Mehendi Outfit', 'Pastel Lehenga', 'Organza', 'Floral Embroidery'],
    reviews: []
  },
  {
    id: 'mb-chanderi-12',
    title: 'Madhya Heritage Chanderi Silk Zari Buti Saree',
    subtitle: 'Featherlight Chanderi Silk Cotton Blend with Tested Gold Zari Border',
    sku: 'MB-CH-2041',
    category: 'Designer Sarees',
    fabric: 'Chanderi',
    occasion: 'Festive & Puja',
    priceINR: 11500,
    originalPriceINR: 14000,
    discountPercentage: 18,
    rating: 4.7,
    reviewCount: 27,
    images: [
      'https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b?auto=format&fit=crop&w=1200&q=85',
      'https://images.unsplash.com/photo-1610030469983-98e550d6193c?auto=format&fit=crop&w=1200&q=85'
    ],
    colors: [
      {
        colorName: 'Warm Sand & Crimson',
        colorHex: '#E2C9B0',
        images: ['https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b?auto=format&fit=crop&w=1200&q=85']
      }
    ],
    availableSizes: ['Unstitched', 'Custom Made-to-Measure'],
    stockCount: 12,
    isReadyToShip: true,
    isBestseller: true,
    isNewArrival: false,
    isHandloomCertified: true,
    zariType: 'Tested Zari',
    description: 'Renowned for its sheer texture and lightweight elegance. Handwoven in the historic town of Chanderi with fine silk warp and cotton weft, adorned with delicate Ashrafi coin motifs in gold zari.',
    craftDetails: 'Light as air and exceptionally breathable for warm festive afternoons and temple visits.',
    careInstructions: 'Dry clean recommended or hand wash separately in cold water.',
    includesBlousePiece: true,
    blouseLength: '0.8m running fabric',
    sareeLength: '5.5 meters',
    weightGrams: 360,
    customStitchingAvailable: true,
    customStitchingFeeINR: 1400,
    tags: ['Chanderi', 'Handloom', 'Lightweight Saree', 'Summer Festive'],
    reviews: []
  }
];
