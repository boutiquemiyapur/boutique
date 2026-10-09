import React, { useEffect, useState } from 'react';
import { BRAND } from '../../config/brand';

export const Spinner = ({ className = '' }: { className?: string }) => <span aria-hidden="true" className={`boutique-spinner inline-block h-4 w-4 shrink-0 rounded-full border-2 border-current border-r-transparent ${className}`} />;
export const ButtonProgress = ({ children }: { children: React.ReactNode }) => <span className="inline-flex items-center justify-center gap-2"><Spinner />{children}</span>;

// Offer recovery for slow requests without pretending they failed or restarting
// listeners. This timer only changes feedback; it never delays the operation.
export function LoadingFeedback({ label = 'Loading…', children }: { label?: string; children?: React.ReactNode }) {
  const [slow, setSlow] = useState(false);
  useEffect(() => { const timer = setTimeout(() => setSlow(true), 15000); return () => clearTimeout(timer); }, []);
  return <div aria-busy="true" className="boutique-enter"><p role="status" aria-label={label} aria-live="polite" className="flex items-center gap-2 text-sm text-stone-600"><Spinner />{label}</p>{children}{slow && <p className="mt-4 text-sm text-stone-600">This is taking longer than expected. Check your connection, or <button type="button" className="underline" onClick={() => window.location.reload()}>reload this page</button>.</p>}</div>;
}

export function PageLoading({ label = 'Opening the boutique…' }: { label?: string }) {
  return <section className="grid min-h-[60vh] place-items-center bg-[#f8f5ee] px-5 py-12"><div className="w-full max-w-sm text-center"><img src={BRAND.logoSrc} alt={BRAND.title} className="mx-auto mb-6 h-20 w-auto object-contain" /><LoadingFeedback label={label} /></div></section>;
}
