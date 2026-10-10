import { firebaseAuth } from '../firebase/config';
import type { CartItem, Order, ShippingAddress } from '../types';
export type CheckoutResponse = { order: Order; checkout: null | { keyId: string; orderId: string; amount: number; currency: 'INR'; expiresAt: string } };
import { trustedPaymentOutcome, type PaymentOutcome } from '../utils/paymentState';
export { confirmedPayment } from '../utils/paymentState';
export type PaymentStage = 'preparing' | 'loading' | 'opening' | 'checkout' | 'verifying' | 'checking' | 'idle';
export type PaymentProgress = (stage: PaymentStage) => void;
export const paymentStageText: Record<PaymentStage, string> = {
  preparing: 'Preparing secure payment\u2026', loading: 'Opening Razorpay\u2026',
  opening: 'Opening Razorpay\u2026', checkout: 'Complete payment in the secure Razorpay window.',
  verifying: 'Verifying your payment…', checking: 'Checking latest payment status…', idle: '',
};
const reportProgress = (notify: PaymentProgress | undefined, stage: PaymentStage) => { try { notify?.(stage); } catch { /* UI feedback cannot decide payment state. */ } };
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
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => { timer = setTimeout(() => {
    controller.abort(); reject(new Error('Payment confirmation is taking longer than expected. Check the order status before retrying; payment may still be received.'));
  }, 25000); });
  try {
    return await Promise.race([timeout, (async () => {
      const token = await user.getIdToken();
      if (controller.signal.aborted) throw new Error('Payment check timed out.');
      const response = await fetch(`/api/payments/${path}`, { method: 'POST', signal: controller.signal, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(body) });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data) throw new Error(messages[data?.code] || 'Payment could not be confirmed. Your order remains available to check or retry.');
      return data as T;
    })()]);
  } finally { clearTimeout(timer!); }
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
declare global { interface Window { Razorpay?: new (options: Record<string, unknown>) => { open(): void; on(event: 'payment.failed', handler: () => void): void } } }
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
let activeCheckout: Promise<PaymentOutcome> | null = null;
export function openPayment(response: CheckoutResponse, notify?: PaymentProgress): Promise<PaymentOutcome> {
  if (activeCheckout) return Promise.resolve({ kind: 'error', order: response.order,
    message: 'A payment checkout is already open. Complete or close it before retrying.' });
  const operation = runCheckout(response, notify);
  activeCheckout = operation;
  void operation.finally(() => { if (activeCheckout === operation) activeCheckout = null; reportProgress(notify, 'idle'); }).catch(() => undefined);
  return operation;
}
async function runCheckout(response: CheckoutResponse, notify?: PaymentProgress): Promise<PaymentOutcome> {
  const error = (e: unknown): PaymentOutcome => ({ kind: 'error', order: response.order,
    message: e instanceof Error ? e.message : 'Payment could not be confirmed. Check the order before retrying.' });
  if (!response.checkout) return trustedPaymentOutcome(response.order);
  try {
    reportProgress(notify, 'loading'); await loadCheckout(); const c = response.checkout;
    reportProgress(notify, 'opening');
    return await new Promise<PaymentOutcome>((resolve) => {
      let settled = false; let verifying = false; let failed = false;
      const finish = (outcome: PaymentOutcome) => { if (!settled) { settled = true; resolve(outcome); } };
      const instance = new window.Razorpay!({ key: c.keyId, order_id: c.orderId, amount: c.amount, currency: c.currency, name: 'AB Collection',
        prefill: { name: response.order.shippingAddress.fullName, email: response.order.shippingAddress.email, contact: response.order.shippingAddress.phone },
        handler: async (result: PaymentResult) => {
          if (settled || verifying) return;
          verifying = true;
          reportProgress(notify, 'verifying');
          try {
            const { order } = await paymentApi<{ order: Order }>('verify', { orderId: response.order.id, ...result });
            if (order?.id !== response.order.id) throw new Error('Payment response did not match this order. Check its status before retrying.');
            finish(trustedPaymentOutcome(order));
          } catch (e) { finish(error(e)); }
        },
        modal: { ondismiss: () => {
          if (!verifying) finish(failed
            ? { kind: 'error', order: response.order, message: 'The payment attempt failed. Your bag is preserved. Check payment before retrying.' }
            : { kind: 'dismissed', order: response.order });
        } },
      });
      // A client failure is feedback only. It cannot write FAILED or release stock.
      // Checkout can still offer a retry; a later successful callback is verified.
      instance.on('payment.failed', () => { failed = true; });
      instance.open();
      if (!settled && !verifying) reportProgress(notify, 'checkout');
    });
  } catch (e) { return error(e); }
}
export async function retryOrder(order: Order, notify?: PaymentProgress): Promise<PaymentOutcome> {
  try {
    reportProgress(notify, 'preparing');
    if (!order.checkoutIntentId) throw new Error('This order cannot be retried online.');
    const business = checkoutBusinessRequest(order.items, order.shippingAddress, order.couponCodeApplied || null);
    const response = await paymentApi<CheckoutResponse>('create-order', { ...business, intentId: order.checkoutIntentId });
    if (response.order?.id !== order.id) throw new Error('Retry response did not match this order. Contact the store.');
    return await openPayment(response, notify);
  } catch (e) { return { kind: 'error', order, message: e instanceof Error ? e.message : 'Payment could not be retried.' }; }
  finally { reportProgress(notify, 'idle'); }
}
