'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  businessEvaluationSummariesQueryKey,
  fetchQuickAiCheck,
  quickAiCheckQueryKey,
  QUICK_AI_CHECK_STALE_MS,
} from '@/lib/ai/quick-ai-check-client';
import { normalizeBusinessTicker } from '@/lib/ai/quick-ai-check';

type UseQuickAiCheckQueryOptions = {
  enabled?: boolean;
};

export function useQuickAiCheckQuery(
  input: { ticker: string; companyName: string },
  options?: UseQuickAiCheckQueryOptions,
) {
  const normalizedTicker = normalizeBusinessTicker(input.ticker);
  const enabled = (options?.enabled ?? true) && normalizedTicker.length > 0;

  return useQuery({
    queryKey: quickAiCheckQueryKey(normalizedTicker),
    queryFn: () =>
      fetchQuickAiCheck({
        ticker: normalizedTicker,
        companyName: input.companyName,
      }),
    enabled,
    staleTime: QUICK_AI_CHECK_STALE_MS,
    gcTime: QUICK_AI_CHECK_STALE_MS,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    retry: false,
  });
}

export function useRefreshQuickAiCheck() {
  const queryClient = useQueryClient();

  return async (input: { ticker: string; companyName: string }) => {
    const normalizedTicker = normalizeBusinessTicker(input.ticker);
    if (!normalizedTicker) return;
    const result = await fetchQuickAiCheck(
      { ticker: normalizedTicker, companyName: input.companyName },
      { refresh: true },
    );
    queryClient.setQueryData(quickAiCheckQueryKey(normalizedTicker), result);
    await queryClient.invalidateQueries({ queryKey: businessEvaluationSummariesQueryKey([normalizedTicker]) });
  };
}
