import {
  BUSINESS_ANALYSIS_CACHE_TTL_SECONDS,
  businessAnalysisHighlightsResponseSchema,
  businessAnalysisResponseSchema,
  businessAnalysisSummariesResponseSchema,
  normalizeBusinessTicker,
  type BusinessAnalysisHighlightsResponse,
  type BusinessAnalysisResponse,
} from '@/lib/ai/business-analysis';

export const BUSINESS_ANALYSIS_STALE_MS = BUSINESS_ANALYSIS_CACHE_TTL_SECONDS * 1000;

export type BusinessAnalysisSummary = {
  ticker: string;
  category: BusinessAnalysisResponse['category'];
  compositeScore: number;
  direction: BusinessAnalysisResponse['direction'];
  previousCategory?: BusinessAnalysisResponse['category'];
  previousCompositeScore?: number;
  ratingReasons: string[];
  isStale: boolean;
};

export function businessAnalysisQueryKey(symbol: string) {
  return ['ai', 'business-analysis', normalizeBusinessTicker(symbol)] as const;
}

export function businessAnalysisSummariesQueryKey(tickers: string[]) {
  return [
    'ai',
    'business-analysis-summaries',
    [...new Set(tickers.map((ticker) => normalizeBusinessTicker(ticker)).filter(Boolean))].sort(),
  ] as const;
}

/**
 * Fetches the full AI business analysis for a single stock (scorecard, narrative, sources).
 * POST /api/ai/business-analysis — may run Gemini on cache miss, stale data, or when refresh is true.
 */
export async function fetchFullStockBusinessAnalysisReport(
  input: { ticker: string; companyName: string },
  options?: { refresh?: boolean },
): Promise<BusinessAnalysisResponse> {
  const res = await fetch('/api/ai/business-analysis', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Requested-With': 'XMLHttpRequest',
    },
    body: JSON.stringify({
      ticker: normalizeBusinessTicker(input.ticker),
      companyName: input.companyName.trim(),
      refresh: options?.refresh === true,
    }),
  });
  const payload: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    const message =
      payload &&
      typeof payload === 'object' &&
      'error' in payload &&
      typeof payload.error === 'string'
        ? payload.error
        : `Request failed (${res.status})`;
    throw new Error(message);
  }
  return businessAnalysisResponseSchema.parse(payload);
}

/**
 * Fetches executive summary, key positives, and key risks on demand (separate lighter Gemini call).
 * POST /api/ai/business-analysis/highlights
 */
export async function fetchStockBusinessAnalysisHighlights(
  input: { ticker: string; companyName: string },
  options?: { refresh?: boolean },
): Promise<BusinessAnalysisHighlightsResponse> {
  const res = await fetch('/api/ai/business-analysis/highlights', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Requested-With': 'XMLHttpRequest',
    },
    body: JSON.stringify({
      ticker: normalizeBusinessTicker(input.ticker),
      companyName: input.companyName.trim(),
      refresh: options?.refresh === true,
    }),
  });
  const payload: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    const message =
      payload &&
      typeof payload === 'object' &&
      'error' in payload &&
      typeof payload.error === 'string'
        ? payload.error
        : `Request failed (${res.status})`;
    throw new Error(message);
  }
  return businessAnalysisHighlightsResponseSchema.parse(payload);
}

/**
 * Fetches lightweight cached summaries for many tickers (category, score, direction, reasons).
 * POST /api/ai/business-analysis/summaries — DB read only; never triggers Gemini.
 */
export async function fetchCachedStockBusinessAnalysisSummaries(
  tickers: string[],
): Promise<Map<string, BusinessAnalysisSummary>> {
  const normalizedTickers = [...new Set(tickers.map((ticker) => normalizeBusinessTicker(ticker)).filter(Boolean))];
  if (normalizedTickers.length === 0) return new Map();

  const res = await fetch('/api/ai/business-analysis/summaries', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Requested-With': 'XMLHttpRequest',
    },
    body: JSON.stringify({ tickers: normalizedTickers }),
  });
  const payload: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    const message =
      payload &&
      typeof payload === 'object' &&
      'error' in payload &&
      typeof payload.error === 'string'
        ? payload.error
        : `Request failed (${res.status})`;
    throw new Error(message);
  }
  const parsed = businessAnalysisSummariesResponseSchema.parse(payload);
  return new Map(
    parsed.summaries.map((item) => [
      normalizeBusinessTicker(item.ticker),
      {
        ticker: normalizeBusinessTicker(item.ticker),
        category: item.category,
        compositeScore: item.compositeScore,
        direction: item.direction,
        previousCategory: item.previousCategory,
        previousCompositeScore: item.previousCompositeScore,
        ratingReasons: item.ratingReasons,
        isStale: item.isStale,
      },
    ]),
  );
}
