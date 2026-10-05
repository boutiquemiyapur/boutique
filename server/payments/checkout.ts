import type { Transaction, Firestore } from 'firebase-admin/firestore';
import type { CartItem, Coupon, Product, CheckoutCharge } from '../../src/types/index.js';
import { legacyChargeAmounts } from '../../src/utils/checkoutTotals.js';
import { productFromDocument, cartCatalogIssue, variantKey } from '../../src/utils/productData.js';
import { requireCondition } from './errors.js';
import { object, paise, type CheckoutRequest } from './validation.js';

export async function trustedCheckout(db: Firestore, tx: Transaction, request: CheckoutRequest, now: number) {
  const ids = [...new Set(request.items.map(l => l.productId))];
  const refs = ids.map(id => db.collection('products').doc(id));
  const snapshots = await tx.getAll(...refs, db.collection('settings').doc('admin'), ...(request.couponCode ? [db.collection('coupons').doc(request.couponCode)] : []));
  const products = snapshots.slice(0, ids.length).map(s => {
    requireCondition(s.exists, 'INVALID_PRODUCT', 409);
    const raw = object(s.data()?.data);
    paise(raw.priceINR); paise(raw.customStitchingFeeINR);
    requireCondition(Number.isInteger(raw.stockCount) && Number(raw.stockCount) >= 0, 'INVALID_INVENTORY', 409);
    if (raw.variantInventory !== undefined && raw.variantInventory !== null) {
      requireCondition(Array.isArray(raw.variantInventory), 'INVALID_INVENTORY', 409);
      const keys = new Set();
      for (const v of raw.variantInventory) { const row = object(v); requireCondition(typeof row.colorName === 'string' && typeof row.size === 'string' && row.key === variantKey(row.colorName, row.size) && !keys.has(row.key) && Number.isSafeInteger(row.stock) && Number(row.stock) >= 0, 'INVALID_INVENTORY', 409); keys.add(row.key); }
      requireCondition(raw.variantInventory.reduce((sum: number, row: any) => sum + row.stock, 0) === raw.stockCount, 'INVALID_INVENTORY', 409);
    }
    const product = productFromDocument(s.id, s.data()!);
    requireCondition(product && product.isActive !== false, 'INACTIVE_PRODUCT', 409); return product;
  });
  const items: CartItem[] = request.items.map((l, i) => {
    const product = products.find(p => p.id === l.productId)!;
    return { ...l, cartItemId: `line-${i}`, product, tailoringFeeINR: l.isCustomTailored ? product.customStitchingFeeINR : 0 };
  });
  requireCondition(!cartCatalogIssue(items, products), 'INVALID_OPTIONS_OR_STOCK', 409);
  const settings = snapshots[ids.length].data()?.data;
  requireCondition(settings && Array.isArray(settings.checkoutCharges) && settings.checkoutCharges.length <= 30, 'INVALID_CHARGE_CONFIGURATION', 409);
  const charges = settings.checkoutCharges as CheckoutCharge[];
  const seen = new Set();
  for (const c of charges) {
    requireCondition(c && typeof c.id === 'string' && !seen.has(c.id) && typeof c.name === 'string' && c.name.trim() && ['fixed', 'percentage'].includes(c.type) && typeof c.enabled === 'boolean' && Number.isFinite(c.sortOrder), 'INVALID_CHARGE_CONFIGURATION', 409);
    seen.add(c.id); paise(c.value); if (c.type === 'percentage') requireCondition(c.value <= 100, 'INVALID_CHARGE_CONFIGURATION', 409);
  }
  let coupon: Coupon | null = null;
  if (request.couponCode) {
    const record = snapshots[ids.length + 1].data(); const c = record?.data as Coupon;
    requireCondition(c && record?.status === 'active' && c.isActive === true && c.code === request.couponCode && ['fixed', 'percentage'].includes(c.discountType), 'INVALID_COUPON', 409);
    requireCondition(typeof c.expiryDate === 'string' && /^\d{4}-\d{2}-\d{2}(?:T.*)?$/.test(c.expiryDate) && Number.isFinite(Date.parse(c.expiryDate)) && new Date(c.expiryDate).toISOString().slice(0, 10) === c.expiryDate.slice(0, 10) && Date.parse(c.expiryDate) > now, 'EXPIRED_OR_INVALID_COUPON', 409);
    paise(c.discountValue); paise(c.minCartValueINR); if (c.maxDiscountINR !== undefined) paise(c.maxDiscountINR);
    requireCondition(c.discountType !== 'percentage' || c.discountValue <= 100, 'INVALID_COUPON', 409); coupon = c;
  }
  // Preserve existing whole-INR discount/charge rounding with integer-paise accumulation.
  const subtotal = items.reduce((sum, l) => sum + paise(l.product.priceINR) * l.quantity, 0);
  const tailoring = items.reduce((sum, l) => sum + paise(l.tailoringFeeINR) * l.quantity, 0);
  let discount = 0;
  if (coupon) {
    requireCondition(subtotal >= paise(coupon.minCartValueINR), 'COUPON_NOT_ELIGIBLE', 409);
    const raw = coupon.discountType === 'percentage' ? subtotal * paise(coupon.discountValue) / 10_000 : paise(coupon.discountValue);
    discount = Math.min(subtotal, Math.round(Math.min(raw, coupon.maxDiscountINR == null ? raw : paise(coupon.maxDiscountINR)) / 100) * 100);
    requireCondition(discount > 0, 'COUPON_NOT_ELIGIBLE', 409);
  }
  const applied = [...charges].sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name)).filter(c => c.enabled).map(c => ({ ...c, amountINR: Math.round(c.type === 'percentage' ? (subtotal - discount) * paise(c.value) / 1_000_000 : paise(c.value) / 100) }));
  const amountPaise = subtotal + tailoring - discount + applied.reduce((sum, c) => sum + c.amountINR * 100, 0);
  requireCondition(Number.isSafeInteger(amountPaise) && amountPaise <= 100_000_000, 'INVALID_PAYABLE_AMOUNT', 409);
  const totals = { subtotalINR: subtotal / 100, tailoringTotalINR: tailoring / 100, couponDiscountINR: discount / 100, charges: applied, totalINR: amountPaise / 100 };
  requireCondition(amountPaise >= 100, 'INVALID_PAYABLE_AMOUNT', 409);
  return { products: products as Product[], items, totals, amountPaise, legacy: legacyChargeAmounts(totals.charges) };
}
