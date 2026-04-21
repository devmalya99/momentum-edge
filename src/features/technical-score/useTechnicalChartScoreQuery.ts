'use client';

import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

type ScoreMap = Map<string, number>;

async function fetchTechnicalChartScores(tickers: string[]): Promise<ScoreMap> {
  if (tickers.length === 0) return new Map();
  const res = await fetch('/api/technical-chart-scores', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Requested-With': 'XMLHttpRequest',
    },
    body: JSON.stringify({ tickers }),
  });
  const json = (await res.json().catch(() => ({}))) as { error?: string; scores?: Array<{ ticker: string; score: number }> };
  if (!res.ok) {
    throw new Error(typeof json.error === 'string' ? json.error : 'Failed to load technical chart scores');
  }
  return new Map(
    (Array.isArray(json.scores) ? json.scores : []).map((row) => [
      row.ticker.trim().toUpperCase(),
      Math.max(0, Math.min(10, Math.round(Number(row.score) || 0))),
    ]),
  );
}

async function saveTechnicalChartScore(ticker: string, score: number): Promise<void> {
  const res = await fetch('/api/technical-chart-scores', {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'X-Requested-With': 'XMLHttpRequest',
    },
    body: JSON.stringify({ ticker, score }),
  });
  const json = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) {
    throw new Error(typeof json.error === 'string' ? json.error : 'Failed to save technical chart score');
  }
}

export function useTechnicalChartScoreQuery(tickers: string[]) {
  const queryClient = useQueryClient();
  const normalizedTickers = useMemo(
    () => Array.from(new Set(tickers.map((ticker) => ticker.trim().toUpperCase()).filter(Boolean))),
    [tickers],
  );
  const query = useQuery({
    queryKey: ['technical-chart-scores', normalizedTickers],
    queryFn: () => fetchTechnicalChartScores(normalizedTickers),
    enabled: normalizedTickers.length > 0,
    staleTime: 60_000,
  });

  const mutation = useMutation({
    mutationFn: ({ ticker, score }: { ticker: string; score: number }) =>
      saveTechnicalChartScore(ticker.trim().toUpperCase(), score),
    onSuccess: (_data, vars) => {
      const keyTicker = vars.ticker.trim().toUpperCase();
      queryClient.setQueryData<ScoreMap>(
        ['technical-chart-scores', normalizedTickers],
        (prev) => new Map([...(prev ?? new Map()), [keyTicker, vars.score]]),
      );
      void queryClient.invalidateQueries({ queryKey: ['technical-chart-scores'] });
    },
  });

  return {
    ...query,
    scoreByTicker: query.data ?? new Map<string, number>(),
    saveScore: mutation.mutateAsync,
    isSaving: mutation.isPending,
  };
}
