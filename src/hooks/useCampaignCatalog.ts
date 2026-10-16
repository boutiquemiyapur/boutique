import { useEffect, useMemo, useState } from 'react';
import { isFirebaseEnabled } from '../firebase/config';
import type { Product } from '../types';
import { withSalePrice, type SaleCampaign, type SalePrice } from '../utils/saleCampaigns';
type State = { source: Product[]; prices: Record<string, SalePrice>; campaigns: SaleCampaign[]; now: number; received: number };
export function useCampaignCatalog(regularProducts: Product[]) {
  const [state, setState] = useState<State | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  useEffect(() => {
    if (!isFirebaseEnabled) { setStatus('ready'); return; }
    let stopped = false; let sequence = 0; let expires = Infinity; let timer: ReturnType<typeof setTimeout>; let controller: AbortController;
    let cachedPrices: Record<string, SalePrice> | null = null; let cachedSignature = '';
    const refresh = async () => {
      const ticket = ++sequence;
      const started = performance.now(); if (started >= expires) setStatus('loading');
      const currentController = new AbortController(); controller = currentController;
      const timeout = setTimeout(() => currentController.abort(), 15000);
      try {
        const json = async (response: Response) => { if (!response.ok) throw Error('Sale prices unavailable'); return response.json(); };
        const metadata = await fetch('/api/sales', { signal: currentController.signal, cache: 'no-store' }).then(json);
        if (stopped || ticket !== sequence) return;
        const signature = metadata.campaigns.map((c: SaleCampaign) => `${c.id}:${c.revision}`).sort().join('|');
        let prices = cachedSignature === signature && cachedPrices ? cachedPrices : {};
        if (metadata.campaigns.length && (!cachedPrices || signature !== cachedSignature)) {
          const requests = [];
          for (let i = 0; i < regularProducts.length; i += 100) requests.push(fetch('/api/sales', { method: 'POST', signal: currentController.signal, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ productIds: regularProducts.slice(i, i + 100).map(p => p.id) }) }).then(json));
          const pages = await Promise.all(requests); prices = Object.assign({}, ...pages.map(page => page.prices));
        }
        if (stopped || ticket !== sequence) return;
        const publicIds = new Set(metadata.campaigns.map((c: SaleCampaign) => c.id));
        if (Object.values(prices).some(price => price.saleCampaign && !publicIds.has(price.saleCampaign.id))) { setStatus('loading'); timer = setTimeout(refresh, 250); return; }
        const end = Math.min(...metadata.campaigns.map((c: SaleCampaign) => c.endsAt), ...Object.values(prices).map(price => price.saleCampaign?.endsAt ?? Infinity));
        const boundary = end - metadata.now - (performance.now() - started);
        if (boundary <= 0) { setStatus('loading'); timer = setTimeout(refresh, 250); return; }
        cachedPrices = prices; cachedSignature = signature;
        expires = performance.now() + boundary;
        setState({ source: regularProducts, prices, campaigns: metadata.campaigns, now: metadata.now, received: performance.now() }); setStatus('ready');
        timer = setTimeout(() => { if (boundary <= 30000) setStatus('loading'); void refresh(); }, Math.max(250, Math.min(30000, boundary)));
      } catch { if (!stopped && ticket === sequence) { setStatus('error'); timer = setTimeout(refresh, 10000); } }
      finally { clearTimeout(timeout); }
    };
    setStatus('loading'); void refresh();
    const visible = () => { if (document.visibilityState === 'visible') { clearTimeout(timer); controller?.abort(); void refresh(); } };
    document.addEventListener('visibilitychange', visible);
    return () => { stopped = true; controller?.abort(); clearTimeout(timer); document.removeEventListener('visibilitychange', visible); };
  }, [regularProducts]);
  const effectiveProducts = useMemo(() => state?.source === regularProducts && status === 'ready' ? regularProducts.map(p => state.prices[p.id] ? withSalePrice(p, state.prices[p.id]) : p) : regularProducts, [regularProducts, state?.source, state?.prices, status]);
  return useMemo(() => ({
    products: effectiveProducts,
    campaigns: status === 'ready' ? state?.campaigns || [] : [],
    status: !isFirebaseEnabled ? 'ready' as const : state?.source !== regularProducts && status !== 'error' ? 'loading' as const : status,
  }), [effectiveProducts, regularProducts, state, status]);
}
