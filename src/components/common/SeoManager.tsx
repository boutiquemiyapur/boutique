import { useEffect } from 'react';
import { absoluteUrl, CATEGORY_PATHS, metadataForView, SEO } from '../../config/seo';
import { useStore } from '../../context/StoreContext';

const setMeta = (key: string, value: string, property = false) => {
  const attribute = property ? 'property' : 'name';
  let node = document.head.querySelector<HTMLMetaElement>(`meta[${attribute}="${key}"]`);
  if (!node) { node = document.createElement('meta'); node.setAttribute(attribute, key); document.head.appendChild(node); }
  node.content = value;
};

const setCanonical = (url: string) => {
  let node = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!node) { node = document.createElement('link'); node.rel = 'canonical'; document.head.appendChild(node); }
  node.href = url;
};

const setStructuredData = (value: unknown[]) => {
  const id = 'ab-collection-structured-data';
  let node = document.getElementById(id) as HTMLScriptElement | null;
  if (!node) { node = document.createElement('script'); node.id = id; node.type = 'application/ld+json'; document.head.appendChild(node); }
  node.text = JSON.stringify({ '@context': 'https://schema.org', '@graph': value });
};

export const SeoManager = () => {
  const { activeView, selectedProductId, products, categories, filters, cms } = useStore();
  const product = activeView === 'product-detail' ? products.find((item) => item.id === selectedProductId && item.isActive !== false) : undefined;
  const configuredCategory = categories.find((category) => category.isActive && category.name === filters.category);
  const page = metadataForView(activeView, product, filters.category, Boolean(filters.searchQuery.trim()), configuredCategory?.slug);

  useEffect(() => {
    const canonical = absoluteUrl(page.path);
    document.title = page.title;
    setCanonical(canonical);
    setMeta('description', page.description);
    setMeta('robots', page.indexable ? 'index, follow, max-image-preview:large' : 'noindex, nofollow');
    setMeta('googlebot', page.indexable ? 'index, follow, max-image-preview:large' : 'noindex, nofollow');
    setMeta('og:title', page.title, true); setMeta('og:description', page.description, true);
    setMeta('og:url', canonical, true); setMeta('og:type', page.type, true);
    setMeta('og:image', page.image, true); setMeta('og:site_name', SEO.siteName, true);
    setMeta('twitter:card', 'summary_large_image'); setMeta('twitter:title', page.title);
    setMeta('twitter:description', page.description); setMeta('twitter:image', page.image);

    const graph: unknown[] = [];
    if (activeView === 'home') graph.push({
      '@type': 'ClothingStore', '@id': `${SEO.origin}/#store`, name: SEO.siteName, url: absoluteUrl('/'), image: SEO.logo, logo: SEO.logo,
      ...(cms.contact.phone ? { telephone: cms.contact.phone } : {}), ...(cms.contact.email ? { email: cms.contact.email } : {}),
      ...(cms.contact.addressLines.length ? { address: { '@type': 'PostalAddress', streetAddress: cms.contact.addressLines.join(', ') } } : {}),
      hasMap: cms.contact.mapsUrl,
    });
    if (page.product) {
      graph.push({
        '@type': 'Product', '@id': `${canonical}#product`, name: page.product.title,
        image: page.product.images.filter(Boolean), description: page.description,
        ...(page.product.sku ? { sku: page.product.sku } : {}),
        brand: { '@type': 'Brand', name: SEO.siteName },
        offers: { '@type': 'Offer', url: canonical, priceCurrency: 'INR', price: page.product.priceINR, availability: page.product.stockCount > 0 ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock' },
      });
      graph.push({ '@type': 'BreadcrumbList', itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: absoluteUrl('/') },
        { '@type': 'ListItem', position: 2, name: 'Shop', item: absoluteUrl('/shop') },
        { '@type': 'ListItem', position: 3, name: page.product.category, item: absoluteUrl((categories.find((category) => category.isActive && category.name === page.product!.category)?.slug || CATEGORY_PATHS[page.product.category]) ? `/collections/${categories.find((category) => category.isActive && category.name === page.product!.category)?.slug || CATEGORY_PATHS[page.product.category]}` : '/shop') },
        { '@type': 'ListItem', position: 4, name: page.product.title, item: canonical },
      ] });
    }
    setStructuredData(graph);
  }, [cms.contact, categories, activeView, page.description, page.image, page.indexable, page.path, page.product, page.title, page.type]);

  return activeView === 'home' ? <h1 className="sr-only">AB Collection by Aadya women&apos;s boutique in Miyapur, Hyderabad</h1> : null;
};
