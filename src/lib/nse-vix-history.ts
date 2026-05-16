import { format, parse, subDays } from 'date-fns';
import { nseFetchJson } from '@/lib/nse-fetch';
import type {
  NseVixHistoryPayload,
  NseVixHistoryRow,
  VixChartPoint,
  VixHistoryApiResponse,
} from '@/lib/nse-vix-types';

const NSE_VIX_URL = 'https://www.nseindia.com/api/historicalOR/vixhistory';
export const VIX_CHART_SESSIONS = 60;
const CALENDAR_LOOKBACK_DAYS = 95;

function formatNseQueryDate(d: Date): string {
  return format(d, 'dd-MM-yyyy');
}

function parseVixTimestamp(ts: string): Date | null {
  const raw = String(ts ?? '').trim();
  if (!raw) return null;
  const parsed = parse(raw, 'dd-MMM-yyyy', new Date());
  if (!Number.isNaN(parsed.getTime())) return parsed;
  const alt = new Date(raw);
  return Number.isNaN(alt.getTime()) ? null : alt;
}

function toChartPoint(row: NseVixHistoryRow): VixChartPoint | null {
  const d = parseVixTimestamp(row.EOD_TIMESTAMP);
  if (!d) return null;
  const close = Number(row.EOD_CLOSE_INDEX_VAL);
  if (!Number.isFinite(close)) return null;
  return {
    label: format(d, 'dd MMM'),
    tradeDate: format(d, 'yyyy-MM-dd'),
    close,
    open: Number(row.EOD_OPEN_INDEX_VAL) || close,
    high: Number(row.EOD_HIGH_INDEX_VAL) || close,
    low: Number(row.EOD_LOW_INDEX_VAL) || close,
    changePts: Number(row.VIX_PTS_CHG) || 0,
    changePct: Number(row.VIX_PERC_CHG) || 0,
    sortKey: d.getTime(),
  };
}

function normalizeRows(rows: NseVixHistoryRow[]): VixChartPoint[] {
  const points: VixChartPoint[] = [];
  for (const row of rows) {
    const p = toChartPoint(row);
    if (p) points.push(p);
  }
  points.sort((a, b) => a.sortKey - b.sortKey);
  const byDate = new Map<string, VixChartPoint>();
  for (const p of points) {
    byDate.set(p.tradeDate, p);
  }
  return Array.from(byDate.values()).sort((a, b) => a.sortKey - b.sortKey);
}

export async function fetchVixHistoryPayload(sessions: number): Promise<VixHistoryApiResponse> {
  const toDate = new Date();
  const fromDate = subDays(toDate, CALENDAR_LOOKBACK_DAYS);
  const from = formatNseQueryDate(fromDate);
  const to = formatNseQueryDate(toDate);
  const url = `${NSE_VIX_URL}?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;

  const result = await nseFetchJson<NseVixHistoryPayload>(url);
  if (!result.ok) {
    throw new Error(`VIX history fetch failed (${result.status}): ${result.detail}`);
  }

  const rows = Array.isArray(result.data.data) ? result.data.data : [];
  const all = normalizeRows(rows);
  const points = all.slice(-sessions);
  const latest = points.length > 0 ? points[points.length - 1]! : null;

  const payload: VixHistoryApiResponse = {
    points,
    latest,
    from,
    to,
    lookbackSessions: sessions,
  };

  if (points.length === 0) {
    throw new Error('No VIX history returned for the requested range');
  }

  return payload;
}
