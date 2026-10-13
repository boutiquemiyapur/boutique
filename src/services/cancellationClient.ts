import { firebaseAuth } from '../firebase/config';
import type { Order } from '../types';
export async function cancellationApi(action: 'request' | 'quote' | 'approve' | 'reject' | 'retryRefund', orderId: string, reason = '') {
  const user = firebaseAuth?.currentUser;
  if (!user) throw new Error('Sign in before changing an order.');
  const token = await user.getIdToken();
  const response = await fetch('/api/orders/cancellation', { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ action, orderId, reason }), signal: AbortSignal.timeout(25_000) });
  const result = await response.json().catch(() => null);
  if (!response.ok || !result) throw new Error(result?.code === 'LIVE_REFUNDS_DISABLED' ? 'Refund execution is disabled pending owner approval.' : 'The order could not be updated. Check its latest status before retrying.');
  return result as { order?: Order; quote?: { captured: boolean; amountPaise: number; paymentId?: string }; executionEnabled: boolean };
}
