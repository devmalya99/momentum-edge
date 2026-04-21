import { NextResponse } from 'next/server';
import { getSessionFromCookies } from '@/lib/auth/server-session';
import { stockOverviewScoresRequestSchema } from '@/lib/ai/stock-overview';
import { listAiStockOverviewScores } from '@/lib/db/ai-stock-overview-cache';

const API_TAG = '[api/ai/stock-overview/scores]';

function isTrustedSameOriginRequest(request: Request): boolean {
  const origin = request.headers.get('origin');
  const host = request.headers.get('host');
  const secFetchSite = request.headers.get('sec-fetch-site');
  const xrw = request.headers.get('x-requested-with');
  if (!origin || !host) return false;
  let originHost = '';
  try {
    originHost = new URL(origin).host;
  } catch {
    return false;
  }
  const sameHost = originHost === host;
  const trustedFetchSite =
    secFetchSite === null || secFetchSite === 'same-origin' || secFetchSite === 'same-site';
  const hasAjaxMarker = xrw?.toLowerCase() === 'xmlhttprequest';
  return sameHost && trustedFetchSite && hasAjaxMarker;
}

export async function POST(request: Request) {
  const session = await getSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!isTrustedSameOriginRequest(request)) {
    return NextResponse.json({ error: 'Request failed verification checks' }, { status: 403 });
  }
  if (!process.env.DATABASE_URL?.trim()) {
    return NextResponse.json({ error: 'Database is not configured' }, { status: 503 });
  }

  try {
    const body = stockOverviewScoresRequestSchema.parse(await request.json());
    const rows = await listAiStockOverviewScores(body.tickers);
    const nowMs = Date.now();
    return NextResponse.json({
      scores: rows.map((row) => {
        const staleAfterMs = Date.parse(row.staleAfter);
        const isStale = Number.isNaN(staleAfterMs) ? true : staleAfterMs <= nowMs;
        return {
          ticker: row.ticker,
          objectiveScore: row.objectiveScore,
          isStale,
        };
      }),
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Failed to load scores';
    console.error(`${API_TAG} failed: ${message}`);
    return NextResponse.json({ error: 'Failed to load scores' }, { status: 500 });
  }
}
