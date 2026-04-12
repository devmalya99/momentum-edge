import { NextResponse } from 'next/server';
import { nseFetchJson } from '@/lib/nse-fetch';

export const dynamic = 'force-dynamic';

const NSE_SEARCH_BASE = 'https://www.nseindia.com/api/NextApi/globalSearch/equity';

export type NseEquitySearchHit = {
  symbol: string;
  series: string;
  companyName: string;
  lastPrice?: number;
  change?: number;
  pChange?: number;
  segment: string;
  url?: string;
  webUrl?: string;
};

type NseSearchPayload = {
  data?: NseEquitySearchHit[];
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const raw = searchParams.get('symbol')?.trim() ?? '';
  if (raw.length < 2) {
    return NextResponse.json({ data: [] as NseEquitySearchHit[] });
  }

  const url = `${NSE_SEARCH_BASE}?symbol=${encodeURIComponent(raw)}`;
  const result = await nseFetchJson<NseSearchPayload>(url);

  if (!result.ok) {
    return NextResponse.json(
      { error: `NSE ${result.status}`, detail: result.detail, data: [] },
      { status: result.status >= 500 ? 502 : 400 },
    );
  }

  const rows = Array.isArray(result.data.data) ? result.data.data : [];
  return NextResponse.json({ data: rows });
}
