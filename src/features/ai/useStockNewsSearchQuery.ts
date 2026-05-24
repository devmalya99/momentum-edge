'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  fetchStockNewsSearch,
  STOCK_NEWS_SEARCH_STALE_MS,
  stockNewsSearchQueryKey,
} from '@/lib/ai/stock-news-search-client';
import { normalizeStockNewsQuery } from '@/lib/ai/stock-news-search';

type UseStockNewsSearchQueryOptions = {
  enabled?: boolean;
};

export function useStockNewsSearchQuery(
  query: string,
  options?: UseStockNewsSearchQueryOptions,
) {
  const normalizedQuery = normalizeStockNewsQuery(query);
  const enabled = (options?.enabled ?? true) && normalizedQuery.length > 0;

  return useQuery({
    queryKey: stockNewsSearchQueryKey(normalizedQuery),
    queryFn: () => fetchStockNewsSearch(normalizedQuery),
    enabled,
    staleTime: STOCK_NEWS_SEARCH_STALE_MS,
    gcTime: STOCK_NEWS_SEARCH_STALE_MS,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
}

export function useRefreshStockNewsSearch() {
  const queryClient = useQueryClient();

  return async (query: string) => {
    const normalizedQuery = normalizeStockNewsQuery(query);
    if (!normalizedQuery) return;

    const result = await fetchStockNewsSearch(normalizedQuery, { refresh: true });
    queryClient.setQueryData(stockNewsSearchQueryKey(normalizedQuery), result);
  };
}
