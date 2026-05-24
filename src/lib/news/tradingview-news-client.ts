import { stockNewsApiResponseSchema } from '@/lib/ai/analyse-scan';
import { STOCK_NEWS_SEARCH_STALE_MS } from '@/lib/ai/stock-news-search-client';

export const TRADINGVIEW_NEWS_STALE_MS = STOCK_NEWS_SEARCH_STALE_MS;

export function tradingViewNewsQueryKey(symbol: string) {
  return ['news', 'tradingview', symbol.trim().toUpperCase()] as const;
}

export async function fetchTradingViewSymbolNews(symbol: string) {
  const qs = new URLSearchParams({ symbol });
  const res = await fetch(`/api/news?${qs.toString()}`, { cache: 'no-store' });
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown> & {
    error?: string;
  };
  if (!res.ok) {
    throw new Error(typeof json.error === 'string' ? json.error : 'Failed to fetch news');
  }
  return stockNewsApiResponseSchema.parse(json);
}
