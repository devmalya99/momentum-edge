import { NextResponse } from 'next/server';
import { getNseIndiaClient } from '@/lib/nse-india-singleton';
import { equityDetailsToNseQuoteRow } from '@/lib/nse-equity-details-to-quote-row';

export const dynamic = 'force-dynamic';

export type { NseEquityQuoteMeta, NseEquityQuoteOrderBook, NseEquityQuoteRow } from '@/lib/nse-equity-quote-types';

/**
 * Equity last price + tick metadata for active trades (Dashboard) and Entry flow.
 * Uses `stock-nse-india` (`getEquityDetails`) instead of calling NSE GetQuoteApi directly,
 * then maps to the compact quote shape the UI already consumes.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const symbol = searchParams.get('symbol')?.trim() ?? '';

  if (symbol.length < 1) {
    return NextResponse.json({ error: 'symbol required' }, { status: 400 });
  }

  try {
    const details = await getNseIndiaClient().getEquityDetails(symbol.toUpperCase());
    const quote = equityDetailsToNseQuoteRow(details);
    const lp = quote.metaData?.closePrice;
    if (typeof lp !== 'number' || !Number.isFinite(lp) || lp <= 0) {
      return NextResponse.json({ error: 'No price in quote', detail: 'lastPrice missing' }, { status: 404 });
    }
    return NextResponse.json({ quote });
  } catch (error) {
    console.error('[GET /api/nse/equity-quote]', error);
    const message = error instanceof Error ? error.message : 'Quote fetch failed';
    return NextResponse.json({ error: 'Quote fetch failed', detail: message }, { status: 502 });
  }
}
