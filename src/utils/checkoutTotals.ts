import { AppliedCheckoutCharge, CartItem, CheckoutCharge, Coupon } from '../types';

const finiteNonnegative = (value: unknown) => typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : 0;

export const normalizeCheckoutCharges = (value: unknown): CheckoutCharge[] => {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  return value.flatMap((raw, index) => {
    if (!raw || typeof raw !== 'object') return [];
    const candidate = raw as Partial<CheckoutCharge>;
    const id = typeof candidate.id === 'string' && candidate.id.trim() ? candidate.id.trim() : `charge-${index + 1}`;
    const name = typeof candidate.name === 'string' ? candidate.name.trim() : '';
    if (!name || seen.has(id)) return [];
    seen.add(id);
    return [{
      id,
      name,
      type: candidate.type === 'percentage' ? 'percentage' as const : 'fixed' as const,
      value: finiteNonnegative(candidate.value),
      enabled: candidate.enabled === true,
      sortOrder: Number.isFinite(candidate.sortOrder) ? Number(candidate.sortOrder) : index,
    }];
  }).sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
};

export const couponDiscount = (subtotalINR: number, coupon: Coupon | null): number => {
  if (!coupon?.isActive || subtotalINR < coupon.minCartValueINR) return 0;
  const raw = coupon.discountType === 'percentage'
    ? subtotalINR * finiteNonnegative(coupon.discountValue) / 100
    : finiteNonnegative(coupon.discountValue);
  const capped = coupon.maxDiscountINR == null ? raw : Math.min(raw, finiteNonnegative(coupon.maxDiscountINR));
  return Math.min(subtotalINR, Math.round(capped));
};

export interface CheckoutTotals {
  subtotalINR: number;
  tailoringTotalINR: number;
  couponDiscountINR: number;
  percentageChargeBaseINR: number;
  charges: AppliedCheckoutCharge[];
  chargeTotalINR: number;
  totalINR: number;
}

/** Percentage charges use merchandise subtotal after coupon discount. Tailoring and other charges are excluded. */
export const calculateCheckoutTotals = (items: CartItem[], coupon: Coupon | null, configuredCharges: CheckoutCharge[]): CheckoutTotals => {
  const subtotalINR = items.reduce((sum, item) => sum + finiteNonnegative(item.product.priceINR) * Math.max(0, Math.floor(item.quantity)), 0);
  const tailoringTotalINR = items.reduce((sum, item) => sum + (item.isCustomTailored ? finiteNonnegative(item.tailoringFeeINR) * Math.max(0, Math.floor(item.quantity)) : 0), 0);
  const couponDiscountINR = couponDiscount(subtotalINR, coupon);
  const percentageChargeBaseINR = Math.max(0, subtotalINR - couponDiscountINR);
  const charges = normalizeCheckoutCharges(configuredCharges).filter((charge) => charge.enabled).map((charge) => ({
    ...charge,
    amountINR: Math.round(charge.type === 'percentage' ? percentageChargeBaseINR * charge.value / 100 : charge.value),
  }));
  const chargeTotalINR = charges.reduce((sum, charge) => sum + charge.amountINR, 0);
  return {
    subtotalINR,
    tailoringTotalINR,
    couponDiscountINR,
    percentageChargeBaseINR,
    charges,
    chargeTotalINR,
    totalINR: Math.max(0, subtotalINR + tailoringTotalINR - couponDiscountINR + chargeTotalINR),
  };
};

export const legacyChargeAmounts = (charges: AppliedCheckoutCharge[]) => {
  const matches = (charge: AppliedCheckoutCharge, words: string[]) => words.some((word) => charge.id.toLowerCase().includes(word) || charge.name.toLowerCase().includes(word));
  return {
    shippingCostINR: charges.filter((charge) => matches(charge, ['shipping', 'delivery'])).reduce((sum, charge) => sum + charge.amountINR, 0),
    taxGstINR: charges.filter((charge) => matches(charge, ['tax', 'gst'])).reduce((sum, charge) => sum + charge.amountINR, 0),
  };
};
