import type { KLineData } from 'klinecharts';

/** One minute price point from NSE `getEquityIntradayData` (`grapthData`). */
export type NseIntradayMinute = {
  timestamp: number;
  price: number;
};

type RawIntradayRow = unknown[];

function num(v: unknown): number {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

/** Parses NSE intraday graph rows: `[timestampMs, price, …]`. */
export function parseNseEquityIntradayGraph(rows: unknown): NseIntradayMinute[] {
  if (!Array.isArray(rows)) return [];
  const out: NseIntradayMinute[] = [];
  for (const row of rows) {
    if (!Array.isArray(row) || row.length < 2) continue;
    const ts = num(row[0]);
    const price = num(row[1]);
    if (ts <= 0 || price <= 0) continue;
    const timestamp = ts < 1e12 ? ts * 1000 : ts;
    out.push({ timestamp, price });
  }
  return out.toSorted((a, b) => a.timestamp - b.timestamp);
}

function istHourBucketKey(timestampMs: number): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hour12: false,
  }).formatToParts(new Date(timestampMs));
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}-${get('hour')}`;
}

/** Builds 1H OHLC candles from today's NSE minute prices (single trading session). */
export function aggregateIntradayMinutesTo1hKlines(minutes: NseIntradayMinute[]): KLineData[] {
  if (minutes.length === 0) return [];

  const groups = new Map<string, NseIntradayMinute[]>();
  for (const row of minutes) {
    const key = istHourBucketKey(row.timestamp);
    const bucket = groups.get(key);
    if (bucket) bucket.push(row);
    else groups.set(key, [row]);
  }

  const keys = [...groups.keys()].toSorted();
  return keys.map((key) => {
    const slice = groups.get(key)!;
    const prices = slice.map((r) => r.price);
    const open = prices[0];
    const close = prices[prices.length - 1];
    const high = Math.max(...prices);
    const low = Math.min(...prices);
    return {
      timestamp: slice[slice.length - 1]!.timestamp,
      open,
      high,
      low,
      close,
      volume: 0,
      turnover: 0,
    };
  });
}
