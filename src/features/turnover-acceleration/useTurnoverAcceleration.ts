'use client';

import { useEffect, useMemo } from 'react';
import { useQueries, useQuery } from '@tanstack/react-query';
import {
  TURNOVER_ACCELERATION_TTL_MS,
  type TurnoverAccelerationApiResponse,
  type TurnoverAccelerationMetric,
} from '@/lib/turnover-acceleration';
import { useTurnoverAccelerationStore } from '@/store/useTurnoverAccelerationStore';

async function fetchTurnoverAcceleration(symbol: string): Promise<TurnoverAccelerationMetric> {
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

function normalizeSymbol(symbol: string): string {
  return symbol.trim().toUpperCase();
}

export function useTurnoverAcceleration(symbol: string) {
  const normalized = normalizeSymbol(symbol);
  const getValidMetric = useTurnoverAccelerationStore((s) => s.getValidMetric);
  const setMetric = useTurnoverAccelerationStore((s) => s.setMetric);
  const invalidateExpired = useTurnoverAccelerationStore((s) => s.invalidateExpired);
  const bySymbol = useTurnoverAccelerationStore((s) => s.bySymbol);

  useEffect(() => {
    invalidateExpired();
  }, [invalidateExpired]);

  const cached = bySymbol[normalized];
  const validCached = useMemo(() => getValidMetric(normalized), [getValidMetric, normalized, cached]);

  const query = useQuery({
    queryKey: ['turnover-acceleration', normalized],
    queryFn: () => fetchTurnoverAcceleration(normalized),
    enabled: normalized.length > 0 && !validCached,
    staleTime: TURNOVER_ACCELERATION_TTL_MS,
    gcTime: TURNOVER_ACCELERATION_TTL_MS,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    retry: false,
  });

  useEffect(() => {
    if (!query.data) return;
    setMetric(query.data);
  }, [query.data, setMetric]);

  return {
    ...query,
    data: validCached ?? query.data ?? null,
  };
}

export function useTurnoverAccelerationMap(symbols: string[]) {
  const normalizedSymbols = useMemo(
    () => Array.from(new Set(symbols.map(normalizeSymbol).filter(Boolean))),
    [symbols],
  );
  const getValidMetric = useTurnoverAccelerationStore((s) => s.getValidMetric);
  const setMetric = useTurnoverAccelerationStore((s) => s.setMetric);
  const invalidateExpired = useTurnoverAccelerationStore((s) => s.invalidateExpired);
  const bySymbol = useTurnoverAccelerationStore((s) => s.bySymbol);

  useEffect(() => {
    invalidateExpired();
  }, [invalidateExpired]);

  const cachedBySymbol = useMemo(() => {
    const map = new Map<string, TurnoverAccelerationMetric>();
    for (const symbol of normalizedSymbols) {
      const row = getValidMetric(symbol);
      if (row) map.set(symbol, row);
    }
    return map;
  }, [normalizedSymbols, getValidMetric, bySymbol]);

  const queries = useQueries({
    queries: normalizedSymbols.map((symbol) => ({
      queryKey: ['turnover-acceleration', symbol] as const,
      queryFn: () => fetchTurnoverAcceleration(symbol),
      enabled: !cachedBySymbol.has(symbol),
      staleTime: TURNOVER_ACCELERATION_TTL_MS,
      gcTime: TURNOVER_ACCELERATION_TTL_MS,
      refetchOnMount: false,
      refetchOnWindowFocus: false,
      retry: false,
    })),
  });

  useEffect(() => {
    for (let i = 0; i < queries.length; i += 1) {
      const symbol = normalizedSymbols[i];
      const data = queries[i]?.data;
      if (symbol && data) setMetric(data);
    }
  }, [queries, normalizedSymbols, setMetric]);

  const metricBySymbol = useMemo(() => {
    const out = new Map<string, TurnoverAccelerationMetric>();
    for (let i = 0; i < normalizedSymbols.length; i += 1) {
      const symbol = normalizedSymbols[i];
      const cached = cachedBySymbol.get(symbol);
      if (cached) {
        out.set(symbol, cached);
        continue;
      }
      const fetched = queries[i]?.data;
      if (fetched) out.set(symbol, fetched);
    }
    return out;
  }, [normalizedSymbols, cachedBySymbol, queries]);

  return {
    metricBySymbol,
    isFetching: queries.some((q) => q.isFetching),
    isLoading: queries.some((q) => q.isLoading),
  };
}
