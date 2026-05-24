'use client';

import { useQuery } from '@tanstack/react-query';
import {
  fetchTradingViewSymbolNews,
  TRADINGVIEW_NEWS_STALE_MS,
  tradingViewNewsQueryKey,
} from '@/lib/news/tradingview-news-client';

type Options = {
  enabled?: boolean;
};

export function useTradingViewSymbolNewsQuery(symbol: string, options?: Options) {
  const normalizedSymbol = symbol.trim().toUpperCase();
  const enabled = (options?.enabled ?? true) && normalizedSymbol.length > 0;

  return useQuery({
    queryKey: tradingViewNewsQueryKey(normalizedSymbol),
    queryFn: () => fetchTradingViewSymbolNews(normalizedSymbol),
    enabled,
    staleTime: TRADINGVIEW_NEWS_STALE_MS,
    gcTime: TRADINGVIEW_NEWS_STALE_MS,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
}
