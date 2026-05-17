'use client';

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useMembership } from '@/hooks/useMembership';
import { quantamentalScoresResponseSchema } from '@/lib/validations/stock-schema';

export function quantamentalScoreTickerKey(ticker: string): string {
  return ticker.trim().toUpperCase().replace(/^(NSE:|BSE:)/, '');
}

async function fetchAiStockOverviewScores(
  tickers: string[],
): Promise<Map<string, { quantamentalScore: number; isStale: boolean }>> {
  if (tickers.length === 0) return new Map();
  const res = await fetch('/api/analyze/scores', {
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
  const parsed = quantamentalScoresResponseSchema.parse(json);
  return new Map(
    parsed.scores.map((item) => [
      quantamentalScoreTickerKey(item.ticker),
      { quantamentalScore: item.totalScore, isStale: item.isStale },
    ]),
  );
}

export function useAiStockOverviewScoresQuery(tickers: string[]) {
  const { isPremium } = useMembership();
  const normalizedTickers = useMemo(() => {
    const out = new Set<string>();
    for (const ticker of tickers) {
      const key = quantamentalScoreTickerKey(ticker);
      if (key) out.add(key);
    }
    return [...out];
  }, [tickers]);

  const query = useQuery({
    queryKey: ['ai', 'quantamental-scores', normalizedTickers],
    queryFn: () => fetchAiStockOverviewScores(normalizedTickers),
    enabled: isPremium && normalizedTickers.length > 0,
    staleTime: 60_000,
    gcTime: 5 * 60_000,
    refetchInterval: () => {
      if (typeof document === 'undefined') return false;
      return document.visibilityState === 'visible' && document.hasFocus() ? 10_000 : false;
    },
    refetchIntervalInBackground: false,
    retry: false,
  });

  return {
    ...query,
    scoreByTicker: query.data ?? new Map<string, { quantamentalScore: number; isStale: boolean }>(),
  };
}
