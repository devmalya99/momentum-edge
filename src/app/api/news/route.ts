import { NextResponse } from 'next/server';
import { stockNewsApiResponseSchema } from '@/lib/ai/analyse-scan';
import {
  fetchTradingViewSymbolNews,
  normalizeNseSymbol,
} from '@/lib/news/fetch-tradingview-symbol-news';

const API_TAG = '[api/news]';

export async function GET(request: Request) {
  const symbol = new URL(request.url).searchParams.get('symbol') ?? '';
  const { ticker } = normalizeNseSymbol(symbol);
  if (!ticker) {
    return NextResponse.json({ error: 'symbol is required' }, { status: 400 });
  }

  try {
    const feed = await fetchTradingViewSymbolNews(symbol);
    const items = feed.items.map((row) => ({
      id: row.id,
      title: row.title,
      link: row.link,
      published: row.published,
      sourceHint: row.provider?.name,
      storyPath: row.storyPath,
      provider: row.provider,
    }));
    const validated = stockNewsApiResponseSchema.parse({
      items,
      sections: feed.sections,
    });
    return NextResponse.json(validated);
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Failed to fetch news';
    console.error(`${API_TAG} failed symbol=${symbol} message=${message}`);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
