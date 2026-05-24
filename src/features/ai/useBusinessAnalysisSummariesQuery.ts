'use client';

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useMembership } from '@/hooks/useMembership';
import {
  businessAnalysisSummariesQueryKey,
  BUSINESS_ANALYSIS_STALE_MS,
  fetchCachedStockBusinessAnalysisSummaries,
  type BusinessAnalysisSummary,
} from '@/lib/ai/business-analysis-client';
import { normalizeBusinessTicker } from '@/lib/ai/business-analysis';

export function useBusinessAnalysisSummariesQuery(tickers: string[]) {
  const { isPremium } = useMembership();
  const normalizedTickers = useMemo(() => {
    const out = new Set<string>();
    for (const ticker of tickers) {
      const key = normalizeBusinessTicker(ticker);
      if (key) out.add(key);
    }
    return [...out];
  }, [tickers]);

  const query = useQuery({
    queryKey: businessAnalysisSummariesQueryKey(normalizedTickers),
    queryFn: () => fetchCachedStockBusinessAnalysisSummaries(normalizedTickers),
    enabled: isPremium && normalizedTickers.length > 0,
    staleTime: BUSINESS_ANALYSIS_STALE_MS,
    gcTime: BUSINESS_ANALYSIS_STALE_MS,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchInterval: () => {
      if (typeof document === 'undefined') return false;
      return document.visibilityState === 'visible' && document.hasFocus() ? 30_000 : false;
    },
    refetchIntervalInBackground: false,
    retry: false,
  });

  return {
    ...query,
    summaryByTicker: query.data ?? new Map<string, BusinessAnalysisSummary>(),
  };
}
