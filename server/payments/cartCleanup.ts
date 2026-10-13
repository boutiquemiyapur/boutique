import type { CartItem } from '../../src/types/index.js';

export type PurchasedLine = { cartItemId: string; productId: string; color: string; size: string; tailored: boolean; quantity: number; cartQuantity: number };
const key = (productId: string, color: string, size: string, tailored: boolean) => JSON.stringify([productId, color.trim().toLowerCase(), size.trim().toLowerCase(), tailored]);
const valid = (l: any) => l && typeof l.cartItemId === 'string' && l.cartItemId.length > 0 && l.cartItemId.length <= 160
  && typeof l.product?.id === 'string' && typeof l.selectedColor === 'string' && typeof l.selectedSize === 'string'
  && typeof l.isCustomTailored === 'boolean' && Number.isSafeInteger(l.quantity) && l.quantity > 0;
export function purchasedSnapshot(raw: unknown, items: CartItem[]): PurchasedLine[] {
  if (!Array.isArray(raw) || raw.length > 300) return [];
  const lines: PurchasedLine[] = [];
  for (const item of items) {
    const identity = key(item.product.id, item.selectedColor, item.selectedSize, item.isCustomTailored);
    const matches = raw.filter(l => valid(l) && key(l.product.id, l.selectedColor, l.selectedSize, l.isCustomTailored) === identity);
    if (matches.length !== 1 || raw.filter(l => l?.cartItemId === matches[0].cartItemId).length !== 1) continue;
    const l = matches[0];
    lines.push({ cartItemId: l.cartItemId, productId: item.product.id, color: item.selectedColor, size: item.selectedSize, tailored: item.isCustomTailored, quantity: item.quantity, cartQuantity: l.quantity });
  }
  return lines;
}
export function subtractPurchased(raw: unknown, purchased: PurchasedLine[]): unknown[] | null {
  if (!Array.isArray(raw) || raw.length > 300) return null;
  return raw.flatMap(l => {
    if (!valid(l) || raw.filter(other => other?.cartItemId === l.cartItemId).length !== 1) return [l];
    const p = purchased.find(p => Number.isSafeInteger(p.quantity) && p.quantity > 0 && Number.isSafeInteger(p.cartQuantity) && p.cartQuantity > 0 && p.cartItemId === l.cartItemId && key(p.productId, p.color, p.size, p.tailored) === key(l.product.id, l.selectedColor, l.selectedSize, l.isCustomTailored));
    if (!p) return [l];
    const quantity = Math.max(0, l.quantity - Math.min(p.quantity, p.cartQuantity));
    return quantity ? [{ ...l, quantity }] : [];
  });
}
