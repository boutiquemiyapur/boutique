/** Product money is INR at the storage boundary, integer paise during calculation.
 * priceINR is authoritative. Legacy discount metadata never changes that price.
 */
export interface PricingFields { priceINR: number; originalPriceINR?: number; discountPercentage?: number; regularPriceINR?: number }
export type PricingMode = 'price' | 'discount';
export const moneyPaise = (value: number): number => Math.round((value + Number.EPSILON) * 100);
const validMoney = (value: number) => Number.isFinite(value) && value > 0 && Number.isSafeInteger(moneyPaise(value)) && moneyPaise(value) <= 100_000_000 && Math.abs(value * 100 - moneyPaise(value)) < 0.000001;

export function productPricing(product: PricingFields) {
  const sellingPaise = moneyPaise(product.priceINR);
  const useMrp = validMoney(product.originalPriceINR ?? 0) && moneyPaise(product.originalPriceINR!) > sellingPaise;
  const referencePriceINR = useMrp ? product.originalPriceINR : product.regularPriceINR;
  const referenceLabel = useMrp ? 'MRP' : 'Regular price';
  const mrpPaise = referencePriceINR == null ? 0 : moneyPaise(referencePriceINR);
  const isDiscounted = validMoney(product.priceINR) && validMoney(referencePriceINR ?? 0) && mrpPaise > sellingPaise;
  const savingsPaise = isDiscounted ? mrpPaise - sellingPaise : 0;
  // Cap rounded percentages below 100: a positive selling price is never free.
  const discountPercentage = isDiscounted ? Math.min(99.99, Math.round(savingsPaise * 10_000 / mrpPaise) / 100) : 0;
  return { sellingPaise, mrpPaise, isDiscounted, discountPercentage, discountAmountINR: savingsPaise / 100, referencePriceINR, referenceLabel };
}

export function pricingValidationError(product: PricingFields): string | null {
  if (!validMoney(product.priceINR)) return 'Selling price must be positive, at most INR 1,000,000 and use at most two decimal places.';
  if (product.originalPriceINR != null && !validMoney(product.originalPriceINR)) return 'MRP must be positive and use at most two decimal places, or be left empty.';
  if (product.originalPriceINR != null && moneyPaise(product.priceINR) > moneyPaise(product.originalPriceINR)) return 'Selling price cannot exceed MRP.';
  if (product.discountPercentage != null && (!Number.isFinite(product.discountPercentage) || product.discountPercentage < 0 || product.discountPercentage >= 100)) return 'Discount must be between 0% and less than 100%.';
  if (product.originalPriceINR == null && product.discountPercentage > 0) return 'Enter MRP before applying a discount.';
  return null;
}

/** Last-edited mode is explicit; MRP edits retain it. Never round-trip a derived % back into price. */
export function editProductPricing<T extends PricingFields>(product: T, field: keyof PricingFields, value: number | undefined, previousMode: PricingMode): { product: T; mode: PricingMode } {
  const mode = field === 'priceINR' ? 'price' : field === 'discountPercentage' ? 'discount' : previousMode;
  const next = { ...product, [field]: value };
  if (field === 'originalPriceINR' && value == null) return { product: { ...next, discountPercentage: 0 }, mode: 'price' };
  if (mode === 'discount') {
    const discount = next.discountPercentage ?? 0;
    if (validMoney(next.originalPriceINR ?? 0) && Number.isFinite(discount) && discount >= 0 && discount < 100) {
      next.priceINR = Math.round(moneyPaise(next.originalPriceINR!) * (10_000 - Math.round(discount * 100)) / 10_000) / 100;
    }
  } else next.discountPercentage = productPricing(next).discountPercentage;
  return { product: next, mode };
}

export const formatProductMoney = (amount: number, locale = 'en-IN') => amount.toLocaleString(locale, { maximumFractionDigits: 2 });
