'use client';

import { useCallback, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { MARKET_ANALYZER_INDEXES } from '@/lib/market-analyzer/index-catalog';
import { groupIndexesByPositionSize } from '@/lib/market-analyzer/index-score-visual';
import { prefetchIndexScores } from '@/lib/market-analyzer/prefetch-index-scores';
import {
  INDEX_SCORES_GC_MS,
  INDEX_SCORES_STALE_MS,
} from '@/features/market-analyzer/constants/index-scores';
import {
  clearPersistedIndexScoresCatalog,
  isIndexScoresCatalogComplete,
  isIndexScoresCatalogFresh,
  persistIndexScoresCatalog,
  readPersistedIndexScoresCatalog,
} from '@/features/market-analyzer/query/index-scores-persist';
import type {
  IndexScoreEntry,
  IndexScoresCatalog,
} from '@/features/market-analyzer/types/index-scores';
import type { IndexAnalyzerResult, TargetIndex } from '@/types/marketAnalyzer';

export const indexScoresCatalogQueryKey = ['market-analyzer', 'index-scores-catalog'] as const;

const TOTAL_INDEXES = MARKET_ANALYZER_INDEXES.length;

function catalogFromCache(
  queryClient: ReturnType<typeof useQueryClient>,
): IndexScoresCatalog | undefined {
  return queryClient.getQueryData<IndexScoresCatalog>(indexScoresCatalogQueryKey);
}

function writeCatalog(
  queryClient: ReturnType<typeof useQueryClient>,
  catalog: IndexScoresCatalog,
): void {
  queryClient.setQueryData<IndexScoresCatalog>(indexScoresCatalogQueryKey, catalog);
  persistIndexScoresCatalog(catalog);
}

export function useIndexScoreCatalogQuery() {
  const queryClient = useQueryClient();
  const persisted = useMemo(() => readPersistedIndexScoresCatalog(), []);
  const persistedComplete =
    persisted?.data != null && isIndexScoresCatalogComplete(persisted.data);

  const query = useQuery({
    queryKey: indexScoresCatalogQueryKey,
    queryFn: async ({ signal }) => {
      const existing = catalogFromCache(queryClient);
      if (
        existing &&
        isIndexScoresCatalogComplete(existing) &&
        isIndexScoresCatalogFresh(existing.refreshedAt)
      ) {
        return existing;
      }

      const seed = existing?.scores ?? {};
      const refreshedAt = existing?.refreshedAt ?? new Date().toISOString();

      const scores = await prefetchIndexScores({
        seed,
        signal,
        onProgress: (partial) => {
          writeCatalog(queryClient, { refreshedAt, scores: partial });
        },
      });

      const catalog: IndexScoresCatalog = { refreshedAt, scores };
      writeCatalog(queryClient, catalog);
      return catalog;
    },
    initialData: persisted?.data,
    /** Incomplete persisted catalogs stay stale so we only score missing indices. */
    initialDataUpdatedAt: persistedComplete ? persisted?.updatedAt : 0,
    staleTime: INDEX_SCORES_STALE_MS,
    gcTime: INDEX_SCORES_GC_MS,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    retry: false,
  });

  const scores = query.data?.scores ?? {};

  const scoredCount = useMemo(
    () => MARKET_ANALYZER_INDEXES.filter((e) => scores[e.id] != null).length,
    [scores],
  );

  const groups = useMemo(() => groupIndexesByPositionSize(scores), [scores]);

  const applyScore = useCallback(
    (index: TargetIndex, entry: IndexScoreEntry) => {
      const old = catalogFromCache(queryClient);
      writeCatalog(queryClient, {
        refreshedAt: old?.refreshedAt ?? new Date().toISOString(),
        scores: {
          ...(old?.scores ?? {}),
          [index]: entry,
        },
      });
    },
    [queryClient],
  );

  const applyAnalyzerResult = useCallback(
    (index: TargetIndex, result: IndexAnalyzerResult) => {
      applyScore(index, {
        positionSizingGuidance: result.positionSizingGuidance,
        verdict: result.verdict,
        fetchedAt: new Date().toISOString(),
      });
    },
    [applyScore],
  );

  /** Explicit only — clears 24h cache and re-runs catalog scoring (costly). */
  const refreshScores = useCallback(async () => {
    clearPersistedIndexScoresCatalog();
    queryClient.removeQueries({ queryKey: indexScoresCatalogQueryKey });
    await queryClient.fetchQuery({
      queryKey: indexScoresCatalogQueryKey,
      queryFn: async ({ signal }) => {
        const refreshedAt = new Date().toISOString();
        const scores = await prefetchIndexScores({
          seed: {},
          signal,
          onProgress: (partial) => {
            writeCatalog(queryClient, { refreshedAt, scores: partial });
          },
        });
        const catalog: IndexScoresCatalog = { refreshedAt, scores };
        writeCatalog(queryClient, catalog);
        return catalog;
      },
      staleTime: INDEX_SCORES_STALE_MS,
    });
  }, [queryClient]);

  return {
    scores,
    groups,
    warming: query.isFetching,
    scoredCount,
    totalIndexes: TOTAL_INDEXES,
    applyScore,
    applyAnalyzerResult,
    refreshScores,
    query,
  };
}

/** @deprecated Use useIndexScoreCatalogQuery */
export const useIndexScoreCatalog = useIndexScoreCatalogQuery;
