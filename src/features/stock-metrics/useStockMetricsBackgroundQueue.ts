'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  RELATIVE_TURNOVER_TTL_MS,
  type RelativeTurnoverApiResponse,
  type RelativeTurnoverMetric,
} from '@/lib/relative-turnover';
import {
  TURNOVER_ACCELERATION_TTL_MS,
  type TurnoverAccelerationApiResponse,
  type TurnoverAccelerationMetric,
} from '@/lib/turnover-acceleration';
import { useRelativeTurnoverStore } from '@/store/useRelativeTurnoverStore';
import { useTurnoverAccelerationStore } from '@/store/useTurnoverAccelerationStore';

const API_CALL_INTERVAL_MS = 84; // ~12 calls per second
const METRIC_QUERY_CACHE_MS = 6 * 60 * 60 * 1000; // 6 hours

type MetricTask = {
  symbol: string;
  kind: 'relative' | 'acceleration';
};

type FailureState = {
  count: number;
  nextRetryAt: number;
};

function normalizeSymbol(symbol: string): string {
  return symbol.trim().toUpperCase();
}

async function fetchRelativeTurnoverMetric(symbol: string): Promise<RelativeTurnoverMetric> {
  const res = await fetch(`/api/stocks/relative-turnover?symbol=${encodeURIComponent(symbol)}`);
  const payload = (await res.json().catch(() => ({}))) as
    | (RelativeTurnoverApiResponse & { error?: string })
    | { error?: string };
  if (!res.ok) {
    throw new Error(typeof payload?.error === 'string' ? payload.error : 'Relative turnover request failed');
  }
  const metric = (payload as RelativeTurnoverApiResponse).metric;
  if (!metric || typeof metric.relativeTurnoverPct !== 'number') {
    throw new Error('Invalid relative turnover payload');
  }
  return metric;
}

async function fetchTurnoverAccelerationMetric(symbol: string): Promise<TurnoverAccelerationMetric> {
  const res = await fetch(`/api/stocks/turnover-acceleration?symbol=${encodeURIComponent(symbol)}`);
  const payload = (await res.json().catch(() => ({}))) as
    | (TurnoverAccelerationApiResponse & { error?: string })
    | { error?: string };
  if (!res.ok) {
    throw new Error(
      typeof payload?.error === 'string' ? payload.error : 'Turnover acceleration request failed',
    );
  }
  const metric = (payload as TurnoverAccelerationApiResponse).metric;
  if (!metric || typeof metric.recentTurnover !== 'number' || typeof metric.previousTurnover !== 'number') {
    throw new Error('Invalid turnover acceleration payload');
  }
  return metric;
}

export function useStockMetricsBackgroundQueue(symbols: string[]) {
  const queryClient = useQueryClient();
  const relativeBySymbol = useRelativeTurnoverStore((s) => s.bySymbol);
  const getValidRelative = useRelativeTurnoverStore((s) => s.getValidMetric);
  const setRelativeMetric = useRelativeTurnoverStore((s) => s.setMetric);
  const accelerationBySymbol = useTurnoverAccelerationStore((s) => s.bySymbol);
  const getValidAcceleration = useTurnoverAccelerationStore((s) => s.getValidMetric);
  const setAccelerationMetric = useTurnoverAccelerationStore((s) => s.setMetric);

  const normalizedSymbols = useMemo(
    () => Array.from(new Set(symbols.map(normalizeSymbol).filter(Boolean))),
    [symbols],
  );
  const tasks = useMemo(() => {
    const pending: MetricTask[] = [];
    for (const symbol of normalizedSymbols) {
      if (!getValidRelative(symbol)) pending.push({ symbol, kind: 'relative' });
      if (!getValidAcceleration(symbol)) pending.push({ symbol, kind: 'acceleration' });
    }
    return pending;
  }, [normalizedSymbols, getValidRelative, getValidAcceleration, relativeBySymbol, accelerationBySymbol]);

  const queueRef = useRef<MetricTask[]>([]);
  const runningRef = useRef(false);
  const failureRef = useRef<Map<string, FailureState>>(new Map());
  const failedSymbolsRef = useRef<Set<string>>(new Set());
  const [currentTaskSymbol, setCurrentTaskSymbol] = useState<string | null>(null);

  useEffect(() => {
    queueRef.current = tasks;
  }, [tasks]);

  useEffect(() => {
    if (normalizedSymbols.length === 0) return;
    const timer = window.setInterval(() => {
      if (runningRef.current) return;
      const next = queueRef.current.shift();
      if (!next) return;
      if (failedSymbolsRef.current.has(next.symbol)) {
        return;
      }
      const failureKey = `${next.kind}:${next.symbol}`;
      const failure = failureRef.current.get(failureKey);
      if (failure && failure.nextRetryAt > Date.now()) {
        return;
      }
      const key =
        next.kind === 'relative'
          ? (['relative-turnover', next.symbol] as const)
          : (['turnover-acceleration', next.symbol] as const);
      const state = queryClient.getQueryState(key);
      const ageMs = typeof state?.dataUpdatedAt === 'number' ? Date.now() - state.dataUpdatedAt : Number.POSITIVE_INFINITY;
      if (state?.data !== undefined && ageMs <= METRIC_QUERY_CACHE_MS) {
        return;
      }

      runningRef.current = true;
      setCurrentTaskSymbol(next.symbol);
      void (async () => {
        try {
          if (next.kind === 'relative') {
            const metric = await queryClient.fetchQuery({
              queryKey: ['relative-turnover', next.symbol] as const,
              queryFn: () => fetchRelativeTurnoverMetric(next.symbol),
              staleTime: METRIC_QUERY_CACHE_MS,
              gcTime: METRIC_QUERY_CACHE_MS,
            });
            setRelativeMetric(metric);
            failureRef.current.delete(failureKey);
          } else {
            const metric = await queryClient.fetchQuery({
              queryKey: ['turnover-acceleration', next.symbol] as const,
              queryFn: () => fetchTurnoverAccelerationMetric(next.symbol),
              staleTime: METRIC_QUERY_CACHE_MS,
              gcTime: METRIC_QUERY_CACHE_MS,
            });
            setAccelerationMetric(metric);
            failureRef.current.delete(failureKey);
          }
        } catch {
          const previous = failureRef.current.get(failureKey);
          const nextCount = (previous?.count ?? 0) + 1;
          const backoffMs =
            nextCount === 1
              ? 2 * 60 * 1000
              : nextCount === 2
                ? 10 * 60 * 1000
                : 30 * 60 * 1000;
          failureRef.current.set(failureKey, {
            count: nextCount,
            nextRetryAt: Date.now() + backoffMs,
          });
          // Hard-block stocks that repeatedly fail so they never block queue throughput.
          if (nextCount >= 2) {
            failedSymbolsRef.current.add(next.symbol);
          }
        } finally {
          setCurrentTaskSymbol(null);
          runningRef.current = false;
        }
      })();
    }, API_CALL_INTERVAL_MS);

    return () => window.clearInterval(timer);
  }, [normalizedSymbols, queryClient, setAccelerationMetric, setRelativeMetric]);

  const readySymbols = useMemo(() => {
    const ready = new Set<string>();
    for (const symbol of normalizedSymbols) {
      if (getValidRelative(symbol) && getValidAcceleration(symbol)) {
        ready.add(symbol);
      }
    }
    return ready;
  }, [normalizedSymbols, getValidRelative, getValidAcceleration, relativeBySymbol, accelerationBySymbol]);

  const hasReadyMetrics = (symbol: string) => readySymbols.has(normalizeSymbol(symbol));

  return {
    hasReadyMetrics,
    pendingCount: tasks.length,
    currentTaskSymbol,
  };
}
