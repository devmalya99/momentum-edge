import { NextResponse } from 'next/server';
import {
  stockNewsApiResponseSchema,
  type StockNewsItem,
} from '@/lib/ai/analyse-scan';

const API_TAG = '[api/news]';

function normalizeSymbol(raw: string): { exchange: string; ticker: string } {
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

export async function GET(request: Request) {
  const symbol = new URL(request.url).searchParams.get('symbol') ?? '';
  const { exchange, ticker } = normalizeSymbol(symbol);
  if (!ticker) {
    return NextResponse.json({ error: 'symbol is required' }, { status: 400 });
  }

  try {
    const endpoint = new URL('https://news-mediator.tradingview.com/public/view/v1/symbol');
    endpoint.searchParams.append('filter', 'lang:en');
    endpoint.searchParams.append('filter', `symbol:${exchange}:${ticker}`);
    endpoint.searchParams.append('client', 'overview');
    endpoint.searchParams.append('user_prostatus', 'non_pro');

    const res = await fetch(endpoint.toString(), {
      cache: 'no-store',
      headers: {
        Accept: 'application/json',
      },
    });
    const payload = (await res.json().catch(() => ({}))) as {
      items?: Array<{ id?: unknown; title?: unknown; link?: unknown }>;
    };
    if (!res.ok) {
      return NextResponse.json({ error: 'Failed to fetch news' }, { status: 502 });
    }

    const items: StockNewsItem[] = (payload.items ?? [])
      .slice(0, 5)
      .map((item, idx) => ({
        id:
          typeof item.id === 'string' && item.id.trim()
            ? item.id
            : `${exchange}:${ticker}:${idx}`,
        title:
          typeof item.title === 'string' && item.title.trim()
            ? item.title.trim()
            : 'Untitled',
        link: typeof item.link === 'string' ? item.link : '',
      }))
      .filter((item) => item.link.startsWith('http'));

    const validated = stockNewsApiResponseSchema.parse({ items });
    return NextResponse.json(validated);
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Failed to fetch news';
    console.error(`${API_TAG} failed symbol=${exchange}:${ticker} message=${message}`);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
