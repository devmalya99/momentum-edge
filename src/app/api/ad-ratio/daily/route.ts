import { NextResponse } from 'next/server';
import { listAdRatioDailyBetween } from '@/lib/db/ad-ratio';

export const dynamic = 'force-dynamic';

/**
 * Daily A/D snapshots from Neon for chart merge / overlays.
 * Range: Dec 1 of the year before `year` through Dec 31 of `year` so January can resolve
 * prior-calendar-month (December) lookups.
 */
export async function GET(request: Request) {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) {
    return NextResponse.json(
      { rows: [], error: 'DATABASE_URL is not configured' },
      { status: 200 },
    );
  }

  const { searchParams } = new URL(request.url);
  const yearRaw = searchParams.get('year');
  if (yearRaw == null || yearRaw.trim() === '') {
    return NextResponse.json({ error: 'Missing year', rows: [] }, { status: 400 });
  }

  const y = parseInt(yearRaw.trim(), 10);
  if (!Number.isFinite(y) || y < 1990 || y > 2100) {
    return NextResponse.json({ error: 'Invalid year', rows: [] }, { status: 400 });
  }

  try {
    const start = `${y - 1}-12-01`;
    const end = `${y}-12-31`;
    const rows = await listAdRatioDailyBetween(start, end);
    return NextResponse.json({ rows, requestedYear: y });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ error: message, rows: [] }, { status: 502 });
  }
}
