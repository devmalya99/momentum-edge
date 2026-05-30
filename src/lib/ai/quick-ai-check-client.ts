import {
  QUICK_AI_CHECK_CACHE_TTL_SECONDS,
  normalizeBusinessTicker,
  quickAiCheckResponseSchema,
  quickAiCheckSummariesResponseSchema,
  type QuickAiCheckSummary,
  type QuickAiCheckResponse,
} from '@/lib/ai/quick-ai-check';

export const QUICK_AI_CHECK_STALE_MS = QUICK_AI_CHECK_CACHE_TTL_SECONDS * 1000;

export function quickAiCheckQueryKey(symbol: string) {
  return ['ai', 'quick-ai-check', normalizeBusinessTicker(symbol)] as const;
}

export function businessEvaluationSummariesQueryKey(tickers: string[]) {
  return [
    'ai',
    'business-evaluation-summaries',
    [...new Set(tickers.map((ticker) => normalizeBusinessTicker(ticker)).filter(Boolean))].sort(),
  ] as const;
}

export async function fetchQuickAiCheck(
  input: { ticker: string; companyName: string },
  options?: { refresh?: boolean },
): Promise<QuickAiCheckResponse> {
  const res = await fetch('/api/ai/quick-ai-check', {
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

  return quickAiCheckResponseSchema.parse(payload);
}

export async function fetchCachedBusinessEvaluationSummaries(
  tickers: string[],
): Promise<Map<string, QuickAiCheckSummary>> {
  const normalizedTickers = [...new Set(tickers.map((ticker) => normalizeBusinessTicker(ticker)).filter(Boolean))];
  if (normalizedTickers.length === 0) return new Map();

  const res = await fetch('/api/ai/quick-ai-check/summaries', {
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

  const parsed = quickAiCheckSummariesResponseSchema.parse(payload);
  return new Map(
    parsed.summaries.map((item) => [
      normalizeBusinessTicker(item.ticker),
      {
        ticker: normalizeBusinessTicker(item.ticker),
        category: item.category,
        ratingReasons: item.ratingReasons,
        isStale: item.isStale,
      },
    ]),
  );
}
