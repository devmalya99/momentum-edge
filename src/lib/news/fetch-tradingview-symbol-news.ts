import { z } from 'zod';

const TV_NEWS_FETCH_TIMEOUT_MS = 12_000;
const TV_NEWS_MAX_ATTEMPTS = 2;

const TRADINGVIEW_NEWS_HEADERS: HeadersInit = {
  Accept: 'application/json',
  'User-Agent':
    'Mozilla/5.0 (compatible; MomentumEdge/1.0; +https://github.com/momentum-edge)',
  Referer: 'https://www.tradingview.com/',
};

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
  link: z.string().trim().optional(),
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

function buildTradingViewNewsEndpoint(exchange: string, ticker: string): string {
  const query = new URLSearchParams([
    ['filter', 'lang:en'],
    ['filter', `symbol:${exchange}:${ticker}`],
    ['client', 'landing'],
    ['streaming', 'false'],
    ['user_prostatus', 'non_pro'],
  ]);
  return `https://news-mediator.tradingview.com/public/view/v1/symbol?${query}`;
}

function parseTradingViewNewsPayload(payload: unknown): TradingViewSymbolNewsResponse {
  const items: TradingViewNewsItem[] = [];
  const sections: TradingViewNewsSection[] = [];

  if (payload && typeof payload === 'object') {
    const record = payload as Record<string, unknown>;
    if (Array.isArray(record.items)) {
      for (const row of record.items) {
        const parsed = tradingViewNewsItemSchema.safeParse(row);
        if (parsed.success) items.push(parsed.data);
      }
    }
    if (Array.isArray(record.sections)) {
      for (const row of record.sections) {
        const parsed = tradingViewSectionSchema.safeParse(row);
        if (parsed.success) sections.push(parsed.data);
      }
    }
  }

  return {
    items,
    sections: sections.length > 0 ? sections : undefined,
  };
}

async function fetchTradingViewNewsPayload(
  endpoint: string,
): Promise<{ ok: true; payload: unknown } | { ok: false; status: number; message: string }> {
  const res = await fetch(endpoint, {
    cache: 'no-store',
    headers: TRADINGVIEW_NEWS_HEADERS,
    signal: AbortSignal.timeout(TV_NEWS_FETCH_TIMEOUT_MS),
  });
  const payload = (await res.json().catch(() => ({}))) as unknown;
  if (!res.ok) {
    return {
      ok: false,
      status: res.status,
      message: `TradingView news HTTP ${res.status}`,
    };
  }
  return { ok: true, payload };
}

/** Live symbol news from TradingView public mediator (landing client). */
export async function fetchTradingViewSymbolNews(
  symbol: string,
): Promise<TradingViewSymbolNewsResponse> {
  const { exchange, ticker } = normalizeNseSymbol(symbol);
  if (!ticker) {
    return { items: [], sections: [] };
  }

  const endpoint = buildTradingViewNewsEndpoint(exchange, ticker);
  let lastError = 'Failed to fetch live news';

  for (let attempt = 1; attempt <= TV_NEWS_MAX_ATTEMPTS; attempt += 1) {
    try {
      const result = await fetchTradingViewNewsPayload(endpoint);
      if (!result.ok) {
        lastError = result.message;
        continue;
      }
      const parsed = parseTradingViewNewsPayload(result.payload);
      if (parsed.items.length > 0 || attempt === TV_NEWS_MAX_ATTEMPTS) {
        return parsed;
      }
      lastError = 'TradingView news feed returned no usable items';
    } catch (error) {
      lastError = error instanceof Error ? error.message : 'Failed to fetch live news';
    }
  }

  throw new Error(lastError);
}

/**
 * Best-effort news for AI context — never throws; returns empty headlines on feed errors.
 */
export async function fetchTradingViewSymbolNewsForAnalysis(
  symbol: string,
): Promise<TradingViewSymbolNewsResponse> {
  try {
    return await fetchTradingViewSymbolNews(symbol);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch live news';
    console.warn(`[fetchTradingViewSymbolNews] analysis context fallback empty symbol=${symbol} reason=${message}`);
    return { items: [], sections: [] };
  }
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
