import { CartItem, Product, ProductVariant } from '../types';

const text = (value: unknown): string => typeof value === 'string' ? value.trim() : '';
export const uniqueValues = (value: unknown): string[] => {
  const seen = new Set<string>();
  return (Array.isArray(value) ? value : []).map(text).filter((item) => {
    if (!item || seen.has(item.toLowerCase())) return false;
    seen.add(item.toLowerCase());
    return true;
  });
};
const nonnegative = (value: unknown) => typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : 0;

/** Empty optional fields stay empty. No category, material or variant is inferred. */
export const normalizeProduct = (raw: Partial<Product>, id = raw.id || ''): Product => {
  const colors: ProductVariant[] = [];
  for (const value of Array.isArray(raw.colors) ? raw.colors : []) {
    const color: Partial<ProductVariant> = typeof value === 'string' ? { colorName: value } : value;
    const colorName = text(color?.colorName);
    if (!colorName || colors.some((item) => item.colorName.toLowerCase() === colorName.toLowerCase())) continue;
    colors.push({ ...color, colorName, colorHex: text(color.colorHex), images: uniqueValues(color.images) });
  }
  return {
    ...raw, id,
    title: text(raw.title), sku: text(raw.sku), category: text(raw.category),
    subtitle: text(raw.subtitle), fabric: text(raw.fabric), occasion: text(raw.occasion),
    description: text(raw.description), craftDetails: text(raw.craftDetails), careInstructions: text(raw.careInstructions),
    zariType: text(raw.zariType), blouseLength: text(raw.blouseLength), sareeLength: text(raw.sareeLength),
    weightGrams: typeof raw.weightGrams === 'number' && Number.isFinite(raw.weightGrams) && raw.weightGrams >= 0 ? raw.weightGrams : undefined,
    priceINR: nonnegative(raw.priceINR), stockCount: Math.floor(nonnegative(raw.stockCount)),
    rating: nonnegative(raw.rating), reviewCount: Math.floor(nonnegative(raw.reviewCount)),
    images: uniqueValues(raw.images), colors, availableSizes: uniqueValues(raw.availableSizes), tags: uniqueValues(raw.tags),
    isReadyToShip: raw.isReadyToShip === true,
    customStitchingAvailable: raw.customStitchingAvailable === true,
    customStitchingFeeINR: nonnegative(raw.customStitchingFeeINR),
    specifications: (Array.isArray(raw.specifications) ? raw.specifications : [])
      .map((row) => ({ label: text(row?.label), value: text(row?.value) }))
      .filter((row) => row.label && row.value),
  };
};

export const productFromDocument = (id: string, document: Record<string, unknown>): Product | null => {
  const raw = document.data as Partial<Product> | undefined;
  if (!raw || document.status === 'archived') return null;
  return normalizeProduct({ ...raw, isActive: document.status !== 'inactive' && raw.isActive !== false }, id);
};

/** Null clears optional values under Firestore merge writes; undefined is rejected by Firestore. */
export const productForStorage = (product: Product): Product => JSON.parse(JSON.stringify(normalizeProduct(product), (_key, value) => value === undefined ? null : value));

export const productSpecifications = (product: Product) => {
  const rows = [
    { label: 'Material', value: product.fabric },
    { label: 'Care Instructions', value: product.careInstructions },
    { label: 'Zari Specification', value: product.zariType },
    { label: 'Weight', value: product.weightGrams != null ? `${product.weightGrams} grams` : '' },
    { label: 'Blouse Piece', value: product.includesBlousePiece === true ? 'Included' : '' },
    { label: 'Blouse Length', value: product.blouseLength },
    { label: 'Saree Length', value: product.sareeLength },
    ...(product.specifications || []),
  ];
  const seen = new Set<string>();
  return rows.filter((row): row is { label: string; value: string } => {
    if (!row.value?.trim() || seen.has(row.label.toLowerCase())) return false;
    seen.add(row.label.toLowerCase());
    return true;
  });
};

export const productValidationError = (product: Product): string | null => {
  if (!product.title.trim() || !product.sku.trim() || !product.category.trim()) return 'Enter a product name, SKU and category.';
  if (!Number.isFinite(product.priceINR) || product.priceINR < 0 || !Number.isInteger(product.stockCount) || product.stockCount < 0) return 'Enter a valid price and whole-number stock.';
  for (const value of [product.originalPriceINR, product.discountPercentage, product.weightGrams, product.customStitchingFeeINR]) {
    if (value != null && (!Number.isFinite(value) || value < 0)) return 'Prices, discount, weight and fees must be non-negative numbers.';
  }
  if (product.discountPercentage != null && product.discountPercentage > 100) return 'Discount cannot exceed 100%.';
  const reserved = new Set(['material', 'fabric', 'fabric composition', 'care instructions', 'zari specification', 'weight', 'blouse piece', 'blouse length', 'saree length']);
  const seen = new Set<string>();
  for (const row of product.specifications || []) {
    const label = row.label.trim().toLowerCase();
    if (!label && !row.value.trim()) continue;
    if (!label || !row.value.trim()) return 'Enter both a label and value for each specification.';
    if (reserved.has(label)) return `Use the dedicated field for ${row.label.trim()} instead of an additional specification.`;
    if (seen.has(label)) return 'Each additional specification needs a unique label.';
    seen.add(label);
  }
  return null;
};

export const productImages = (product: Product, color = '') => {
  const variant = (product.colors || []).find((item) => item.colorName === color);
  return variant?.images?.length ? variant.images : product.images || [];
};
export const stockMessage = (product: Product, threshold: number) => product.stockCount <= 0
  ? 'Out of stock' : product.stockCount <= threshold
    ? `Only ${product.stockCount} ${product.stockCount === 1 ? 'item' : 'items'} remaining`
    : 'In stock';

export const variantSummary = (item: Pick<CartItem, 'selectedColor' | 'selectedSize'>) => [
  item.selectedColor && `Color: ${item.selectedColor}`, item.selectedSize && `Size: ${item.selectedSize}`,
].filter(Boolean).join(' · ');

export const cartCatalogIssue = (items: CartItem[], products: Product[]): string | null => {
  for (const item of items) {
    const product = products.find((candidate) => candidate.id === item.product.id && candidate.isActive !== false);
    if (!product) return `${item.product.title} is no longer available. Remove it from your bag.`;
    if (!Number.isInteger(item.quantity) || item.quantity < 1) return 'Please check the quantity in your bag.';
    if ((product.colors.length ? !product.colors.some((color) => color.colorName === item.selectedColor) : Boolean(item.selectedColor)) ||
        (product.availableSizes.length ? !product.availableSizes.includes(item.selectedSize) : Boolean(item.selectedSize))) {
      return `Options for ${product.title} have changed. Remove it and select the available options again.`;
    }
    if (item.isCustomTailored && !product.customStitchingAvailable) return `Tailoring for ${product.title} is no longer available. Please select this product again.`;
    const quantity = items.filter((line) => line.product.id === product.id).reduce((sum, line) => sum + line.quantity, 0);
    if (quantity > product.stockCount) return `${product.title}: ${product.stockCount > 0 ? `only ${product.stockCount} available across all sizes and colors` : 'out of stock'}. Please update your bag.`;
  }
  return null;
};

/** Refresh mutable cart data only. Historical order snapshots must never be repriced. */
export const refreshCartProducts = (items: CartItem[], products: Product[]) => items.map((item) => {
  const current = products.find((product) => product.id === item.product.id);
  return current ? { ...item, product: current, tailoringFeeINR: item.isCustomTailored ? current.customStitchingFeeINR : 0 } : item;
});
