import type { EquityHistoricalData, EquityHistoricalInfo } from 'stock-nse-india';
import type { KLineData } from 'klinecharts';

export type CustomCandlePeriod = '1d' | '2d' | '3d' | '5d' | '1w' | '3w' | '1m';

export type NseDailyBar = {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  /** NSE total traded value for the session (₹) */
  turnover: number;
};

function num(...candidates: unknown[]): number {
  for (const v of candidates) {
    if (v == null) continue;
    const n = typeof v === 'string' ? Number(v) : typeof v === 'number' ? v : Number(v);
    if (Number.isFinite(n)) return n;
  }
  return 0;
}

function parseMtimestamp(raw: string | undefined): number | null {
  if (!raw) return null;
  const t = Date.parse(raw);
  if (Number.isFinite(t)) return t;
  const d = new Date(raw);
  const u = d.getTime();
  return Number.isFinite(u) ? u : null;
}

function rowToBar(row: EquityHistoricalInfo | Record<string, unknown>): NseDailyBar | null {
  const r = row as EquityHistoricalInfo & Record<string, unknown>;
  const ts = parseMtimestamp(r.mtimestamp);
  if (ts == null) return null;
  const open = num(r.chOpeningPrice, r.CH_OPENING_PRICE);
  const high = num(r.chTradeHighPrice, r.CH_TRADE_HIGH_PRICE);
  const low = num(r.chTradeLowPrice, r.CH_TRADE_LOW_PRICE);
  const close = num(
    r.chClosingPrice,
    r.chLastTradedPrice,
    r.CH_CLOSING_PRICE,
    r.CH_LAST_TRADED_PRICE,
  );
  const volume = num(r.chTotTradedQty, r.CH_TOT_TRADED_QTY);
  const turnover = num(r.chTotTradedVal, r.CH_TOT_TRADED_VAL);
  return { timestamp: ts, open, high, low, close, volume, turnover };
}

/**
 * Flattens chunked `getEquityHistoricalData` payloads into ascending unique daily bars.
 */
export function flattenNseEquityHistoricalChunks(chunks: EquityHistoricalData[]): NseDailyBar[] {
  const byTs = new Map<number, NseDailyBar>();
  for (const chunk of chunks) {
    const rows = Array.isArray(chunk?.data) ? chunk.data : [];
    for (const row of rows) {
      const bar = rowToBar(row as EquityHistoricalInfo);
      if (!bar) continue;
      byTs.set(bar.timestamp, bar);
    }
  }
  return [...byTs.values()].sort((a, b) => a.timestamp - b.timestamp);
}

function mergeBucket(rows: NseDailyBar[], endTimestamp: number): KLineData {
  const open = rows[0].open;
  const close = rows[rows.length - 1].close;
  const high = Math.max(...rows.map((r) => r.high));
  const low = Math.min(...rows.map((r) => r.low));
  const volume = rows.reduce((s, r) => s + r.volume, 0);
  const turnover = rows.reduce((s, r) => s + r.turnover, 0);
  return { timestamp: endTimestamp, open, high, low, close, volume, turnover };
}

function bucketByTradingDays(sorted: NseDailyBar[], size: number): KLineData[] {
  if (size < 2) {
    return sorted.map((r) => ({
      timestamp: r.timestamp,
      open: r.open,
      high: r.high,
      low: r.low,
      close: r.close,
      volume: r.volume,
      turnover: r.turnover,
    }));
  }
  const out: KLineData[] = [];
  for (let i = 0; i < sorted.length; i += size) {
    const slice = sorted.slice(i, i + size);
    if (slice.length === 0) continue;
    out.push(mergeBucket(slice, slice[slice.length - 1].timestamp));
  }
  return out;
}

function bucketByCalendarMonth(sorted: NseDailyBar[]): KLineData[] {
  const groups = new Map<string, NseDailyBar[]>();
  for (const row of sorted) {
    const d = new Date(row.timestamp);
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
    const g = groups.get(key);
    if (g) g.push(row);
    else groups.set(key, [row]);
  }
  const keys = [...groups.keys()].sort();
  return keys.map((k) => {
    const slice = groups.get(k)!;
    return mergeBucket(slice, slice[slice.length - 1].timestamp);
  });
}

/**
 * Builds higher-timeframe candles from NSE daily rows.
 *
 * - `1d`: exchange daily bars as-is.
 * - `2d` / `3d` / `5d` / `1w` / `3w`: rolling buckets of 2, 3, 5, and 15 **trading sessions** (`5d` and `1w` are equivalent five-session buckets).
 * - `1m`: calendar month (UTC month boundaries).
 */
export function aggregateNseDailyToKlines(sorted: NseDailyBar[], period: CustomCandlePeriod): KLineData[] {
  if (sorted.length === 0) return [];
  switch (period) {
    case '1d':
      return bucketByTradingDays(sorted, 1);
    case '2d':
      return bucketByTradingDays(sorted, 2);
    case '3d':
      return bucketByTradingDays(sorted, 3);
    case '5d':
      return bucketByTradingDays(sorted, 5);
    case '1w':
      return bucketByTradingDays(sorted, 5);
    case '3w':
      return bucketByTradingDays(sorted, 15);
    case '1m':
      return bucketByCalendarMonth(sorted);
    default:
      return bucketByTradingDays(sorted, 1);
  }
}

export const CUSTOM_CANDLE_PERIOD_LABEL: Record<CustomCandlePeriod, string> = {
  '1d': '1D',
  '2d': '2D',
  '3d': '3D',
  '5d': '5D',
  '1w': '1W',
  '3w': '3W',
  '1m': '1M',
};
