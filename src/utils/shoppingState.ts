import { cartCatalogIssue } from './productData.js';
import type { CartItem, Product } from '../types/index.js';

export const MAX_CART_QUANTITY = 25;
export const cartLineKey = (item: Pick<CartItem, 'product' | 'selectedColor' | 'selectedSize' | 'isCustomTailored'>) => JSON.stringify([
  item.product.id || item.product.sku,
  (typeof item.selectedColor === 'string' ? item.selectedColor : '').trim().toLowerCase(),
  (typeof item.selectedSize === 'string' ? item.selectedSize : '').trim().toLowerCase(),
  item.isCustomTailored ? 'tailored' : 'ready'
]);

export const displayableWishlist = (ids: string[], products: Product[]) => {
  const saved = new Set(ids);
  return products.filter(product => product.isActive !== false && saved.has(product.id));
};

/** Customer Cart limits; shared server checkout validation remains unchanged. */
export const cartPurchaseIssue = (items: CartItem[], products: Product[]): string | null => {
  if (items.length > 30) return 'The cart supports up to 30 product variants per checkout.';
  if (items.some(item => !Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > MAX_CART_QUANTITY)) {
    return `Choose between 1 and ${MAX_CART_QUANTITY} per cart line.`;
  }
  return cartCatalogIssue(items, products);
};

export const addCartSelections = async (items: CartItem[], add: (item: CartItem) => Promise<boolean>, active: () => boolean): Promise<number> => {
  let added = 0;
  for (const item of items) {
    if (!active()) break;
    if (await add(item)) added++;
  }
  return added;
};
