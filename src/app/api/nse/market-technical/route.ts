import { NextResponse } from 'next/server';
import { getNseIndiaClient } from '@/lib/nse-india-singleton';
import { indexGraphChartPayloadToDailyBars } from '@/lib/nse-index-graph-bars';
import { flattenNseEquityHistoricalChunks } from '@/lib/nse-equity-historical-kline';
import { buildMarketTechnicalSnapshot } from '@/features/market-technical/helper/technical-snapshot';
import type { MarketTechnicalApiResponse, MarketTechnicalKind } from '@/features/market-technical/types';

export const dynamic = 'force-dynamic';

const INDEX_FLAGS = new Set(['1D', '5D', '1M', '3M', '6M', '1Y', '3Y', '5Y', 'MAX']);

const YMD = /^\d{4}-\d{2}-\d{2}$/;

function parseYmd(value: string | null): Date | null {
  if (!value || !YMD.test(value)) return null;
  const d = new Date(`${value}T12:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function defaultEquityRange(): { start: Date; end: Date } {
  const end = new Date();
  const start = new Date(end.getTime());
  start.setFullYear(start.getFullYear() - 5);
  return { start, end };
}

/**
 * Daily OHLCV + derived technical snapshot for an NSE index (graph chart) or equity (historical API).
 * Query: `kind=index|equity`, `symbol`, optional `flag` (index), optional `from` / `to` (equity, YYYY-MM-DD).
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const kindRaw = searchParams.get('kind')?.trim().toLowerCase() ?? 'index';
  const kind: MarketTechnicalKind = kindRaw === 'equity' ? 'equity' : 'index';
  const symbol = searchParams.get('symbol')?.trim() ?? '';
  if (symbol.length < 1) {
    return NextResponse.json({ error: 'symbol required' }, { status: 400 });
  }

  try {
    const client = getNseIndiaClient();
    let bars;

    if (kind === 'index') {
      const flagRaw = searchParams.get('flag')?.trim().toUpperCase() ?? '5Y';
      const flag = INDEX_FLAGS.has(flagRaw) ? flagRaw : '5Y';
      const path =
        `/api/NextApi/apiClient?functionName=getGraphChart` +
        `&type=${encodeURIComponent(symbol)}&flag=${encodeURIComponent(flag)}`;
      const raw = await client.getDataByEndpoint(path);
      bars = indexGraphChartPayloadToDailyBars(raw);
      const { wire, snapshot } = buildMarketTechnicalSnapshot(bars);
      const body: MarketTechnicalApiResponse = {
        kind: 'index',
        symbol,
        indexFlag: flag,
        bars: wire,
        snapshot,
      };
      return NextResponse.json(body);
    }

    const fromQ = parseYmd(searchParams.get('from'));
    const toQ = parseYmd(searchParams.get('to'));
    const range = fromQ && toQ ? { start: fromQ, end: toQ } : defaultEquityRange();
    if (range.start > range.end) {
      return NextResponse.json({ error: 'from must be on or before to' }, { status: 400 });
    }

    const sym = symbol.toUpperCase();
    const chunks = await client.getEquityHistoricalData(sym, range);
    bars = flattenNseEquityHistoricalChunks(chunks);
    const { wire, snapshot } = buildMarketTechnicalSnapshot(bars);
    const body: MarketTechnicalApiResponse = {
      kind: 'equity',
      symbol: sym,
      bars: wire,
      snapshot,
    };
    return NextResponse.json(body);
  } catch (error) {
    console.error('[GET /api/nse/market-technical]', error);
    const message = error instanceof Error ? error.message : 'Market technical fetch failed';
    return NextResponse.json({ error: 'Market technical fetch failed', detail: message }, { status: 502 });
  }
}
