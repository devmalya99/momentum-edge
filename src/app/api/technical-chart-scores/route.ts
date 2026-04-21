import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSessionFromCookies } from '@/lib/auth/server-session';
import {
  listUserTechnicalChartScores,
  upsertUserTechnicalChartScore,
} from '@/lib/db/technical-chart-score';

const technicalChartScoresRequestSchema = z.object({
  tickers: z.array(z.string().trim().min(1).max(32)).max(200),
});

const upsertTechnicalChartScoreSchema = z.object({
  ticker: z.string().trim().min(1).max(32),
  score: z.number().min(0).max(10),
});

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
  try {
    const session = await getSessionFromCookies();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!isTrustedSameOriginRequest(request)) {
      return NextResponse.json({ error: 'Request failed verification checks' }, { status: 403 });
    }
    if (!process.env.DATABASE_URL?.trim()) {
      return NextResponse.json({ error: 'Database is not configured' }, { status: 503 });
    }

    const body = technicalChartScoresRequestSchema.parse(await request.json());
    const rows = await listUserTechnicalChartScores(session.sub, body.tickers);
    return NextResponse.json({
      scores: rows.map((row) => ({
        ticker: row.ticker,
        score: row.score,
      })),
    });
  } catch {
    return NextResponse.json({ error: 'Failed to load technical chart scores' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await getSessionFromCookies();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!isTrustedSameOriginRequest(request)) {
      return NextResponse.json({ error: 'Request failed verification checks' }, { status: 403 });
    }
    if (!process.env.DATABASE_URL?.trim()) {
      return NextResponse.json({ error: 'Database is not configured' }, { status: 503 });
    }

    const body = upsertTechnicalChartScoreSchema.parse(await request.json());
    await upsertUserTechnicalChartScore(session.sub, body.ticker, body.score);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Failed to save technical chart score' }, { status: 500 });
  }
}
