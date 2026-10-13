import { randomUUID } from 'node:crypto';
import type { Firestore } from 'firebase-admin/firestore';
import type { RefundSettingsStatus } from '../../src/types/refundManagement.js';
import { LIVE_REFUND_EXECUTION_ENABLED } from './refundPolicy.js';
import { requireCondition } from '../payments/errors.js';

export class RefundSettingsService {
  constructor(public db: Firestore, public codeEnabled = LIVE_REFUND_EXECUTION_ENABLED, public now = () => Date.now()) {}
  ref() { return this.db.collection('refundSettings').doc('control'); }
  snapshot(raw: any): RefundSettingsStatus {
    const date = raw?.updatedAt;
    const validDate = typeof date === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(date) && Number.isFinite(Date.parse(date)) && new Date(date).toISOString() === date && Date.parse(date) <= this.now();
    requireCondition(!raw || (typeof raw.enabled === 'boolean' && Number.isSafeInteger(raw.revision) && raw.revision > 0 && raw.revision < Number.MAX_SAFE_INTEGER && typeof raw.updatedBy === 'string' && raw.updatedBy.length > 0 && validDate), 'REFUND_SETTINGS_REVIEW_REQUIRED', 409);
    return { codeEnabled: this.codeEnabled, adminEnabled: raw?.enabled === true, effectiveEnabled: this.codeEnabled && raw?.enabled === true, revision: raw?.revision || 0, updatedAt: raw?.updatedAt || null, updatedBy: raw?.updatedBy || null };
  }
  async read() { return this.snapshot((await this.ref().get()).data()); }
  requireEnabled(status: RefundSettingsStatus) {
    requireCondition(status.codeEnabled, 'LIVE_REFUNDS_DISABLED', 409);
    requireCondition(status.effectiveEnabled, 'ADMIN_REFUNDS_DISABLED', 409);
  }
  async history() { return (await this.ref().collection('history').orderBy('at', 'desc').limit(20).get()).docs.map(s => s.data()); }
  async set(adminUid: string, enabled: boolean, revision: number, confirmed: boolean) {
    requireCondition(typeof adminUid === 'string' && adminUid.length > 0 && typeof enabled === 'boolean' && Number.isSafeInteger(revision) && revision >= 0 && revision < Number.MAX_SAFE_INTEGER - 1, 'INVALID_REFUND_SETTINGS_REQUEST');
    requireCondition(!enabled || confirmed === true, 'REFUND_ENABLE_CONFIRMATION_REQUIRED');
    requireCondition(!enabled || this.codeEnabled, 'LIVE_REFUNDS_DISABLED', 409);
    return this.db.runTransaction(async tx => {
      const ref = this.ref(); const raw = (await tx.get(ref)).data(); const status = this.snapshot(raw);
      requireCondition(status.revision === revision, 'REFUND_SETTINGS_CHANGED', 409);
      if (raw && raw.enabled === enabled) return status;
      const at = new Date(this.now()).toISOString(); const next = { enabled, revision: revision + 1, updatedBy: adminUid, updatedAt: at };
      tx.set(ref, next);
      tx.set(ref.collection('history').doc(randomUUID()), { enabled, revision: next.revision, by: adminUid, at });
      return this.snapshot(next);
    });
  }
}
