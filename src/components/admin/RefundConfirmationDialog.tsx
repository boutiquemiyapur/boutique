import React, { useEffect, useRef } from 'react';

export function RefundConfirmationDialog({ title, children, busy, confirmLabel, onCancel, onConfirm }: {
  title: string; children: React.ReactNode; busy: boolean; confirmLabel: string; onCancel: () => void; onConfirm: () => void;
}) {
  const panel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    panel.current?.querySelector<HTMLButtonElement>('button')?.focus();
    return () => previous?.focus();
  }, []);
  return <div className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-black/50 p-4" onKeyDown={e => {
    if (e.key === 'Escape' && !busy) onCancel();
    if (e.key === 'Tab') {
      const controls = panel.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)');
      if (!controls?.length) { e.preventDefault(); return; }
      const first = controls[0], last = controls[controls.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  }}><div ref={panel} role="dialog" aria-modal="true" aria-labelledby="refund-confirmation-title" className="my-4 w-full max-w-lg rounded-xl bg-white p-5 shadow-2xl sm:p-7">
    <h3 id="refund-confirmation-title" className="font-serif text-2xl">{title}</h3>
    <div className="my-5 space-y-3 break-words text-sm leading-6 text-stone-600">{children}</div>
    <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end"><button type="button" disabled={busy} onClick={onCancel} className="rounded border border-stone-300 px-4 py-2 disabled:opacity-50">Cancel</button><button type="button" disabled={busy} onClick={onConfirm} className="rounded bg-[#625e59] px-4 py-2 text-white disabled:opacity-50">{busy ? 'Checking trusted result…' : confirmLabel}</button></div>
  </div></div>;
}
