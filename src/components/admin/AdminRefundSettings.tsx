import React, { useEffect, useRef, useState } from 'react';
import { loadRefundSettings, saveRefundSettings, type RefundSettingsResponse } from '../../services/refundManagementClient';
import { RefundConfirmationDialog } from './RefundConfirmationDialog';

export function AdminRefundSettings() {
  const [data, setData] = useState<RefundSettingsResponse | null>(null);
  const [busy, setBusy] = useState(false); const inFlight = useRef(false);
  const [error, setError] = useState(''); const [notice, setNotice] = useState(''); const [confirm, setConfirm] = useState(false);
  useEffect(() => { let active = true; void loadRefundSettings().then(value => { if (active) setData(value); }).catch(e => { if (active) setError(e instanceof Error ? e.message : 'Unable to load refund controls.'); }); return () => { active = false; }; }, []);
  const refresh = async () => { setError(''); try { setData(await loadRefundSettings()); } catch (e) { setError(e instanceof Error ? e.message : 'Unable to load refund controls.'); } };
  const save = async (enabled: boolean) => {
    if (inFlight.current || !data) return; inFlight.current = true; setBusy(true); setError(''); setNotice('');
    try { setData(await saveRefundSettings(enabled, data.settings.revision)); setConfirm(false); setNotice(enabled ? 'Refund execution enabled for individually reviewed approvals. No refunds were started.' : 'Refund execution disabled. Existing submitted refunds can still be synchronized.'); }
    catch (e) { setError(e instanceof Error ? e.message : 'Unable to save refund controls.'); }
    finally { inFlight.current = false; setBusy(false); }
  };
  return <section className="rounded-xl border border-stone-200 bg-white p-5 sm:p-6">
    <div className="flex flex-wrap items-start justify-between gap-3"><h2 className="font-serif text-xl">Payment &amp; Refund Settings</h2><button disabled={busy} onClick={() => void refresh()} className="text-xs underline disabled:opacity-50">Refresh</button></div>
    {!data && !error && <p role="status" className="mt-4 text-sm">Loading trusted refund settings…</p>}
    {data && <div className="mt-4 space-y-4 text-sm">
      <div className="flex items-center justify-between gap-4"><div><p className="font-semibold">LIVE Refund Execution</p><p className="mt-1 text-xs text-stone-500">Status: <span className={data.settings.effectiveEnabled ? 'font-semibold text-green-700' : 'font-semibold text-stone-700'}>{data.settings.effectiveEnabled ? 'ENABLED' : 'DISABLED'}</span></p></div>
        <button type="button" role="switch" aria-label="LIVE Refund Execution" aria-checked={data.settings.adminEnabled} disabled={busy || (!data.settings.codeEnabled && !data.settings.adminEnabled)} onClick={() => data.settings.adminEnabled ? void save(false) : setConfirm(true)} className={`relative h-7 w-14 shrink-0 rounded-full transition disabled:opacity-40 ${data.settings.adminEnabled ? 'bg-[#625e59]' : 'bg-stone-300'}`}><span className={`absolute top-1 h-5 w-5 rounded-full bg-white transition ${data.settings.adminEnabled ? 'right-1' : 'left-1'}`} /></button>
      </div>
      {!data.settings.codeEnabled && <p role="status" className="rounded-lg border border-amber-200 bg-amber-50 p-3">Refund execution is locked pending security approval.</p>}
      <p>OFF preserves cancellation requests and admin decisions, but prevents new refund initiation. ON permits eligible refunds only after an admin reviews and explicitly confirms each order.</p>
      <p className="text-xs text-stone-500">Changing this setting never starts a batch or refunds older approvals. The original approval expiry, provider evidence and duplicate protection still apply. Refunds already submitted may finish processing after OFF.</p>
      <p className="break-words text-xs">Last updated: {data.settings.updatedAt ? new Date(data.settings.updatedAt).toLocaleString() : 'Default OFF — not yet configured'}{data.settings.updatedBy && ` · Admin ${data.settings.updatedBy}`}</p>
      {data.settings.adminEnabled && <button disabled={busy} onClick={() => void save(false)} className="rounded border border-stone-300 px-3 py-2 text-xs">Disable refund execution</button>}
      {data.history.length > 0 && <details className="border-t pt-3"><summary className="cursor-pointer text-xs font-semibold">Settings audit history</summary><ul className="mt-2 space-y-2 break-words text-xs">{data.history.map(entry => <li key={entry.revision}>{entry.enabled ? 'ON' : 'OFF'} · {new Date(entry.at).toLocaleString()} · Admin {entry.by} · Revision {entry.revision}</li>)}</ul></details>}
    </div>}
    {error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}{notice && <p role="status" className="mt-3 text-sm">{notice}</p>}
    {confirm && <RefundConfirmationDialog title="Enable LIVE refund execution?" busy={busy} confirmLabel="Enable refund execution" onCancel={() => setConfirm(false)} onConfirm={() => void save(true)}><p>This permits individually confirmed refunds for eligible admin-approved cancellations. It does not initiate refunds or renew old approvals.</p><p>Razorpay refunds are financial operations. Confirm that you intend to enable this control.</p></RefundConfirmationDialog>}
  </section>;
}
