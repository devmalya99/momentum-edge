import { useMemo } from 'react';
import type { Trade } from '@/db';

export function markPriceForTrade(t: Trade, liveBySymbol: Record<string, number>): number {
  if (t.status === 'Closed') return t.exitPrice ?? t.entryPrice;
  const sym = t.symbol.trim().toUpperCase();
  return liveBySymbol[sym] ?? t.currentPrice ?? t.entryPrice;
}

/** Active trade symbols for display; live NSE quotes are fetched only on explicit selection (watchlist/scanner). */
export function useActiveTradeLivePrices(trades: Trade[]) {
  const activeSymbols = useMemo(() => {
    const s = new Set<string>();
    for (const t of trades) {
      if (t.status === 'Active') s.add(t.symbol.trim().toUpperCase());
    }
    return [...s].toSorted();
  }, [trades]);

  return {
    activeSymbols,
    livePriceBySymbol: {} as Record<string, number>,
    quotesFetching: false,
    quoteErrors: 0,
  };
}
