'use client';

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useMembership } from '@/hooks/useMembership';
import {
  businessEvaluationSummariesQueryKey,
  fetchCachedBusinessEvaluationSummaries,
  QUICK_AI_CHECK_STALE_MS,
} from '@/lib/ai/quick-ai-check-client';
import { normalizeBusinessTicker, type QuickAiCheckSummary } from '@/lib/ai/quick-ai-check';

export function useBusinessEvaluationSummariesQuery(tickers: string[]) {
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
    queryKey: businessEvaluationSummariesQueryKey(normalizedTickers),
    queryFn: () => fetchCachedBusinessEvaluationSummaries(normalizedTickers),
    enabled: isPremium && normalizedTickers.length > 0,
    staleTime: QUICK_AI_CHECK_STALE_MS,
    gcTime: QUICK_AI_CHECK_STALE_MS,
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
    summaryByTicker: query.data ?? new Map<string, QuickAiCheckSummary>(),
  };
}
