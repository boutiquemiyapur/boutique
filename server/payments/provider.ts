import { createHmac, timingSafeEqual } from 'node:crypto';
import { PaymentError, requireCondition } from './errors.js';
import { validatePaymentEnvironment } from './environment.js';
export type ProviderOrder = { id: string; amount: number; currency: string; receipt: string; notes?: { checkoutId?: string } };
export type ProviderPayment = { id: string; order_id: string; amount: number; currency: string; status: string; captured: boolean; amount_refunded: number };
export type ProviderRefund = { id: string; payment_id: string; amount: number; status: string };
export interface PaymentProvider {
  keyId: string;
  createOrder(amount: number, receipt: string, checkoutId: string): Promise<ProviderOrder>;
  findOrders(receipt: string, since: number): Promise<ProviderOrder[]>;
  payment(id: string): Promise<ProviderPayment>;
  order(id: string): Promise<ProviderOrder>;
  payments(orderId: string): Promise<ProviderPayment[]>;
  refunds(paymentId: string): Promise<ProviderRefund[]>;
}
export function validSignature(message: string | Buffer, signature: unknown, secret: string) {
  if (typeof signature !== 'string' || !/^[a-f0-9]{64}$/i.test(signature)) return false;
  return timingSafeEqual(createHmac('sha256', secret).update(message).digest(), Buffer.from(signature, 'hex'));
}
export function razorpayProvider(env = process.env): PaymentProvider {
  const { keyId, secret } = validatePaymentEnvironment(env);
  async function api<T>(path: string, body?: unknown): Promise<T> {
    try {
      const response = await fetch(`https://api.razorpay.com/v1/${path}`, { method: body ? 'POST' : 'GET', headers: { Authorization: `Basic ${Buffer.from(`${keyId}:${secret}`).toString('base64')}`, 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(12_000) });
      if (!response.ok) throw new PaymentError('PROVIDER_UNAVAILABLE', 503);
      return await response.json() as T;
    } catch { throw new PaymentError('PROVIDER_UNAVAILABLE', 503); }
  }
  async function list<T>(path: string) {
    const result: T[] = [];
    for (let skip = 0; skip < 1000; skip += 100) {
      const page = await api<{ items: T[] }>(`${path}${path.includes('?') ? '&' : '?'}count=100&skip=${skip}`);
      requireCondition(Array.isArray(page.items), 'INVALID_PROVIDER_RESPONSE', 503); result.push(...page.items);
      if (page.items.length < 100) return result;
    }
    throw new PaymentError('RECONCILIATION_LIMIT', 503);
  }
  return {
    keyId,
    createOrder: (amount, receipt, checkoutId) => api('orders', { amount, currency: 'INR', receipt, partial_payment: false, notes: { checkoutId } }),
    // Receipt is not treated as provider idempotency. Search a bounded creation window.
    findOrders: async (receipt, since) => (await list<ProviderOrder>(`orders?from=${Math.floor(since / 1000) - 60}&to=${Math.floor(since / 1000) + 180}`)).filter(o => o.receipt === receipt),
    payment: id => api(`payments/${encodeURIComponent(id)}`),
    order: id => api(`orders/${encodeURIComponent(id)}`),
    payments: id => list(`orders/${encodeURIComponent(id)}/payments`),
    refunds: id => list(`payments/${encodeURIComponent(id)}/refunds`),
  };
}
