import { AppView, Product } from '../types';
import { BRAND } from './brand';

export const SEO = {
  origin: BRAND.website,
  siteName: BRAND.title,
  logo: BRAND.logoSrc,
  defaultTitle: "AB Collection by Aadya | Women's Boutique in Miyapur, Hyderabad",
  defaultDescription: "Shop women's clothing at AB Collection by Aadya in Miyapur, Hyderabad. Explore dresses, kurtis, ethnic wear, western wear, tops, frocks, dress materials, night wear and new arrivals.",
} as const;

export const CATEGORY_PATHS: Record<string, string> = {
  'Kanjeevaram Silks': 'kanjeevaram-silks',
  'Banarasi Sarees': 'banarasi-brocades',
  'Designer Sarees': 'designer-sarees',
  'Bridal Lehengas': 'bridal-lehengas',
  'Unstitched Suits': 'chikankari-suits',
  'Temple Jewelry': 'temple-antique-jewelry',
};

export const PUBLIC_STATIC_PATHS = ['/', '/shop', '/about', '/contact'] as const;

const staticMetadata: Partial<Record<AppView, { title: string; description: string; path: string; indexable?: boolean }>> = {
  home: { title: SEO.defaultTitle, description: SEO.defaultDescription, path: '/' },
  shop: { title: "Women's Clothing & Boutique Wear | AB Collection by Aadya", description: "Explore women's boutique clothing from AB Collection by Aadya in Miyapur, including ethnic wear, western wear, dresses and new arrivals.", path: '/shop' },
  about: { title: "About AB Collection by Aadya | Women's Boutique in Miyapur", description: "Learn about AB Collection by Aadya, a women's clothing boutique in Miyapur, Hyderabad, and the story behind its fashion collection.", path: '/about' },
  contact: { title: 'Contact AB Collection by Aadya | Miyapur, Hyderabad', description: 'Contact or visit AB Collection by Aadya at Mathrusri Nagar, Miyapur, Hyderabad for product, sizing and boutique enquiries.', path: '/contact' },
  'tailoring-guide': { title: 'Tailoring Guide | AB Collection by Aadya', description: 'Review sizing and tailoring guidance for styles available from AB Collection by Aadya.', path: '/tailoring', indexable: false },
  'shipping-policy': { title: 'Shipping Policy | AB Collection by Aadya', description: 'Shipping information for AB Collection by Aadya orders.', path: '/shipping', indexable: false },
  'returns-policy': { title: 'Returns & Exchange | AB Collection by Aadya', description: 'Returns and exchange information for AB Collection by Aadya orders.', path: '/returns', indexable: false },
  'cancellation-policy': { title: 'Cancellation Policy | AB Collection by Aadya', description: 'Cancellation information for AB Collection by Aadya orders.', path: '/cancellation', indexable: false },
  'privacy-policy': { title: 'Privacy Policy | AB Collection by Aadya', description: 'Privacy information for customers of AB Collection by Aadya.', path: '/privacy', indexable: false },
  'terms-policy': { title: 'Terms & Conditions | AB Collection by Aadya', description: 'Terms and conditions for the AB Collection by Aadya website.', path: '/terms', indexable: false },
  'cookie-policy': { title: 'Cookie Policy | AB Collection by Aadya', description: 'Cookie and browser-storage information for the AB Collection by Aadya website.', path: '/cookies', indexable: false },
};

const privatePaths: Partial<Record<AppView, string>> = {
  admin: '/admin', login: '/login', register: '/register', 'forgot-password': '/forgot-password',
  account: '/account', cart: '/cart', wishlist: '/wishlist', checkout: '/checkout',
  'order-confirmation': '/order-confirmation', 'order-tracking': '/orders', 'not-found': '/404',
};

export const absoluteUrl = (path: string) => `${SEO.origin}${path === '/' ? '/' : path.replace(/\/$/, '')}`;
export const productPath = (product: Product) => `/product/${encodeURIComponent(product.id)}`;
export const cleanDescription = (value: string, fallback: string) => {
  const text = value.replace(/\s+/g, ' ').trim() || fallback;
  return text.length <= 158 ? text : `${text.slice(0, 155).replace(/\s+\S*$/, '')}…`;
};

export type PageSeo = { title: string; description: string; path: string; indexable: boolean; image: string; type: 'website' | 'product'; product?: Product; category?: string };

export const metadataForView = (view: AppView, product: Product | undefined, category: string, hasSearch: boolean): PageSeo => {
  if (view === 'product-detail') {
    if (!product || product.isActive === false) return { title: `Product Not Found | ${SEO.siteName}`, description: 'The requested product is not available.', path: '/404', indexable: false, image: SEO.logo, type: 'website' };
    return {
      title: `${product.title} | ${SEO.siteName}`,
      description: cleanDescription(product.description, `View ${product.title} from ${SEO.siteName}.`),
      path: productPath(product), indexable: true, image: product.images[0] || SEO.logo, type: 'product', product,
    };
  }
  if (view === 'shop' && category !== 'All' && CATEGORY_PATHS[category]) {
    return {
      title: `${category} for Women | ${SEO.siteName}`,
      description: `Explore ${category.toLowerCase()} from ${SEO.siteName}, a women's boutique in Miyapur, Hyderabad.`,
      path: `/collections/${CATEGORY_PATHS[category]}`, indexable: !hasSearch, image: SEO.logo, type: 'website', category,
    };
  }
  const page = staticMetadata[view];
  if (page) return { ...page, indexable: page.indexable !== false && !(view === 'shop' && hasSearch), image: SEO.logo, type: 'website' };
  const path = privatePaths[view] || '/404';
  return { title: `${view === 'not-found' ? 'Page Not Found' : 'Private Page'} | ${SEO.siteName}`, description: 'This page is not intended for search indexing.', path, indexable: false, image: SEO.logo, type: 'website' };
};
