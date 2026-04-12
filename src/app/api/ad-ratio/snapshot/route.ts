import { NextResponse } from 'next/server';
import { nseFetchJson } from '@/lib/nse-fetch';
import { ensureAdRatioDailyTable, upsertAdRatioDaily } from '@/lib/db/ad-ratio';
import { parseNseLiveAdvanceDecline } from '@/lib/nse-live-advance-decline';

const NSE_ADVANCE_URL = 'https://www.nseindia.com/api/live-analysis-advance';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

function authorize(request: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (process.env.NODE_ENV === 'production') {
    if (!secret) {
      return false;
    }
    const auth = request.headers.get('authorization');
    if (auth === `Bearer ${secret}`) return true;
    const url = new URL(request.url);
    return url.searchParams.get('secret') === secret;
  }
  if (!secret) return true;
  const auth = request.headers.get('authorization');
  if (auth === `Bearer ${secret}`) return true;
  const url = new URL(request.url);
  return url.searchParams.get('secret') === secret;
}

async function runSnapshot(): Promise<NextResponse> {
  if (!process.env.DATABASE_URL?.trim()) {
    return NextResponse.json({ error: 'DATABASE_URL is not configured' }, { status: 503 });
  }

  const result = await nseFetchJson<unknown>(NSE_ADVANCE_URL);
  if (!result.ok) {
    return NextResponse.json(
      { error: `NSE responded with ${result.status}`, detail: result.detail },
      { status: result.status >= 500 ? 502 : 400 },
    );
  }

  const parsed = parseNseLiveAdvanceDecline(result.data);
  if (!parsed) {
    return NextResponse.json(
      { error: 'Unexpected NSE live advance/decline payload shape' },
      { status: 502 },
    );
  }

  await ensureAdRatioDailyTable();
  await upsertAdRatioDaily({
    trade_date: parsed.tradeDateIst,
    advances: parsed.advances,
    declines: parsed.declines,
    unchange: parsed.unchange,
    total: parsed.total,
    ad_ratio: parsed.adRatio,
    nse_timestamp: parsed.nseTimestampIso,
  });

  return NextResponse.json({
    ok: true,
    stored: {
      trade_date: parsed.tradeDateIst,
      advances: parsed.advances,
      declines: parsed.declines,
      ad_ratio: parsed.adRatio,
    },
  });
}

export async function GET(request: Request) {
  if (!authorize(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    return await runSnapshot();
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  if (!authorize(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    return await runSnapshot();
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
