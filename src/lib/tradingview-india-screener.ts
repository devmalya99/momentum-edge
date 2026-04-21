import tradingViewIndiaScreenerPayload from '@/lib/tradingview-india-screener-payload.json';
import tradingViewIndiaScreener3mPayload from '@/lib/tradingview-india-screener-3m-payload.json';
import tradingViewIndiaScreener1yTopPayload from '@/lib/tradingview-india-screener-1y-top-payload.json';
import tradingViewIndiaScreenerShortTermPullbackPayload from '@/lib/tradingview-india-screener-short-term-pullback-payload.json';

const TRADINGVIEW_INDIA_SCAN_URL =
  'https://scanner.tradingview.com/india/scan?label-product=screener-stock';

export type TradingViewIndiaScreenerScreen = 'monthly' | '3m' | '1y-top' | 'short-term-pullback';

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

/** Maps one scanner row using column order from `tradingview-india-screener-payload.json`. */
export function tradingViewScreenerRowToListItem(row: TradingViewIndiaScreenerRow): TradingViewScreenerListItem {
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
  const closeRaw = row.d[1];
  const close =
    typeof closeRaw === 'number' && Number.isFinite(closeRaw)
      ? closeRaw
      : typeof closeRaw === 'string' && closeRaw.trim() !== ''
        ? Number(closeRaw)
        : null;
  const changeRaw = row.d[9];
  const changePct =
    typeof changeRaw === 'number' && Number.isFinite(changeRaw)
      ? changeRaw
      : typeof changeRaw === 'string' && changeRaw.trim() !== ''
        ? Number(changeRaw)
        : null;
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
  const body =
    screen === 'short-term-pullback'
      ? tradingViewIndiaScreenerShortTermPullbackPayload
      : screen === '1y-top'
        ? tradingViewIndiaScreener1yTopPayload
      : screen === '3m'
        ? tradingViewIndiaScreener3mPayload
        : tradingViewIndiaScreenerPayload;

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
  if (!options?.silent) {
    const serialized = JSON.stringify(json);
    const previewLimit = 12_000;
    console.log('[TradingView India screener] response summary', {
      totalCount: json.totalCount,
      rowCount: json.data?.length ?? 0,
      firstSymbols: json.data?.slice(0, 8).map((r) => r.s),
    });
    console.log(
      '[TradingView India screener] response JSON',
      serialized.length > previewLimit
        ? `${serialized.slice(0, previewLimit)}… (truncated, ${serialized.length} chars total)`
        : json,
    );
  }

  return json;
}
