import tradingViewIndiaScreenerPayload from '@/lib/tradingview-india-screener-payload.json';
import tradingViewIndiaScreener52hPayload from '@/lib/tradingview-india-screener-52h-payload.json';
import tradingViewIndiaScreenerNewMonthlyHighPayload from '@/lib/tradingview-india-screener-new-monthly-high-payload.json';
import tradingViewIndiaScreenerNewTrendPayload from '@/lib/tradingview-india-screener-new-trend-payload.json';
import tradingViewIndiaScreenerAtAllTimeHighPayload from '@/lib/tradingview-india-screener-at-all-time-high-payload.json';

const TRADINGVIEW_INDIA_SCAN_URL =
  'https://scanner.tradingview.com/india/scan?label-product=screener-stock';

export type TradingViewIndiaScreenerScreen =
  | '52h'
  | 'new-monthly-high'
  | 'new-trend'
  | 'at-all-time-high'
  | 'monthly';

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

function getScreenPayload(screen: TradingViewIndiaScreenerScreen) {
  if (screen === 'at-all-time-high') return tradingViewIndiaScreenerAtAllTimeHighPayload;
  if (screen === 'new-trend') return tradingViewIndiaScreenerNewTrendPayload;
  if (screen === 'new-monthly-high') return tradingViewIndiaScreenerNewMonthlyHighPayload;
  if (screen === '52h') return tradingViewIndiaScreener52hPayload;
  return tradingViewIndiaScreenerPayload;
}

/** Maps one scanner row using column order from the active screen payload. */
export function tradingViewScreenerRowToListItem(
  row: TradingViewIndiaScreenerRow,
  screen: TradingViewIndiaScreenerScreen,
): TradingViewScreenerListItem {
  const payload = getScreenPayload(screen);
  const closeIndex = payload.columns.indexOf('close');
  const changeIndex = payload.columns.indexOf('change');
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
 * Runs the India stock screener on TradingView’s public scanner API.
 * Logs a concise summary plus a truncated JSON preview (full payloads are large), unless `silent`.
 */
export async function fetchTradingViewIndiaScreenerStockScan(options?: {
  silent?: boolean;
  screen?: TradingViewIndiaScreenerScreen;
}): Promise<TradingViewIndiaScreenerResponse> {
  const screen: TradingViewIndiaScreenerScreen = options?.screen ?? 'monthly';
  const body = getScreenPayload(screen);

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
