/**
 * Pure, synchronous token-reduction for Market Analyzer.
 * Runs on the main thread — O(n) over small session arrays (<200 points).
 */

import { ANALYZER_LOOKBACK } from '@/lib/market-analyzer/constants';
import type { CompressedPayload, RawTelemetrySnapshot, TargetIndex } from '@/types/marketAnalyzer';

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function tail<T>(arr: T[], count: number): T[] {
  if (count <= 0 || arr.length === 0) return [];
  return arr.slice(Math.max(0, arr.length - count));
}

/**
 * Sequential chunks → arithmetic mean per chunk (partial tail included).
 */
export function clubDays(data: number[], chunkLength: number): number[] {
  if (chunkLength < 1 || data.length === 0) return [];
  const out: number[] = [];
  for (let i = 0; i < data.length; i += chunkLength) {
    const chunk = data.slice(i, i + chunkLength);
    if (chunk.length === 0) continue;
    const mean = chunk.reduce((a, b) => a + b, 0) / chunk.length;
    out.push(round2(mean));
  }
  return out;
}

/** ((spot - ema) / ema) * 100 */
export function computeEmaDelta(spot: number, ema: number): number {
  if (!Number.isFinite(spot) || !Number.isFinite(ema) || ema <= 0) return 0;
  return round2(((spot - ema) / ema) * 100);
}

export type TimeWindowFlags = {
  daysToMonthlyExpiry: number;
  isWeekendRisk: boolean;
};

/** IST calendar context for monthly expiry and Thu/Fri weekend risk. */
export function evaluateTimeWindows(targetDate: Date = new Date()): TimeWindowFlags {
  const ist = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
  }).formatToParts(targetDate);

  const year = Number(ist.find((p) => p.type === 'year')?.value ?? 0);
  const month = Number(ist.find((p) => p.type === 'month')?.value ?? 1);
  const day = Number(ist.find((p) => p.type === 'day')?.value ?? 1);
  const weekday = ist.find((p) => p.type === 'weekday')?.value ?? '';

  const lastDay = new Date(year, month, 0).getDate();
  const daysToMonthlyExpiry = Math.max(0, lastDay - day);

  const isWeekendRisk = weekday === 'Thu' || weekday === 'Fri';

  return { daysToMonthlyExpiry, isWeekendRisk };
}

function formatAsOfIst(d: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

function buildEmaDeltaSeries(
  closes: number[],
  emaSeries: number[],
  sessionCount: number,
): number[] {
  const len = Math.min(closes.length, emaSeries.length);
  const deltas: number[] = [];
  for (let i = 0; i < len; i++) {
    const ema = emaSeries[i];
    if (!Number.isFinite(ema) || ema <= 0) continue;
    deltas.push(computeEmaDelta(closes[i], ema));
  }
  return tail(deltas, sessionCount);
}

/**
 * Bundles raw telemetry into a compact network payload for the LLM route.
 */
export function synthesizePayload(
  index: TargetIndex,
  telemetry: RawTelemetrySnapshot,
  referenceDate: Date = new Date(),
): CompressedPayload {
  const { daysToMonthlyExpiry, isWeekendRisk } = evaluateTimeWindows(referenceDate);

  const vixSlice = tail(telemetry.vixHistory, ANALYZER_LOOKBACK.vixSessions);
  const pxSlice = tail(telemetry.indexCloseHistory, ANALYZER_LOOKBACK.indexCloseSessions);
  const adSlice = tail(telemetry.adRatioHistory, ANALYZER_LOOKBACK.adSessions);

  const closesForEma = tail(telemetry.indexCloseHistory, ANALYZER_LOOKBACK.emaSessions + 50);
  const e20Slice = buildEmaDeltaSeries(
    closesForEma,
    tail(telemetry.ema20History, closesForEma.length),
    ANALYZER_LOOKBACK.emaSessions,
  );
  const e50Slice = buildEmaDeltaSeries(
    closesForEma,
    tail(telemetry.ema50History, closesForEma.length),
    ANALYZER_LOOKBACK.emaSessions,
  );
  const e200Slice = buildEmaDeltaSeries(
    closesForEma,
    tail(telemetry.ema200History, closesForEma.length),
    ANALYZER_LOOKBACK.emaSessions,
  );

  return {
    idx: index,
    asOf: formatAsOfIst(referenceDate),
    vix: clubDays(vixSlice, ANALYZER_LOOKBACK.vixClub),
    px: clubDays(pxSlice, ANALYZER_LOOKBACK.indexCloseClub),
    ad: clubDays(adSlice, ANALYZER_LOOKBACK.adClub),
    e20: clubDays(e20Slice, ANALYZER_LOOKBACK.emaClub),
    e50: clubDays(e50Slice, ANALYZER_LOOKBACK.emaClub),
    e200: clubDays(e200Slice, ANALYZER_LOOKBACK.emaClub),
    d20: computeEmaDelta(telemetry.currentPrice, telemetry.currentEma20),
    d50: computeEmaDelta(telemetry.currentPrice, telemetry.currentEma50),
    d200: computeEmaDelta(telemetry.currentPrice, telemetry.currentEma200),
    rsi: round2(telemetry.rsiCurrent),
    macd: {
      l: round2(telemetry.macdCurrent.line),
      s: round2(telemetry.macdCurrent.signal),
      h: round2(telemetry.macdCurrent.hist),
    },
    cal: {
      dte: daysToMonthlyExpiry,
      wknd: isWeekendRisk,
    },
  };
}
