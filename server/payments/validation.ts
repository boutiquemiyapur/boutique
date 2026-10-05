import { createHash } from 'node:crypto';
import type { CustomMeasurements, ShippingAddress } from '../../src/types/index.js';
import { requireCondition } from './errors.js';

export type CheckoutLine = { productId: string; selectedColor: string; selectedSize: string; quantity: number; isCustomTailored: boolean; customMeasurements?: CustomMeasurements; giftPackaging: boolean; giftNote?: string };
export type CheckoutRequest = { intentId: string; items: CheckoutLine[]; shippingAddress: ShippingAddress; couponCode: string | null };
export const object = (v: unknown): Record<string, unknown> => {
  requireCondition(v && typeof v === 'object' && !Array.isArray(v), 'INVALID_REQUEST'); return v as Record<string, unknown>;
};
export const only = (v: Record<string, unknown>, keys: string[]) => requireCondition(Object.keys(v).every(k => keys.includes(k)), 'UNEXPECTED_FIELD');
export const text = (v: unknown, max: number, optional = false): string => {
  if (optional && v === undefined) return '';
  requireCondition(typeof v === 'string' && v.trim().length <= max && (optional || v.trim().length > 0) && !/[\u0000-\u001f]/.test(v), 'INVALID_TEXT'); return v.trim();
};
export const identifier = (v: unknown) => {
  const s = text(v, 100); requireCondition(/^[a-zA-Z0-9_-]+$/.test(s), 'INVALID_ID'); return s;
};
export const intentIdentifier = (v: unknown) => {
  const s = identifier(v); requireCondition(/^[a-zA-Z0-9_-]{16,80}$/.test(s), 'INVALID_INTENT'); return s;
};
const boolean = (v: unknown) => { requireCondition(v === undefined || typeof v === 'boolean', 'INVALID_BOOLEAN'); return v === true; };
export function parseCheckout(value: unknown): CheckoutRequest {
  const b = object(value); only(b, ['intentId', 'items', 'shippingAddress', 'couponCode']);
  requireCondition(Array.isArray(b.items) && b.items.length > 0 && b.items.length <= 30, 'INVALID_ITEMS');
  const items = b.items.map(raw => {
    const l = object(raw); only(l, ['productId', 'selectedColor', 'selectedSize', 'quantity', 'isCustomTailored', 'customMeasurements', 'giftPackaging', 'giftNote']);
    requireCondition(Number.isInteger(l.quantity) && Number(l.quantity) >= 1 && Number(l.quantity) <= 25, 'INVALID_QUANTITY');
    const isCustomTailored = boolean(l.isCustomTailored);
    let customMeasurements: CustomMeasurements | undefined;
    if (isCustomTailored) {
      const m = object(l.customMeasurements);
      const numeric = ['bust', 'waist', 'hips', 'shoulder', 'armHole', 'sleeveLength', 'frontNeckDepth', 'backNeckDepth', 'blouseLength', 'lehengaLength'];
      only(m, [...numeric, 'specialNotes', 'blouseStyle', 'liningPreference', 'paddingOption']);
      for (const k of numeric) requireCondition((k === 'lehengaLength' && m[k] === undefined) || (typeof m[k] === 'number' && Number.isFinite(m[k]) && Number(m[k]) >= 0 && Number(m[k]) <= 150), 'INVALID_MEASUREMENTS');
      const result: Record<string, unknown> = {};
      for (const k of numeric) if (m[k] !== undefined) result[k] = m[k];
      for (const k of ['specialNotes', 'blouseStyle', 'liningPreference', 'paddingOption']) if (m[k] !== undefined) result[k] = text(m[k], k === 'specialNotes' ? 500 : 80, true);
      const options: Record<string, string[]> = { blouseStyle: ['Classic Round', 'Deep V-Neck', 'Boat Neck', 'Sweetheart', 'High Collar Backless', 'Princess Cut'], liningPreference: ['Pure Cotton', 'Butter Silk', 'Satin'], paddingOption: ['With Bra Pads', 'Without Pads'] };
      for (const [k, allowed] of Object.entries(options)) requireCondition(m[k] === undefined || allowed.includes(String(m[k])), 'INVALID_MEASUREMENTS');
      customMeasurements = result as unknown as CustomMeasurements;
    } else requireCondition(l.customMeasurements === undefined, 'UNEXPECTED_MEASUREMENTS');
    return { productId: identifier(l.productId), selectedColor: text(l.selectedColor, 80, true), selectedSize: text(l.selectedSize, 40, true), quantity: Number(l.quantity), isCustomTailored, ...(customMeasurements ? { customMeasurements } : {}), giftPackaging: boolean(l.giftPackaging), ...(l.giftNote ? { giftNote: text(l.giftNote, 500, true) } : {}) };
  }).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
  const a = object(b.shippingAddress); only(a, ['id', 'isDefault', 'fullName', 'phone', 'email', 'addressLine1', 'addressLine2', 'city', 'state', 'pincode', 'country']);
  const shippingAddress: ShippingAddress = { fullName: text(a.fullName, 100), phone: text(a.phone, 30), email: text(a.email, 160).toLowerCase(), addressLine1: text(a.addressLine1, 200), addressLine2: text(a.addressLine2, 200, true), city: text(a.city, 80), state: text(a.state, 80), pincode: text(a.pincode, 6), country: text(a.country, 40) };
  requireCondition(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(shippingAddress.email) && /^\+?[0-9 ()-]{8,30}$/.test(shippingAddress.phone) && /^[1-9][0-9]{5}$/.test(shippingAddress.pincode) && shippingAddress.country.toLowerCase() === 'india', 'INVALID_ADDRESS');
  requireCondition(shippingAddress.phone.replace(/\D/g, '').length >= 10 && shippingAddress.phone.replace(/\D/g, '').length <= 15, 'INVALID_ADDRESS');
  const couponCode = b.couponCode == null || b.couponCode === '' ? null : text(b.couponCode, 40).toUpperCase();
  requireCondition(!couponCode || /^[A-Z0-9_-]+$/.test(couponCode), 'INVALID_COUPON');
  return { intentId: intentIdentifier(b.intentId), items, shippingAddress, couponCode };
}
export const digest = (s: string | Buffer) => createHash('sha256').update(s).digest('hex');
export const checkoutId = (uid: string, intent: string) => `pay-${digest(JSON.stringify([uid, intent])).slice(0, 48)}`;
export const fingerprint = ({ intentId: _intent, ...request }: CheckoutRequest) => digest(JSON.stringify(request));
export function paise(v: unknown): number {
  requireCondition(typeof v === 'number' && Number.isFinite(v) && v >= 0, 'INVALID_FINANCIAL_RECORD', 409);
  const p = Math.round(v * 100);
  requireCondition(Number.isSafeInteger(p) && p <= 100_000_000 && Math.abs(v * 100 - p) < 0.000001, 'INVALID_FINANCIAL_RECORD', 409); return p;
}
