import { NextResponse } from 'next/server';
import { nseFetchJson } from '@/lib/nse-fetch';
import { getNseIndiaClient } from '@/lib/nse-india-singleton';

export const dynamic = 'force-dynamic';

type StockRow = {
  symbol?: string;
  series?: string;
  identifier?: string;
  priority?: number;
  meta?: { symbol?: string; companyName?: string; segment?: string };
};

type NseStockIndicesPayload = {
  name?: string;
  data?: StockRow[];
};

function isEquityConstituent(row: StockRow, indexDisplayName: string): boolean {
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

/**
 * Prefer direct NSE JSON fetch (same pattern as equity-search). `stock-nse-india` session
 * cookies often fail in serverless, which yields empty `data` and no constituents.
 */
async function fetchStockIndices(index: string): Promise<NseStockIndicesPayload> {
  const enc = encodeURIComponent(index.trim().toUpperCase());
  const url = `https://www.nseindia.com/api/equity-stockIndices?index=${enc}`;
  const direct = await nseFetchJson<NseStockIndicesPayload>(url);
  if (direct.ok) {
    const body = direct.data;
    if (Array.isArray(body?.data) && body.data.length > 0) return body;
  }

  return (await getNseIndiaClient().getEquityStockIndices(index)) as NseStockIndicesPayload;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const index = searchParams.get('index')?.trim() ?? '';
  if (index.length < 2) {
    return NextResponse.json({ error: 'index required' }, { status: 400 });
  }

  try {
    const payload = await fetchStockIndices(index);
    const name = String(payload?.name ?? index).trim();
    const rows = Array.isArray(payload?.data) ? payload.data : [];

    const equities = rows
      .filter((r) => isEquityConstituent(r, name))
      .map((r) => {
        const symbol = String(r.symbol ?? r.meta?.symbol ?? '').trim().toUpperCase();
        const companyName = String(r.meta?.companyName ?? r.symbol ?? symbol).trim() || symbol;
        return { symbol, companyName };
      });

    return NextResponse.json({ indexName: name, constituents: equities });
  } catch (error) {
    console.error('[GET /api/nse/index-constituents]', error);
    const message = error instanceof Error ? error.message : 'Index constituents fetch failed';
    return NextResponse.json({ error: 'Index constituents fetch failed', detail: message }, { status: 502 });
  }
}
