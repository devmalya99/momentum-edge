import { useMemo } from 'react';
import { useQueries } from '@tanstack/react-query';
import type { Trade } from '@/db';
import { fetchNseEquityQuotePrice } from '@/lib/nse-quote-client';

const FIVE_MIN_MS = 5 * 60 * 1000;

export function markPriceForTrade(t: Trade, liveBySymbol: Record<string, number>): number {
  if (t.status === 'Closed') return t.exitPrice ?? t.entryPrice;
  const sym = t.symbol.trim().toUpperCase();
  return liveBySymbol[sym] ?? t.currentPrice ?? t.entryPrice;
}

export function useActiveTradeLivePrices(trades: Trade[]) {
  const activeSymbols = useMemo(() => {
    const s = new Set<string>();
    for (const t of trades) {
      if (t.status === 'Active') s.add(t.symbol.trim().toUpperCase());
    }
    return [...s].sort();
  }, [trades]);

  const quoteQueries = useQueries({
    queries: activeSymbols.map((symbol) => ({
      queryKey: ['nse-equity-quote', symbol] as const,
      queryFn: () => fetchNseEquityQuotePrice(symbol),
      enabled: activeSymbols.length > 0,
      staleTime: 0,
      gcTime: 30 * 60 * 1000,
      refetchInterval: FIVE_MIN_MS,
      refetchOnWindowFocus: true,
    })),
  });

  const quoteDataSignature = quoteQueries.map((q) => q.data ?? '').join('|');

  const livePriceBySymbol = useMemo(() => {
    const m: Record<string, number> = {};
    activeSymbols.forEach((sym, i) => {
      const p = quoteQueries[i]?.data;
      if (typeof p === 'number' && p > 0) m[sym] = p;
    });
    return m;
  }, [activeSymbols, quoteDataSignature]);

  const quotesFetching = activeSymbols.length > 0 && quoteQueries.some((q) => q.isFetching);
  const quoteErrors = quoteQueries.filter((q) => q.isError).length;

  return { activeSymbols, livePriceBySymbol, quotesFetching, quoteErrors };
}
