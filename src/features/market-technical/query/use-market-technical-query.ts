import { useQuery } from '@tanstack/react-query';
import { fetchMarketTechnical, type FetchMarketTechnicalParams } from '@/features/market-technical/api/fetch-market-technical';

/** API params plus optional `reloadToken` (parent bump → new fetch, not sent to server). */
export type MarketTechnicalQueryInput = FetchMarketTechnicalParams & {
  reloadToken?: number;
};

function wireParams(p: MarketTechnicalQueryInput): FetchMarketTechnicalParams {
  const { reloadToken: _t, ...rest } = p;
  return rest;
}

export function marketTechnicalQueryKey(params: MarketTechnicalQueryInput) {
  const w = wireParams(params);
  return [
    'market-technical',
    w.kind,
    w.symbol.trim().toUpperCase(),
    w.indexFlag ?? '',
    w.from ?? '',
    w.to ?? '',
    params.reloadToken ?? 0,
  ] as const;
}

export function useMarketTechnicalQuery(params: MarketTechnicalQueryInput) {
  const w = wireParams(params);
  const sym = w.symbol.trim();
  return useQuery({
    queryKey: marketTechnicalQueryKey(params),
    queryFn: () => fetchMarketTechnical(w),
    enabled: sym.length > 0,
    staleTime: 5 * 60_000,
  });
}
