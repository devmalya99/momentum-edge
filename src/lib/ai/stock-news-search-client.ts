import {
  STOCK_NEWS_SEARCH_CACHE_TTL_SECONDS,
  type StockNewsSearchResult,
} from '@/lib/ai/stock-news-search';

export const STOCK_NEWS_SEARCH_STALE_MS = STOCK_NEWS_SEARCH_CACHE_TTL_SECONDS * 1000;

export function stockNewsSearchQueryKey(symbol: string) {
  return ['ai', 'stock-news-search', symbol.trim().toUpperCase()] as const;
}

export async function fetchStockNewsSearch(
  query: string,
  options?: { refresh?: boolean },
): Promise<StockNewsSearchResult> {
  const res = await fetch('/api/stocks', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Requested-With': 'XMLHttpRequest',
    },
    body: JSON.stringify({ query, refresh: options?.refresh === true }),
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

  return payload as StockNewsSearchResult;
}
