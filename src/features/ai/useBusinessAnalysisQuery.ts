'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  businessAnalysisQueryKey,
  BUSINESS_ANALYSIS_STALE_MS,
  fetchFullStockBusinessAnalysisReport,
  type BusinessAnalysisSummary,
} from '@/lib/ai/business-analysis-client';
import { normalizeBusinessTicker } from '@/lib/ai/business-analysis';

type UseBusinessAnalysisQueryOptions = {
  enabled?: boolean;
};

export function useBusinessAnalysisQuery(
  input: { ticker: string; companyName: string },
  options?: UseBusinessAnalysisQueryOptions,
) {
  const normalizedTicker = normalizeBusinessTicker(input.ticker);
  const enabled = (options?.enabled ?? true) && normalizedTicker.length > 0;

  return useQuery({
    queryKey: businessAnalysisQueryKey(normalizedTicker),
    queryFn: () =>
      fetchFullStockBusinessAnalysisReport({
        ticker: normalizedTicker,
        companyName: input.companyName,
      }),
    enabled,
    staleTime: BUSINESS_ANALYSIS_STALE_MS,
    gcTime: BUSINESS_ANALYSIS_STALE_MS,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    retry: false,
  });
}

export function useRefreshBusinessAnalysis() {
  const queryClient = useQueryClient();

  return async (input: { ticker: string; companyName: string }) => {
    const normalizedTicker = normalizeBusinessTicker(input.ticker);
    if (!normalizedTicker) return;
    const result = await fetchFullStockBusinessAnalysisReport(
      { ticker: normalizedTicker, companyName: input.companyName },
      { refresh: true },
    );
    queryClient.setQueryData(businessAnalysisQueryKey(normalizedTicker), result);
  };
}

export function businessDirectionBadge(direction: BusinessAnalysisSummary['direction']): string {
  if (direction === 'up') return 'Up';
  if (direction === 'down') return 'Down';
  return 'Flat';
}
