import type { MarketTechnicalApiResponse, MarketTechnicalKind } from '@/features/market-technical/types';

export type FetchMarketTechnicalParams = {
  kind: MarketTechnicalKind;
  symbol: string;
  /** Index graph range flag (default 5Y on server). */
  indexFlag?: string;
  /** Equity only: YYYY-MM-DD */
  from?: string;
  to?: string;
};

export async function fetchMarketTechnical(
  params: FetchMarketTechnicalParams,
): Promise<MarketTechnicalApiResponse> {
  const q = new URLSearchParams();
  q.set('kind', params.kind);
  q.set('symbol', params.symbol.trim());
  if (params.kind === 'index' && params.indexFlag) q.set('flag', params.indexFlag);
  if (params.kind === 'equity') {
    if (params.from) q.set('from', params.from);
    if (params.to) q.set('to', params.to);
  }
  const res = await fetch(`/api/nse/market-technical?${q.toString()}`, { cache: 'no-store' });
  const payload = (await res.json()) as MarketTechnicalApiResponse & { error?: string; detail?: string };
  if (!res.ok) {
    const msg =
      typeof payload?.error === 'string'
        ? `${payload.error}${typeof payload.detail === 'string' ? `: ${payload.detail}` : ''}`
        : 'Market technical fetch failed';
    throw new Error(msg);
  }
  if (!Array.isArray(payload.bars) || !payload.snapshot) {
    throw new Error('Invalid market technical payload');
  }
  return payload as MarketTechnicalApiResponse;
}
