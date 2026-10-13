import { firebaseAuth } from '../firebase/config';
import type { Order } from '../types';
import type { ApprovedRefundReview, RefundSettingAudit, RefundSettingsStatus } from '../types/refundManagement';

const messages: Record<string, string> = {
  LIVE_REFUNDS_DISABLED: 'Refund execution is locked pending security approval.',
  ADMIN_REFUNDS_DISABLED: 'LIVE refund execution is OFF in Payment & Refund Settings.',
  REFUND_SETTINGS_CHANGED: 'Refund settings changed. Refresh and review again.',
  REFUND_REVIEW_EXPIRED_OR_INVALID: 'This review expired or belongs to another admin. Review the refund again.',
  REFUND_QUOTE_CHANGED: 'Payment or refund evidence changed. Check the latest order before proceeding.',
  REFUND_APPROVAL_REVIEW_REQUIRED: 'The original approval requires manual review. Its timestamps will not be reset.',
  RATE_LIMITED: 'Please wait a minute before checking again.',
};
async function api<T>(path: string, body: unknown): Promise<T> {
  const user = firebaseAuth?.currentUser;
  if (!user) throw new Error('Sign in as an authorized admin.');
  const token = await user.getIdToken();
  if (firebaseAuth?.currentUser?.uid !== user.uid) throw new Error('Your account changed. Sign in again.');
  const response = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(body), signal: AbortSignal.timeout(25_000) });
  const result = await response.json().catch(() => null);
  if (firebaseAuth?.currentUser?.uid !== user.uid) throw new Error('Your account changed. Sign in again.');
  if (!response.ok || !result) throw new Error(messages[result?.code] || 'Refund management could not be confirmed. Refresh the latest status before retrying.');
  return result as T;
}
export type RefundSettingsResponse = { settings: RefundSettingsStatus; history: RefundSettingAudit[] };
const pendingSettings = new Map<string, Promise<RefundSettingsResponse>>();
export function loadRefundSettings() {
  const uid = firebaseAuth?.currentUser?.uid || '';
  const pending = pendingSettings.get(uid); if (pending) return pending;
  const request = api<RefundSettingsResponse>('/api/admin/refund-settings', { action: 'status' }).finally(() => { if (pendingSettings.get(uid) === request) pendingSettings.delete(uid); });
  pendingSettings.set(uid, request); return request;
}
export const saveRefundSettings = (enabled: boolean, revision: number) => api<RefundSettingsResponse>('/api/admin/refund-settings', { action: 'set', enabled, revision, confirmed: true });
export async function reviewApprovedRefund(orderId: string) { const result = await api<{ review: ApprovedRefundReview }>('/api/orders/cancellation', { action: 'reviewRefund', orderId }); if (result.review?.orderId !== orderId) throw new Error('Refund review did not match this order.'); return result; }
export async function confirmApprovedRefund(orderId: string, reviewId: string) { const result = await api<{ order: Order }>('/api/orders/cancellation', { action: 'executeRefund', orderId, reviewId, confirmed: true }); if (result.order?.id !== orderId) throw new Error('Refund response did not match this order.'); return result; }
