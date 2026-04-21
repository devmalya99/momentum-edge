'use client';

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { stockOverviewScoresResponseSchema } from '@/lib/ai/stock-overview';

async function fetchAiStockOverviewScores(
  tickers: string[],
): Promise<Map<string, { objectiveScore: number; isStale: boolean }>> {
  if (tickers.length === 0) return new Map();
  const res = await fetch('/api/ai/stock-overview/scores', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Requested-With': 'XMLHttpRequest',
    },
    body: JSON.stringify({ tickers }),
  });
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown> & { error?: string };
  if (!res.ok) {
    throw new Error(typeof json.error === 'string' ? json.error : 'Failed to load AI scores');
  }
  const parsed = stockOverviewScoresResponseSchema.parse(json);
  return new Map(
    parsed.scores.map((item) => [item.ticker.trim().toUpperCase(), { objectiveScore: item.objectiveScore, isStale: item.isStale }]),
  );
}

export function useAiStockOverviewScoresQuery(tickers: string[]) {
  const normalizedTickers = useMemo(
    () =>
      Array.from(
        new Set(
          tickers
            .map((ticker) => ticker.trim().toUpperCase())
            .filter((ticker) => ticker.length > 0),
        ),
      ),
    [tickers],
  );

  const query = useQuery({
    queryKey: ['ai', 'stock-overview-scores', normalizedTickers],
    queryFn: () => fetchAiStockOverviewScores(normalizedTickers),
    enabled: normalizedTickers.length > 0,
    staleTime: 60_000,
    gcTime: 5 * 60_000,
    retry: false,
  });

  return {
    ...query,
    scoreByTicker: query.data ?? new Map<string, { objectiveScore: number; isStale: boolean }>(),
  };
}
