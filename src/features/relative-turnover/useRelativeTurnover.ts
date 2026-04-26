'use client';

import { useMemo } from 'react';
import { useQueries, useQuery } from '@tanstack/react-query';
import {
  RELATIVE_TURNOVER_TTL_MS,
  type RelativeTurnoverApiResponse,
  type RelativeTurnoverMetric,
} from '@/lib/relative-turnover';

async function fetchRelativeTurnover(symbol: string): Promise<RelativeTurnoverMetric> {
  const res = await fetch(`/api/stocks/relative-turnover?symbol=${encodeURIComponent(symbol)}`);
  const payload = (await res.json().catch(() => ({}))) as
    | (RelativeTurnoverApiResponse & { error?: string })
    | { error?: string };
  if (!res.ok) {
    throw new Error(typeof payload?.error === 'string' ? payload.error : 'Relative turnover request failed');
  }
  const metric = (payload as RelativeTurnoverApiResponse).metric;
  if (!metric || typeof metric.relativeTurnoverPct !== 'number') {
    throw new Error('Invalid relative turnover payload');
  }
  console.log('[relative-turnover][fetch][ok]', symbol, {
    relativeTurnoverPct: metric.relativeTurnoverPct,
    turnover30d: metric.turnover30d,
    turnover30dCr: metric.turnover30dCr,
    marketCap: metric.marketCap,
    asOf: metric.asOf,
  });
  return metric;
}

function normalizeSymbol(symbol: string): string {
  return symbol.trim().toUpperCase();
}

export function useRelativeTurnover(symbol: string) {
  const normalized = normalizeSymbol(symbol);

  const query = useQuery({
    queryKey: ['relative-turnover', normalized],
    queryFn: () => fetchRelativeTurnover(normalized),
    enabled: normalized.length > 0,
    staleTime: RELATIVE_TURNOVER_TTL_MS,
    gcTime: RELATIVE_TURNOVER_TTL_MS,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    retry: false,
  });

  return { ...query, data: query.data ?? null };
}

export function useRelativeTurnoverMap(symbols: string[]) {
  const normalizedSymbols = useMemo(
    () => Array.from(new Set(symbols.map(normalizeSymbol).filter(Boolean))),
    [symbols],
  );

  const queries = useQueries({
    queries: normalizedSymbols.map((symbol) => ({
      queryKey: ['relative-turnover', symbol] as const,
      queryFn: () => fetchRelativeTurnover(symbol),
      staleTime: RELATIVE_TURNOVER_TTL_MS,
      gcTime: RELATIVE_TURNOVER_TTL_MS,
      refetchOnMount: false,
      refetchOnWindowFocus: false,
      retry: false,
    })),
  });

  const metricBySymbol = useMemo(() => {
    const out = new Map<string, RelativeTurnoverMetric>();
    for (const symbol of normalizedSymbols) {
      const idx = normalizedSymbols.indexOf(symbol);
      const fetched = idx >= 0 ? queries[idx]?.data : undefined;
      if (fetched) {
        out.set(symbol, fetched);
        continue;
      }
      const query = idx >= 0 ? queries[idx] : undefined;
      if (query?.isError) {
        console.log('[relative-turnover][map][empty:error]', symbol, query.error);
      } else if (query?.isLoading || query?.isFetching) {
        console.log('[relative-turnover][map][pending]', symbol);
      } else {
        console.log('[relative-turnover][map][empty:no-data]', symbol);
      }
    }
    return out;
  }, [normalizedSymbols, queries]);

  return {
    metricBySymbol,
    isFetching: queries.some((q) => q.isFetching),
    isLoading: queries.some((q) => q.isLoading),
  };
}
