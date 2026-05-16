import { NextResponse } from 'next/server';
import type { IndexDetails, IndexEquityInfo } from 'stock-nse-india';
import { nseFetchJson } from '@/lib/nse-fetch';
import { getNseIndiaClient } from '@/lib/nse-india-singleton';
import type { NseIndexDetailsPayload, NseIndexEquityRow } from '@/lib/nse-index-details-types';

export const dynamic = 'force-dynamic';

function mapConstituent(row: IndexEquityInfo): NseIndexEquityRow {
  const symbol = String(row.symbol ?? row.meta?.symbol ?? '').trim().toUpperCase();
  const companyName =
    String(row.meta?.companyName ?? row.meta?.industry ?? row.symbol ?? symbol).trim() || symbol;
  return {
    symbol,
    series: String(row.series ?? ''),
    companyName,
    open: row.open,
    dayHigh: row.dayHigh,
    dayLow: row.dayLow,
    lastPrice: row.lastPrice,
    previousClose: row.previousClose,
    change: row.change,
    pChange: row.pChange,
    totalTradedVolume: row.totalTradedVolume,
    totalTradedValue: row.totalTradedValue,
    yearHigh: row.yearHigh,
    yearLow: row.yearLow,
    perChange30d: row.perChange30d,
    perChange365d: row.perChange365d,
    lastUpdateTime: String(row.lastUpdateTime ?? ''),
  };
}

function isEquityConstituent(row: IndexEquityInfo, indexDisplayName: string): boolean {
  const sym = String(row.symbol ?? row.meta?.symbol ?? '').trim();
  if (!sym) return false;
  const idx = indexDisplayName.trim().toLowerCase();
  if (sym.toLowerCase() === idx) return false;
  if (row.series === 'EQ') return true;
  const id = String(row.identifier ?? '');
  if (/EQN$/i.test(id)) return true;
  if (row.meta?.segment === 'EQUITY') return true;
  return false;
}

async function fetchIndexDetailsRaw(index: string): Promise<IndexDetails> {
  const enc = encodeURIComponent(index.trim().toUpperCase());
  const url = `https://www.nseindia.com/api/equity-stockIndices?index=${enc}`;
  const direct = await nseFetchJson<IndexDetails>(url);
  if (direct.ok) {
    const body = direct.data;
    if (Array.isArray(body?.data) && body.data.length > 0) return body;
  }

  return getNseIndiaClient().getEquityStockIndices(index);
}

function toPayload(details: IndexDetails): NseIndexDetailsPayload {
  const name = String(details.name ?? details.metadata?.indexName ?? '').trim();
  const rows = Array.isArray(details.data) ? details.data : [];
  const constituents = rows
    .filter((r) => isEquityConstituent(r, name))
    .map(mapConstituent)
    .filter((r) => r.symbol.length > 0);

  return {
    name,
    timestamp: String(details.timestamp ?? ''),
    date30dAgo: String(details.date30dAgo ?? ''),
    date365dAgo: String(details.date365dAgo ?? ''),
    advance: {
      advances: String(details.advance?.advances ?? ''),
      declines: String(details.advance?.declines ?? ''),
      unchanged: String(details.advance?.unchanged ?? ''),
    },
    metadata: details.metadata,
    marketStatus: details.marketStatus,
    constituents,
  };
}

/**
 * Full NSE index details for an index (default NIFTY 500).
 * Uses `getEquityStockIndices` from `stock-nse-india` (returns `IndexDetails`).
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const index = searchParams.get('index')?.trim() || 'NIFTY 500';

  if (index.length < 2) {
    return NextResponse.json({ error: 'index required' }, { status: 400 });
  }

  try {
    const raw = await fetchIndexDetailsRaw(index);
    console.log('raw', raw);
    const payload = toPayload(raw);
    if (payload.constituents.length === 0) {
      return NextResponse.json(
        { error: 'No constituents returned', detail: `Empty data for ${index}` },
        { status: 404 },
      );
    }
    return NextResponse.json(payload);
  } catch (error) {
    console.error('[GET /api/nse/index-details]', error);
    const message = error instanceof Error ? error.message : 'Index details fetch failed';
    return NextResponse.json({ error: 'Index details fetch failed', detail: message }, { status: 502 });
  }
}
