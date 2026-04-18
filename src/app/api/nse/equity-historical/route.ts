import { NextResponse } from 'next/server';
import { getNseIndiaClient } from '@/lib/nse-india-singleton';

export const dynamic = 'force-dynamic';

const YMD = /^\d{4}-\d{2}-\d{2}$/;

function parseYmd(value: string | null): Date | null {
  if (!value || !YMD.test(value)) return null;
  const d = new Date(`${value}T12:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function defaultHistoricalRange(): { start: Date; end: Date } {
  const end = new Date();
  const start = new Date(end.getTime());
  start.setDate(start.getDate() - 120);
  return { start, end };
}

/**
 * Daily OHLCV chunks from NSE via `stock-nse-india` (`getEquityHistoricalData`).
 * Optional `from` / `to` as `YYYY-MM-DD` (UTC noon parsed). Defaults to the last ~120 days
 * to keep responses bounded (full history is split into many NSE calls).
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const symbol = searchParams.get('symbol')?.trim().toUpperCase() ?? '';
  if (symbol.length < 1) {
    return NextResponse.json({ error: 'symbol required' }, { status: 400 });
  }

  const fromQ = parseYmd(searchParams.get('from'));
  const toQ = parseYmd(searchParams.get('to'));
  const range = fromQ && toQ ? { start: fromQ, end: toQ } : defaultHistoricalRange();

  if (range.start > range.end) {
    return NextResponse.json({ error: 'from must be on or before to' }, { status: 400 });
  }

  try {
    const chunks = await getNseIndiaClient().getEquityHistoricalData(symbol, range);
    return NextResponse.json({ symbol, range, data: chunks });
  } catch (error) {
    console.error('[GET /api/nse/equity-historical]', error);
    const message = error instanceof Error ? error.message : 'Historical fetch failed';
    return NextResponse.json({ error: 'Historical fetch failed', detail: message }, { status: 502 });
  }
}
