'use client';

import { useCallback, useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  fetchStockGrade,
  fetchStockGradeCacheOnly,
  stockGradeQueryKey,
  STOCK_GRADE_STALE_MS,
} from '@/lib/ai/stock-grade-client';
import { normalizeBusinessTicker, type StockGradeResponse } from '@/lib/ai/stock-grade';

type UseStockGradeInput = {
  ticker: string;
  companyName: string;
  isPremium: boolean;
};

/**
 * Grade is never auto-generated. On ticker change we only hydrate from shared DB cache.
 * Gemini runs exclusively when the user clicks the Grade button.
 */
export function useStockGrade(input: UseStockGradeInput) {
  const queryClient = useQueryClient();
  const normalizedTicker = normalizeBusinessTicker(input.ticker);
  const [isGenerating, setIsGenerating] = useState(false);

  const query = useQuery({
    queryKey: stockGradeQueryKey(normalizedTicker),
    queryFn: () =>
      fetchStockGrade({
        ticker: normalizedTicker,
        companyName: input.companyName,
      }),
    enabled: false,
    staleTime: STOCK_GRADE_STALE_MS,
    gcTime: STOCK_GRADE_STALE_MS,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    retry: false,
  });

  useEffect(() => {
    if (!normalizedTicker || !input.isPremium) return;

    const cached = queryClient.getQueryData<StockGradeResponse>(
      stockGradeQueryKey(normalizedTicker),
    );
    if (cached) return;

    let cancelled = false;
    void fetchStockGradeCacheOnly({
      ticker: normalizedTicker,
      companyName: input.companyName,
    }).then((payload) => {
      if (cancelled || !payload) return;
      queryClient.setQueryData(stockGradeQueryKey(normalizedTicker), payload);
    });

    return () => {
      cancelled = true;
    };
  }, [normalizedTicker, input.companyName, input.isPremium, queryClient]);

  const generateGrade = useCallback(
    async (options?: { refresh?: boolean }) => {
      if (!normalizedTicker) return null;
      setIsGenerating(true);
      try {
        const result = await fetchStockGrade(
          { ticker: normalizedTicker, companyName: input.companyName },
          { refresh: options?.refresh === true },
        );
        queryClient.setQueryData(stockGradeQueryKey(normalizedTicker), result);
        return result;
      } finally {
        setIsGenerating(false);
      }
    },
    [normalizedTicker, input.companyName, queryClient],
  );

  return {
    grade: query.data?.grade,
    reason: query.data?.reason,
    data: query.data,
    isGenerating,
    generateGrade,
  };
}
