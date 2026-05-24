import tradingViewIndiaScreenerTodaysSpecialPayload from '@/lib/tradingview-india-screener-todays-special-payload.json';

const TRADINGVIEW_INDIA_SCAN_URL =
  'https://scanner.tradingview.com/india/scan?label-product=screener-stock';

export type TradingViewIndiaScreenerScreen = 'todays-special';

export type TradingViewIndiaScreenerRow = {
  s: string;
  d: unknown[];
};

export type TradingViewIndiaScreenerResponse = {
  totalCount: number;
  data: TradingViewIndiaScreenerRow[];
};

export type TradingViewScreenerListItem = {
  tvSymbol: string;
  ticker: string;
  exchange: string;
  companyName: string;
  close: number | null;
  changePct: number | null;
  isNse: boolean;
};

function toFiniteNumber(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

/** Maps one scanner row using column order from the Todays Special payload. */
export function tradingViewScreenerRowToListItem(
  row: TradingViewIndiaScreenerRow,
): TradingViewScreenerListItem {
  const payload = tradingViewIndiaScreenerTodaysSpecialPayload;
  const closeIndex = payload.columns.indexOf('close');
  const changeIndex =
    payload.columns.indexOf('change') >= 0
      ? payload.columns.indexOf('change')
      : payload.columns.indexOf('change|1W');
  const tvSymbol = row.s.trim();
  const colon = tvSymbol.indexOf(':');
  const exchange = colon >= 0 ? tvSymbol.slice(0, colon).toUpperCase() : '';
  const ticker = colon >= 0 ? tvSymbol.slice(colon + 1).trim().toUpperCase() : tvSymbol.toUpperCase();
  const meta = row.d[0];
  let companyName = ticker;
  if (meta && typeof meta === 'object' && !Array.isArray(meta)) {
    const m = meta as Record<string, unknown>;
    const desc = m.description;
    const name = m.name;
    if (typeof desc === 'string' && desc.trim()) companyName = desc.trim();
    else if (typeof name === 'string' && name.trim()) companyName = name.trim();
  }
  const close = closeIndex >= 0 ? toFiniteNumber(row.d[closeIndex]) : null;
  const changePct = changeIndex >= 0 ? toFiniteNumber(row.d[changeIndex]) : null;
  const isNse = exchange === 'NSE';
  return { tvSymbol, ticker, exchange, companyName, close, changePct, isNse };
}

/**
 * Runs the India stock screener on TradingView’s public scanner API (Todays Special screen).
 */
export async function fetchTradingViewIndiaScreenerStockScan(options?: {
  silent?: boolean;
}): Promise<TradingViewIndiaScreenerResponse> {
  const body = tradingViewIndiaScreenerTodaysSpecialPayload;

  const res = await fetch(TRADINGVIEW_INDIA_SCAN_URL, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const text = await res.text();
  if (!res.ok) {
    throw new Error(`TradingView India scan failed (${res.status}): ${text.slice(0, 500)}`);
  }

  const json = JSON.parse(text) as TradingViewIndiaScreenerResponse;

  return json;
}
