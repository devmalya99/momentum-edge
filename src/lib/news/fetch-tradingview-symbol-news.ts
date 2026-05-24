import { z } from 'zod';

export function normalizeNseSymbol(raw: string): { exchange: string; ticker: string } {
  const trimmed = raw.trim().toUpperCase();
  if (!trimmed) return { exchange: 'NSE', ticker: '' };
  const colon = trimmed.indexOf(':');
  if (colon > 0) {
    return {
      exchange: trimmed.slice(0, colon),
      ticker: trimmed.slice(colon + 1),
    };
  }
  return { exchange: 'NSE', ticker: trimmed };
}

const tradingViewProviderSchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(1).optional(),
  logo_id: z.string().optional(),
});

const tradingViewNewsItemSchema = z.object({
  id: z.string().trim().min(1),
  title: z.string().trim().min(1),
  published: z.number().finite().optional(),
  urgency: z.number().int().optional(),
  link: z.string().trim().url().optional(),
  storyPath: z.string().trim().optional(),
  permission: z.string().optional(),
  provider: tradingViewProviderSchema.optional(),
});

const tradingViewSectionSchema = z.object({
  id: z.string().trim().min(1),
  title: z.string().trim().min(1),
});

export const tradingViewSymbolNewsResponseSchema = z.object({
  items: z.array(tradingViewNewsItemSchema),
  sections: z.array(tradingViewSectionSchema).optional(),
});

export type TradingViewNewsItem = z.infer<typeof tradingViewNewsItemSchema>;
export type TradingViewNewsSection = z.infer<typeof tradingViewSectionSchema>;
export type TradingViewSymbolNewsResponse = z.infer<typeof tradingViewSymbolNewsResponseSchema>;

/** Live symbol news from TradingView public mediator (landing client). */
export async function fetchTradingViewSymbolNews(
  symbol: string,
): Promise<TradingViewSymbolNewsResponse> {
  const { exchange, ticker } = normalizeNseSymbol(symbol);
  if (!ticker) {
    return { items: [], sections: [] };
  }

  const query = new URLSearchParams([
    ['filter', 'lang:en'],
    ['filter', `symbol:${exchange}:${ticker}`],
    ['client', 'landing'],
    ['streaming', 'false'],
    ['user_prostatus', 'non_pro'],
  ]);
  const endpoint = `https://news-mediator.tradingview.com/public/view/v1/symbol?${query}`;

  const res = await fetch(endpoint, {
    cache: 'no-store',
    headers: { Accept: 'application/json' },
  });
  const payload = (await res.json().catch(() => ({}))) as unknown;
  if (!res.ok) {
    throw new Error('Failed to fetch live news');
  }

  const parsed = tradingViewSymbolNewsResponseSchema.safeParse(payload);
  if (!parsed.success) {
    throw new Error('Invalid news response from feed');
  }
  return parsed.data;
}

export function formatPublishedLabel(published?: number): string {
  if (published == null || !Number.isFinite(published)) return 'Recent';
  const ms = published > 1e12 ? published : published * 1000;
  const d = new Date(ms);
  if (Number.isNaN(d.getTime())) return 'Recent';
  return d.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
