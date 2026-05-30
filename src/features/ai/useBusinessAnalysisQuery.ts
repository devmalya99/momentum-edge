'use client';

import { useQueryClient } from '@tanstack/react-query';
import {
  businessAnalysisQueryKey,
  BUSINESS_ANALYSIS_STALE_MS,
} from '@/lib/ai/business-analysis-client';
import { normalizeBusinessTicker } from '@/lib/ai/business-analysis';

export { BUSINESS_ANALYSIS_STALE_MS, businessAnalysisQueryKey };

export function useBusinessAnalysisCache() {
  const queryClient = useQueryClient();

  return {
    getCached: (ticker: string) =>
      queryClient.getQueryData(businessAnalysisQueryKey(normalizeBusinessTicker(ticker))),
    setCached: (ticker: string, data: unknown) =>
      queryClient.setQueryData(businessAnalysisQueryKey(normalizeBusinessTicker(ticker)), data),
  };
}
