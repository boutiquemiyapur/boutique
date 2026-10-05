import { firebaseAuth } from '../firebase/config';
import type { CartItem, Order, ShippingAddress } from '../types';
export type CheckoutResponse = { order: Order; checkout: null | { keyId: string; orderId: string; amount: number; currency: 'INR'; expiresAt: string } };
export const confirmedPayment = (o: Order) => o.paymentProvider === 'razorpay' && ['PAID', 'REFUND_PENDING', 'PARTIALLY_REFUNDED', 'REFUNDED'].includes(o.paymentStatus);
const messages: Record<string, string> = {
  PAYMENT_CONFIGURATION_MISSING: 'Online payment is not configured yet. Please contact the store.',
  INVALID_OPTIONS_OR_STOCK: 'Your selected options or stock have changed. Review your bag.',
  INTENT_CONFLICT: 'This payment attempt belongs to different checkout details.',
  PROVIDER_CREATION_UNCERTAIN: 'Payment preparation is being checked. Retry this same checkout shortly.',
  PROVIDER_CREATION_REQUIRES_REVIEW: 'The store needs to review this payment attempt. No new payment was created.',
  PAYMENT_CREATION_IN_PROGRESS: 'Your payment is being prepared. Please retry shortly.',
  RETRY_PRICE_CHANGED: 'Prices changed after this attempt. Contact the store before starting another payment.',
  RATE_LIMITED: 'Please wait a minute before checking your payment again.',
  INVALID_ADDRESS: 'Enter a valid Indian delivery address, email and phone number.',
};
export async function paymentApi<T>(path: string, body: unknown): Promise<T> {
  const user = firebaseAuth?.currentUser; if (!user) throw new Error('Please sign in before paying.');
  const token = await user.getIdToken();
  const response = await fetch(`/api/payments/${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(body) });
  const data = await response.json().catch(() => null);
  if (!response.ok || !data) throw new Error(messages[data?.code] || 'Payment could not be confirmed. Your order remains available to check or retry.');
  return data as T;
}
export function checkoutBusinessRequest(items: CartItem[], a: ShippingAddress, couponCode: string | null) {
  const { fullName, phone, email, addressLine1, addressLine2 = '', city, state, pincode, country } = a;
  return { items: items.map(l => ({ productId: l.product.id, selectedColor: l.selectedColor, selectedSize: l.selectedSize, quantity: l.quantity, isCustomTailored: l.isCustomTailored, ...(l.isCustomTailored && l.customMeasurements ? { customMeasurements: l.customMeasurements } : {}), giftPackaging: l.giftPackaging === true, ...(l.giftNote ? { giftNote: l.giftNote } : {}) })).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))), shippingAddress: { fullName, phone, email, addressLine1, addressLine2, city, state, pincode, country }, couponCode };
}
export async function stableCheckout(uid: string, request: ReturnType<typeof checkoutBusinessRequest>) {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(request)));
  const hash = [...new Uint8Array(bytes)].map(v => v.toString(16).padStart(2, '0')).join('');
  const key = `ab-payment-intent:${uid}:${hash}`;
  const obtain = () => { const value = localStorage.getItem(key) || crypto.randomUUID(); localStorage.setItem(key, value); return value; };
  const intentId = navigator.locks ? await navigator.locks.request(key, obtain) : obtain();
  return { ...request, intentId };
}
type PaymentResult = { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string };
declare global { interface Window { Razorpay?: new (options: Record<string, unknown>) => { open(): void } } }
let scriptPromise: Promise<void> | undefined;
function loadCheckout() {
  if (window.Razorpay) return Promise.resolve();
  if (!scriptPromise) scriptPromise = new Promise<void>((resolve, reject) => {
    const script = document.createElement('script'); script.src = 'https://checkout.razorpay.com/v1/checkout.js'; script.async = true;
    const fail = () => { script.remove(); scriptPromise = undefined; reject(new Error('Payment checkout could not load. Please retry.')); };
    const timeout = window.setTimeout(fail, 15_000);
    script.onload = () => { clearTimeout(timeout); if (window.Razorpay) resolve(); else fail(); };
    script.onerror = () => { clearTimeout(timeout); fail(); }; document.head.appendChild(script);
  }); return scriptPromise;
}
export async function openPayment(response: CheckoutResponse): Promise<Order> {
  if (!response.checkout) return response.order;
  await loadCheckout(); const c = response.checkout;
  return new Promise((resolve, reject) => {
    let settled = false; let verifying = false; const finish = (order: Order) => { if (!settled) { settled = true; resolve(order); } };
    const instance = new window.Razorpay!({ key: c.keyId, order_id: c.orderId, amount: c.amount, currency: c.currency, name: 'AB Collection', prefill: { name: response.order.shippingAddress.fullName, email: response.order.shippingAddress.email, contact: response.order.shippingAddress.phone },
      handler: async (result: PaymentResult) => {
        verifying = true;
        try { finish((await paymentApi<{ order: Order }>('verify', { orderId: response.order.id, ...result })).order); }
        catch (e) { if (!settled) { settled = true; reject(e); } }
      }, modal: { ondismiss: () => { if (!verifying) finish(response.order); } },
    }); instance.open();
  });
}
export async function retryOrder(order: Order) {
  if (!order.checkoutIntentId) throw new Error('This order cannot be retried online.');
  const business = checkoutBusinessRequest(order.items, order.shippingAddress, order.couponCodeApplied || null);
  return openPayment(await paymentApi<CheckoutResponse>('create-order', { ...business, intentId: order.checkoutIntentId }));
}
