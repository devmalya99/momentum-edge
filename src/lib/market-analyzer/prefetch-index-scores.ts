import {
  collectMarketTelemetryWithShared,
  fetchSharedMarketSlices,
  type SharedMarketSlices,
} from '@/lib/market-analyzer/collect-telemetry';
import { MARKET_ANALYZER_INDEXES } from '@/lib/market-analyzer/index-catalog';
import type { IndexScoreEntry } from '@/features/market-analyzer/types/index-scores';
import { synthesizePayload } from '@/utils/dataSynthesizer';
import { indexAnalyzerResultSchema, type TargetIndex } from '@/types/marketAnalyzer';

const PREFETCH_CONCURRENCY = 2;

async function analyzeIndexScore(
  index: TargetIndex,
  shared: SharedMarketSlices,
): Promise<IndexScoreEntry> {
  const telemetry = await collectMarketTelemetryWithShared(index, shared);
  const payload = synthesizePayload(index, telemetry);

  const res = await fetch('/api/market-analyzer', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Requested-With': 'XMLHttpRequest',
    },
    body: JSON.stringify({ payload }),
    cache: 'no-store',
  });

  const json = (await res.json()) as { error?: string; message?: string };
  if (!res.ok) {
    const msg =
      typeof json?.message === 'string'
        ? json.message
        : typeof json?.error === 'string'
          ? json.error
          : `Market analysis failed (${res.status})`;
    throw new Error(msg);
  }

  const validated = indexAnalyzerResultSchema.parse(json);
  return {
    positionSizingGuidance: validated.positionSizingGuidance,
    verdict: validated.verdict,
    fetchedAt: new Date().toISOString(),
  };
}

export type PrefetchIndexScoresOptions = {
  /** Skip indices that already have a cached score in this run's seed map. */
  seed?: Partial<Record<TargetIndex, IndexScoreEntry>>;
  onProgress?: (scores: Partial<Record<TargetIndex, IndexScoreEntry>>) => void;
  signal?: AbortSignal;
};

/**
 * Precalculates position-size scores for the full catalog (shared VIX/A/D fetches).
 * Intended to run in the background from the Market Analyzer dropdown.
 */
export async function prefetchIndexScores(
  options: PrefetchIndexScoresOptions = {},
): Promise<Partial<Record<TargetIndex, IndexScoreEntry>>> {
  const { seed = {}, onProgress, signal } = options;
  const shared = await fetchSharedMarketSlices();
  const scores: Partial<Record<TargetIndex, IndexScoreEntry>> = { ...seed };

  const pending = MARKET_ANALYZER_INDEXES.map((e) => e.id).filter((id) => !scores[id]);

  let cursor = 0;
  async function worker(): Promise<void> {
    while (cursor < pending.length) {
      if (signal?.aborted) return;
      const index = pending[cursor++];
      try {
        scores[index] = await analyzeIndexScore(index, shared);
        onProgress?.({ ...scores });
      } catch (err) {
        console.warn(`[prefetch-index-scores] ${index} failed:`, err);
      }
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(PREFETCH_CONCURRENCY, pending.length) }, () => worker()),
  );

  return scores;
}
