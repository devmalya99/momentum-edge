import {
  STOCK_GRADE_CACHE_TTL_SECONDS,
  normalizeBusinessTicker,
  stockGradeResponseSchema,
  type StockGradeResponse,
} from '@/lib/ai/stock-grade';

export const STOCK_GRADE_STALE_MS = STOCK_GRADE_CACHE_TTL_SECONDS * 1000;

export const STOCK_GRADE_API_HEADERS = {
  'Content-Type': 'application/json',
  'X-Requested-With': 'XMLHttpRequest',
} as const;

export function stockGradeQueryKey(symbol: string) {
  return ['ai', 'stock-grade', normalizeBusinessTicker(symbol)] as const;
}

type FetchStockGradeOptions = {
  refresh?: boolean;
  cacheOnly?: boolean;
};

export async function fetchStockGrade(
  input: { ticker: string; companyName: string },
  options?: FetchStockGradeOptions,
): Promise<StockGradeResponse> {
  const res = await fetch('/api/ai/stock-grade', {
    method: 'POST',
    headers: STOCK_GRADE_API_HEADERS,
    body: JSON.stringify({
      ticker: normalizeBusinessTicker(input.ticker),
      companyName: input.companyName.trim(),
      refresh: options?.refresh === true,
      cacheOnly: options?.cacheOnly === true,
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

  return stockGradeResponseSchema.parse(payload);
}

/** Reads shared DB cache only — returns null on miss (no Gemini call). */
export async function fetchStockGradeCacheOnly(input: {
  ticker: string;
  companyName: string;
}): Promise<StockGradeResponse | null> {
  const res = await fetch('/api/ai/stock-grade', {
    method: 'POST',
    headers: STOCK_GRADE_API_HEADERS,
    body: JSON.stringify({
      ticker: normalizeBusinessTicker(input.ticker),
      companyName: input.companyName.trim(),
      cacheOnly: true,
    }),
  });

  if (res.status === 404) return null;

  const payload: unknown = await res.json().catch(() => null);
  if (!res.ok) return null;

  return stockGradeResponseSchema.parse(payload);
}
