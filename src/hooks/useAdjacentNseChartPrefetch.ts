'use client';

import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  nseChartHistoricalQueryOptions,
  prefetchNseChartHistorical,
  type NseChartSeriesKind,
} from '@/lib/nse-chart-query';

export type NseChartPrefetchItem = {
  symbol: string;
  seriesKind: NseChartSeriesKind;
};

/**
 * When the current list item's chart data is in cache (loaded), silently prefetch the next item
 * so row-to-row navigation feels instant.
 */
export function useAdjacentNseChartPrefetch(options: {
  items: NseChartPrefetchItem[];
  currentIndex: number;
  enabled?: boolean;
}) {
  const { items, currentIndex, enabled = true } = options;
  const queryClient = useQueryClient();

  const current =
    enabled && currentIndex >= 0 && currentIndex < items.length ? items[currentIndex] : null;
  const currentQuery = useQuery({
    ...nseChartHistoricalQueryOptions(
      current?.symbol ?? '',
      current?.seriesKind ?? 'equity',
    ),
    enabled: !!current?.symbol.trim(),
  });

  useEffect(() => {
    if (!enabled || !currentQuery.isSuccess || currentIndex < 0) return;
    for (let i = currentIndex + 1; i < items.length; i++) {
      const candidate = items[i];
      if (!candidate?.symbol.trim()) continue;
      void prefetchNseChartHistorical(queryClient, candidate.symbol, candidate.seriesKind);
      break;
    }
  }, [enabled, currentQuery.isSuccess, currentIndex, items, queryClient]);
}
