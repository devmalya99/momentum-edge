import { ZodError } from 'zod';
import { NextResponse } from 'next/server';
import { getSessionFromCookies } from '@/lib/auth/server-session';
import { fetchCachedStockNewsSearch } from '@/lib/ai/fetch-cached-stock-news-search';
import {
  normalizeStockNewsQuery,
  stockNewsSearchRequestSchema,
} from '@/lib/ai/stock-news-search';
import { isTrustedSameOriginRequest } from '@/lib/market-analyzer/api-guard';

export const dynamic = 'force-dynamic';

const API_TAG = '[api/stocks]';

export async function POST(request: Request) {
  const session = await getSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!isTrustedSameOriginRequest(request)) {
    return NextResponse.json({ error: 'Request failed verification checks' }, { status: 403 });
  }

  if (!process.env.GEMINI_API_KEY?.trim()) {
    return NextResponse.json(
      { error: 'GEMINI_API_KEY is not configured on the server.' },
      { status: 503 },
    );
  }

  let normalizedQuery = '';
  let refresh = false;
  try {
    const body = stockNewsSearchRequestSchema.parse(await request.json());
    normalizedQuery = normalizeStockNewsQuery(body.query);
    refresh = body.refresh === true;
  } catch (error) {
    const message =
      error instanceof ZodError
        ? error.issues[0]?.message ?? 'Invalid request payload'
        : 'Invalid request payload';
    return NextResponse.json({ error: message }, { status: 400 });
  }

  try {
    const result = await fetchCachedStockNewsSearch(normalizedQuery, {
      bypassCache: refresh,
    });
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch stock news';
    console.error(`${API_TAG} failed query=${normalizedQuery} message=${message}`);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
