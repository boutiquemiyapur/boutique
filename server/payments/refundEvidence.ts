import type { ProviderRefund } from './provider.js';
import { requireCondition } from './errors.js';

// Validate provider evidence in full before any trusted state is changed.
export function validateRefundEvidence(value: unknown, paymentId: string, total: number): asserts value is ProviderRefund[] {
  const ids = new Set<string>();
  requireCondition(Number.isSafeInteger(total) && total > 0 && Array.isArray(value) && value.length <= 1000
    && value.every(r => r && /^rfnd_[a-zA-Z0-9]+$/.test(r.id) && !ids.has(r.id) && !!ids.add(r.id)
      && r.currency === 'INR' && r.payment_id === paymentId && Number.isSafeInteger(r.amount) && r.amount > 0 && r.amount <= total
      && ['pending', 'processed', 'failed'].includes(r.status)), 'REFUND_EVIDENCE_INVALID', 409);
  const outstanding = value.filter(r => r.status !== 'failed').reduce((n, r) => n + r.amount, 0);
  requireCondition(Number.isSafeInteger(outstanding) && outstanding <= total, 'REFUND_EVIDENCE_INVALID', 409);
}
