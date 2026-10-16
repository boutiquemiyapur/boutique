import { CartItem, Product, ProductVariant, VariantInventoryItem } from '../types';
import { productPricing, pricingValidationError } from './productPricing.js';

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

/** Legacy single/newline URLs and upload objects are read without a database migration. */
export const normalizeImageUrls = (value: unknown): string[] => {
  const values = Array.isArray(value) ? value : [value];
  const urls = values.flatMap(item => typeof item === 'string' ? item.split(/\r?\n/) : item && typeof item === 'object'
    ? [item.secure_url || item.url || item.src] : []);
  const seen = new Set<string>();
  return urls.map(text).filter(url => {
    if (!url || seen.has(url)) return false;
    let valid = false;
    try {
      if (/^https?:\/\//i.test(url)) { const parsed = new URL(url); valid = Boolean(parsed.hostname) && !parsed.username && !parsed.password; }
      else valid = !url.startsWith('//') && !/[\\:\s]/.test(url) && (/^\/(?!\/)/.test(url) || /\.(?:jpe?g|png|webp|avif|gif|svg)(?:[?#].*)?$/i.test(url));
    } catch { return false; }
    if (!valid) return false;
    seen.add(url); return true; // URL paths are case-sensitive; do not lowercase them.
  });
};

const normalizeVariantPart = (value: unknown) => text(value).toLocaleLowerCase('en-IN');
export const variantKey = (colorName = '', size = '') => `${normalizeVariantPart(colorName)}::${normalizeVariantPart(size)}`;

export const variantCombinations = (product: Pick<Product, 'colors' | 'availableSizes'>): Array<Pick<VariantInventoryItem, 'key' | 'colorName' | 'size'>> => {
  const colors = product.colors.length ? product.colors.map((color) => color.colorName) : [''];
  const sizes = product.availableSizes.length ? product.availableSizes : [''];
  if (!product.colors.length && !product.availableSizes.length) return [];
  return colors.flatMap((colorName) => sizes.map((size) => ({ key: variantKey(colorName, size), colorName, size })));
};

export const normalizeVariantInventory = (value: unknown): VariantInventoryItem[] | undefined => {
  if (!Array.isArray(value)) return undefined;
  const rows = new Map<string, VariantInventoryItem>();
  for (const raw of value) {
    if (!raw || typeof raw !== 'object') continue;
    const item = raw as Partial<VariantInventoryItem>;
    const colorName = text(item.colorName);
    const size = text(item.size);
    const key = variantKey(colorName, size);
    rows.set(key, { key, colorName, size, stock: Math.floor(nonnegative(item.stock)) });
  }
  return [...rows.values()];
};

export const hasVariantInventory = (product: Pick<Product, 'variantInventory'>): boolean => Array.isArray(product.variantInventory);

export const syncVariantInventory = (product: Pick<Product, 'colors' | 'availableSizes' | 'variantInventory'>): VariantInventoryItem[] => {
  const existing = new Map((product.variantInventory || []).map((item) => [variantKey(item.colorName, item.size), item]));
  return variantCombinations(product).map((combination) => ({
    ...combination,
    stock: Math.floor(nonnegative(existing.get(combination.key)?.stock)),
  }));
};

export const totalProductStock = (product: Pick<Product, 'stockCount' | 'variantInventory'>): number => hasVariantInventory(product)
  ? (product.variantInventory || []).reduce((sum, item) => sum + Math.floor(nonnegative(item.stock)), 0)
  : Math.floor(nonnegative(product.stockCount));

export const selectedVariantStock = (
  product: Pick<Product, 'stockCount' | 'variantInventory'>,
  colorName = '',
  size = ''
): number => {
  if (!hasVariantInventory(product)) return Math.floor(nonnegative(product.stockCount));
  return product.variantInventory?.find((item) => item.key === variantKey(colorName, size))?.stock || 0;
};

export const isVariantAvailable = (product: Pick<Product, 'stockCount' | 'variantInventory'>, colorName = '', size = '', quantity = 1) =>
  selectedVariantStock(product, colorName, size) >= quantity;

export const withDeductedStock = (product: Product, requested: Array<{ colorName: string; size: string; quantity: number }>): Product => {
  if (!hasVariantInventory(product)) {
    const quantity = requested.reduce((sum, item) => sum + item.quantity, 0);
    return { ...product, stockCount: Math.max(0, product.stockCount - quantity) };
  }
  const deductions = new Map<string, number>();
  requested.forEach((item) => deductions.set(variantKey(item.colorName, item.size), (deductions.get(variantKey(item.colorName, item.size)) || 0) + item.quantity));
  const variantInventory = (product.variantInventory || []).map((item) => ({ ...item, stock: Math.max(0, item.stock - (deductions.get(item.key) || 0)) }));
  return { ...product, variantInventory, stockCount: variantInventory.reduce((sum, item) => sum + item.stock, 0) };
};

/** Empty optional fields stay empty. No category, material or variant is inferred. */
export const normalizeProduct = (raw: Partial<Product>, id = raw.id || ''): Product => {
  const colors: ProductVariant[] = [];
  for (const value of Array.isArray(raw.colors) ? raw.colors : []) {
    const color: Partial<ProductVariant> = typeof value === 'string' ? { colorName: value } : value;
    const colorName = text(color?.colorName);
    if (!colorName) continue;
    const existing = colors.find(item => item.colorName.toLowerCase() === colorName.toLowerCase());
    if (existing) { existing.images = normalizeImageUrls([...existing.images, ...normalizeImageUrls(color.images)]); continue; }
    colors.push({ ...color, colorName, colorHex: text(color.colorHex), images: normalizeImageUrls(color.images) });
  }
  const rawInventory = normalizeVariantInventory(raw.variantInventory);
  const allowedInventoryKeys = new Set(variantCombinations({ colors, availableSizes: uniqueValues(raw.availableSizes) }).map((item) => item.key));
  const variantInventory = rawInventory?.filter((item) => allowedInventoryKeys.has(item.key));
  const normalized = {
    ...raw, id,
    discountPercentage: productPricing({ ...raw, priceINR: raw.priceINR ?? 0 }).discountPercentage,
    title: text(raw.title), sku: text(raw.sku), category: text(raw.category),
    subtitle: text(raw.subtitle), fabric: text(raw.fabric), occasion: text(raw.occasion),
    description: text(raw.description), craftDetails: text(raw.craftDetails), careInstructions: text(raw.careInstructions),
    zariType: text(raw.zariType), blouseLength: text(raw.blouseLength), sareeLength: text(raw.sareeLength),
    weightGrams: typeof raw.weightGrams === 'number' && Number.isFinite(raw.weightGrams) && raw.weightGrams >= 0 ? raw.weightGrams : undefined,
    priceINR: nonnegative(raw.priceINR), stockCount: Math.floor(nonnegative(raw.stockCount)),
    rating: nonnegative(raw.rating), reviewCount: Math.floor(nonnegative(raw.reviewCount)),
    images: normalizeImageUrls(raw.images), colors, availableSizes: uniqueValues(raw.availableSizes), tags: uniqueValues(raw.tags),
    isReadyToShip: raw.isReadyToShip === true,
    customStitchingAvailable: raw.customStitchingAvailable === true,
    customStitchingFeeINR: nonnegative(raw.customStitchingFeeINR),
    specifications: (Array.isArray(raw.specifications) ? raw.specifications : [])
      .map((row) => ({ label: text(row?.label), value: text(row?.value) }))
      .filter((row) => row.label && row.value),
    variantInventory,
  } as Product;
  return { ...normalized, stockCount: totalProductStock(normalized) };
};

export const productFromDocument = (id: string, document: Record<string, unknown>): Product | null => {
  const raw = document.data as Partial<Product> | undefined;
  if (!raw || document.status === 'archived') return null;
  return normalizeProduct({ ...raw, isActive: document.status !== 'inactive' && raw.isActive !== false }, id);
};

/** Null clears optional values under Firestore merge writes; undefined is rejected by Firestore. */
export const productForStorage = (product: Product): Product => {
  if (product.regularPriceINR !== undefined || product.saleCampaign !== undefined || product.saleCampaignIds !== undefined) throw new Error('Save regular catalog products only; campaign prices belong in campaign records.');
  const error = pricingValidationError(product);
  if (error) throw new Error(error);
  return JSON.parse(JSON.stringify(normalizeProduct(product), (_key, value) => value === undefined ? null : value));
};

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
  const pricingError = pricingValidationError(product);
  if (pricingError) return pricingError;
  if (!Number.isInteger(product.stockCount) || product.stockCount < 0) return 'Enter valid whole-number stock.';
  for (const value of [product.weightGrams, product.customStitchingFeeINR]) {
    if (value != null && (!Number.isFinite(value) || value < 0)) return 'Weight and fees must be non-negative numbers.';
  }
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
  const variant = (product.colors || []).find((item) => normalizeVariantPart(item.colorName) === normalizeVariantPart(color));
  const general = normalizeImageUrls(product.images);
  const selected = normalizeImageUrls(variant?.images);
  if (selected.length) return normalizeImageUrls([...selected, ...general]);
  // A chosen shade with no media must not display a different shade as its image.
  return general.length || text(color) ? general : normalizeImageUrls(product.colors?.[0]?.images);
};
export const stockMessage = (product: Product, threshold: number) => product.stockCount <= 0
  ? 'Out of stock' : product.stockCount <= threshold
    ? `Only ${product.stockCount} ${product.stockCount === 1 ? 'item' : 'items'} remaining`
    : 'In stock';

export const variantSummary = (item: Pick<CartItem, 'selectedColor' | 'selectedSize'>) => [
  item.selectedColor && `Color: ${item.selectedColor}`, item.selectedSize && `Size: ${item.selectedSize}`,
].filter(Boolean).join(' · ');

export const cartCatalogIssue = (items: CartItem[], products: Product[]): string | null => {
  const quantities = new Map<string, number>();
  for (const item of items) {
    const key = `${item.product.id}::${variantKey(item.selectedColor, item.selectedSize)}`;
    quantities.set(key, (quantities.get(key) || 0) + item.quantity);
  }
  for (const item of items) {
    const product = products.find((candidate) => candidate.id === item.product.id && candidate.isActive !== false);
    if (!product) return `${item.product.title} is no longer available. Remove it from your cart.`;
    if (!Number.isInteger(item.quantity) || item.quantity < 1) return 'Choose a valid quantity for every item in your cart.';
    if ((product.colors.length ? !product.colors.some((color) => color.colorName === item.selectedColor) : Boolean(item.selectedColor)) ||
        (product.availableSizes.length ? !product.availableSizes.includes(item.selectedSize) : Boolean(item.selectedSize))) {
      return `Options for ${product.title} have changed. Remove it and select the available options again.`;
    }
    if (item.isCustomTailored && !product.customStitchingAvailable) return `Tailoring for ${product.title} is no longer available. Please select this product again.`;
    const requestedKey = `${product.id}::${variantKey(item.selectedColor, item.selectedSize)}`;
    const quantity = hasVariantInventory(product)
      ? quantities.get(requestedKey) || 0
      : items.filter((line) => line.product.id === product.id).reduce((sum, line) => sum + line.quantity, 0);
    const available = selectedVariantStock(product, item.selectedColor, item.selectedSize);
    if (quantity > available) {
      const option = variantSummary(item);
      return `${product.title}${option ? ` (${option})` : ''}: ${available > 0 ? `only ${available} available` : 'out of stock'}. Please update your cart.`;
    }
  }
  return null;
};

/** Refresh mutable cart data only. Historical order snapshots must never be repriced. */
export const refreshCartProducts = (items: CartItem[], products: Product[]) => items.map((item) => {
  const current = products.find((product) => product.id === item.product.id);
  return current ? { ...item, product: current, tailoringFeeINR: item.isCustomTailored ? current.customStitchingFeeINR : 0 } : item;
});

/** Price/stock refreshes must not reset a customer's gallery or valid selections. */
export const productSelectionKey = (product?: Product) => JSON.stringify([product?.id, product?.images, product?.colors, product?.availableSizes, product?.customStitchingAvailable]);
