import { useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchVixHistory } from '@/features/vix-tracker/api/fetch-vix-history';
import { VIX_HISTORY_STALE_MS } from '@/features/vix-tracker/constants';

export type VixHistoryQueryInput = {
  sessions?: number;
  /** Parent bump (e.g. Market View refresh) — triggers refetch, not part of cache key. */
  reloadToken?: number;
};

export function vixHistoryQueryKey(sessions: number) {
  return ['vix-history', sessions] as const;
}

export function useVixHistoryQuery({ sessions = 60, reloadToken = 0 }: VixHistoryQueryInput = {}) {
  const prevReloadToken = useRef(reloadToken);

  const query = useQuery({
    queryKey: vixHistoryQueryKey(sessions),
    queryFn: () => fetchVixHistory({ sessions }),
    staleTime: VIX_HISTORY_STALE_MS,
    gcTime: VIX_HISTORY_STALE_MS * 2,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  const { refetch } = query;

  useEffect(() => {
    if (reloadToken === prevReloadToken.current) return;
    prevReloadToken.current = reloadToken;
    if (reloadToken > 0) {
      void refetch();
    }
  }, [reloadToken, refetch]);

  return query;
}
