import { NextResponse } from 'next/server';
import { nseFetchJson } from '@/lib/nse-fetch';

export const dynamic = 'force-dynamic';

export type NseEquityQuoteMeta = {
  symbol?: string;
  series?: string;
  companyName?: string;
  closePrice?: number;
  open?: number;
  dayHigh?: number;
  dayLow?: number;
  previousClose?: number;
  lastPrice?: number;
};

export type NseEquityQuoteOrderBook = {
  lastPrice?: number;
};

export type NseEquityQuoteRow = {
  orderBook?: NseEquityQuoteOrderBook;
  metaData?: NseEquityQuoteMeta;
  tradeInfo?: { lastPrice?: number; tickSize?: number };
  priceInfo?: { tickSize?: number };
  lastUpdateTime?: string;
};

type NseQuotePayload = {
  equityResponse?: NseEquityQuoteRow[];
};

/** NSE GetQuoteApi: EQ series only; only `symbol` varies per request. */
function buildQuoteUrl(symbol: string) {
  const params = new URLSearchParams({
    functionName: 'getSymbolData',
    marketType: 'N',
    series: 'EQ',
    symbol: symbol.toUpperCase(),
  });
  return `https://www.nseindia.com/api/NextApi/apiClient/GetQuoteApi?${params.toString()}`;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const symbol = searchParams.get('symbol')?.trim() ?? '';

  if (symbol.length < 1) {
    return NextResponse.json({ error: 'symbol required' }, { status: 400 });
  }

  const url = buildQuoteUrl(symbol);
  const result = await nseFetchJson<NseQuotePayload>(url);

  if (!result.ok) {
    return NextResponse.json(
      { error: `NSE ${result.status}`, detail: result.detail },
      { status: result.status >= 500 ? 502 : 400 },
    );
  }

  const rows = Array.isArray(result.data.equityResponse) ? result.data.equityResponse : [];
  if (rows.length === 0) {
    return NextResponse.json(
      { error: 'No quote data', detail: 'equityResponse empty' },
      { status: 404 },
    );
  }

  return NextResponse.json({ quote: rows[0] });
}
