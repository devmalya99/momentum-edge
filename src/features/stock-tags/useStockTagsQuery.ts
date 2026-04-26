'use client';

import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

export type StaticStockTag = { id: string; label: string; sortOrder: number };
type TagMap = Map<string, string[]>;

async function fetchStaticStockTags(): Promise<StaticStockTag[]> {
  const res = await fetch('/api/static-items', { cache: 'no-store' });
  const json = (await res.json().catch(() => ({}))) as {
    error?: string;
    items?: Array<{ id: string; label: string; sortOrder: number }>;
  };
  if (!res.ok) throw new Error(typeof json.error === 'string' ? json.error : 'Failed to load tags');
  return (Array.isArray(json.items) ? json.items : []).map((item) => ({
    id: item.id,
    label: item.label,
    sortOrder: item.sortOrder,
  }));
}

async function fetchStockTags(tickers: string[]): Promise<TagMap> {
  if (tickers.length === 0) return new Map();
  const res = await fetch('/api/stock-tags', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Requested-With': 'XMLHttpRequest',
    },
    body: JSON.stringify({ tickers }),
  });
  const json = (await res.json().catch(() => ({}))) as {
    error?: string;
    tags?: Array<{ ticker: string; tagIds: string[] }>;
  };
  if (!res.ok) throw new Error(typeof json.error === 'string' ? json.error : 'Failed to load stock tags');
  return new Map(
    (Array.isArray(json.tags) ? json.tags : []).map((row) => [
      row.ticker.trim().toUpperCase(),
      Array.from(new Set((Array.isArray(row.tagIds) ? row.tagIds : []).map((id) => id.trim()).filter(Boolean))),
    ]),
  );
}

async function saveStockTags(ticker: string, tagId: string | null): Promise<void> {
  const res = await fetch('/api/stock-tags', {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'X-Requested-With': 'XMLHttpRequest',
    },
    body: JSON.stringify({ ticker, tagId }),
  });
  const json = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) throw new Error(typeof json.error === 'string' ? json.error : 'Failed to save stock tags');
}

export function useStockTagsQuery(tickers: string[]) {
  const queryClient = useQueryClient();
  const normalizedTickers = useMemo(
    () => Array.from(new Set(tickers.map((ticker) => ticker.trim().toUpperCase()).filter(Boolean))),
    [tickers],
  );
  const staticTagsQuery = useQuery({
    queryKey: ['stock-tags', 'static-items'],
    queryFn: fetchStaticStockTags,
    staleTime: 5 * 60_000,
  });
  const tagsQuery = useQuery({
    queryKey: ['stock-tags', normalizedTickers],
    queryFn: () => fetchStockTags(normalizedTickers),
    enabled: normalizedTickers.length > 0,
    staleTime: 60_000,
  });
  const saveMutation = useMutation({
    mutationFn: ({ ticker, tagId }: { ticker: string; tagId: string | null }) =>
      saveStockTags(ticker.trim().toUpperCase(), tagId),
    onSuccess: (_data, vars) => {
      const keyTicker = vars.ticker.trim().toUpperCase();
      queryClient.setQueryData<TagMap>(['stock-tags', normalizedTickers], (prev) => {
        const next = new Map(prev ?? []);
        next.set(keyTicker, vars.tagId ? [vars.tagId] : []);
        return next;
      });
      void queryClient.invalidateQueries({ queryKey: ['stock-tags'] });
    },
  });

  return {
    staticTags: staticTagsQuery.data ?? [],
    isLoadingStaticTags: staticTagsQuery.isLoading,
    isFetchingStaticTags: staticTagsQuery.isFetching,
    stockTagsByTicker: tagsQuery.data ?? new Map<string, string[]>(),
    isLoadingStockTags: tagsQuery.isLoading,
    isFetchingStockTags: tagsQuery.isFetching,
    saveTags: saveMutation.mutateAsync,
    isSavingTags: saveMutation.isPending,
  };
}
