/**
 * Fetches and normalizes raw Market Analyzer telemetry for a target index.
 * Invoked by MarketView on "Analyse Market" — not used by presentation components.
 */

import { fetchMarketTechnical } from '@/features/market-technical/api/fetch-market-technical';
import {
  emaSeries,
  macdSeries,
  rsiWilderSeries,
} from '@/features/market-technical/helper/technical-snapshot';
import { fetchVixHistory } from '@/features/vix-tracker/api/fetch-vix-history';
import { ANALYZER_LOOKBACK } from '@/lib/market-analyzer/constants';
import { chartTypeForTargetIndex, nseSymbolForTargetIndex } from '@/lib/market-analyzer/index-config';
import {
  buildAdRatioSeries,
  currentIstYear,
  normalizeNeonAdRows,
  type NseMonthlyAdBlock,
} from '@/lib/market-analyzer/build-ad-ratio-series';
import type { RawMacroTelemetrySnapshot, RawTelemetrySnapshot, TargetIndex } from '@/types/marketAnalyzer';

function lastFinite<T extends number | null>(arr: T[]): number | null {
  for (let i = arr.length - 1; i >= 0; i--) {
    const v = arr[i];
    if (v != null && Number.isFinite(v)) return v;
  }
  return null;
}

function requireMinLength(name: string, arr: number[], min: number): void {
  if (arr.length < min) {
    throw new Error(`${name}: need at least ${min} points, got ${arr.length}`);
  }
}

async function fetchAdHistory(): Promise<{ months: NseMonthlyAdBlock[]; neonRows: ReturnType<typeof normalizeNeonAdRows> }> {
  const [monthlyRes, neonRes] = await Promise.all([
    fetch('/api/nse/advance-decline-monthly', { cache: 'no-store' }),
    fetch(`/api/ad-ratio/daily?year=${currentIstYear()}`, { cache: 'no-store' }),
  ]);

  const monthlyPayload = (await monthlyRes.json()) as {
    months?: NseMonthlyAdBlock[];
    error?: string;
  };
  if (!monthlyRes.ok) {
    throw new Error(
      typeof monthlyPayload?.error === 'string'
        ? monthlyPayload.error
        : 'Failed to load advance/decline monthly history',
    );
  }

  const neonPayload = (await neonRes.json()) as { rows?: unknown; error?: string };
  const neonRows = normalizeNeonAdRows(neonPayload.rows);
  if (!neonRes.ok && neonRows.length === 0) {
    const msg =
      typeof neonPayload?.error === 'string' ? neonPayload.error : 'Failed to load Neon A/D daily';
    throw new Error(msg);
  }

  return {
    months: Array.isArray(monthlyPayload.months) ? monthlyPayload.months : [],
    neonRows,
  };
}

/**
 * VIX, breadth, and Nifty 500 only — for daily portfolio exposure (index-blind).
 */
export async function collectMacroTelemetry(): Promise<RawMacroTelemetrySnapshot> {
  const minVix = ANALYZER_LOOKBACK.vixSessions;
  const minPx = ANALYZER_LOOKBACK.indexCloseSessions;
  const minAd = ANALYZER_LOOKBACK.adSessions;

  const [vixData, nifty500Technical, adHistory] = await Promise.all([
    fetchVixHistory({ sessions: Math.max(minVix + 5, 30) }),
    fetchMarketTechnical({
      kind: 'index',
      symbol: nseSymbolForTargetIndex('NIFTY_500'),
      indexFlag: ANALYZER_LOOKBACK.technicalIndexFlag,
      chartType: chartTypeForTargetIndex('NIFTY_500'),
    }),
    fetchAdHistory(),
  ]);

  const vixHistory = vixData.points.map((p) => p.close).filter((c) => Number.isFinite(c));
  requireMinLength('VIX', vixHistory, minVix);

  const sortedBars = [...nifty500Technical.bars].sort((a, b) => a.t - b.t);
  const closes = sortedBars.map((b) => b.c);
  requireMinLength('Nifty 500 closes', closes, minPx);

  const e20 = emaSeries(closes, 20);
  const e50 = emaSeries(closes, 50);
  const e200 = emaSeries(closes, 200);
  const rsi = rsiWilderSeries(closes, 14);

  const snap = nifty500Technical.snapshot;
  const alignEma = (series: (number | null)[]): number[] =>
    closes.map((_, i) => {
      const v = series[i];
      return v != null && Number.isFinite(v) ? v : 0;
    });

  const adRatioHistory = buildAdRatioSeries(adHistory.months, adHistory.neonRows, 'rolling');
  requireMinLength('A/D ratio', adRatioHistory, minAd);

  return {
    vixHistory,
    adRatioHistory,
    nifty500CloseHistory: closes,
    nifty500Ema20History: alignEma(e20),
    nifty500Ema50History: alignEma(e50),
    nifty500Ema200History: alignEma(e200),
    nifty500CurrentPrice: snap.close,
    nifty500CurrentEma20: lastFinite(e20) ?? snap.ema20 ?? 0,
    nifty500CurrentEma50: lastFinite(e50) ?? snap.ema50 ?? 0,
    nifty500CurrentEma200: lastFinite(e200) ?? snap.ema200 ?? 0,
    nifty500RsiCurrent: snap.rsi14 ?? lastFinite(rsi) ?? 0,
  };
}

/**
 * Parallel fetch of VIX, index technicals, and A/D history for one target index.
 */
export async function collectMarketTelemetry(index: TargetIndex): Promise<RawTelemetrySnapshot> {
  const symbol = nseSymbolForTargetIndex(index);
  const chartType = chartTypeForTargetIndex(index);
  const minVix = ANALYZER_LOOKBACK.vixSessions;
  const minPx = ANALYZER_LOOKBACK.indexCloseSessions;
  const minAd = ANALYZER_LOOKBACK.adSessions;

  const [vixData, technical, adHistory] = await Promise.all([
    fetchVixHistory({ sessions: Math.max(minVix + 5, 30) }),
    fetchMarketTechnical({
      kind: 'index',
      symbol,
      indexFlag: ANALYZER_LOOKBACK.technicalIndexFlag,
      chartType,
    }),
    fetchAdHistory(),
  ]);

  const vixHistory = vixData.points.map((p) => p.close).filter((c) => Number.isFinite(c));
  requireMinLength('VIX', vixHistory, minVix);

  const sortedBars = [...technical.bars].sort((a, b) => a.t - b.t);
  const closes = sortedBars.map((b) => b.c);
  requireMinLength('Index closes', closes, minPx);

  const e20 = emaSeries(closes, 20);
  const e50 = emaSeries(closes, 50);
  const e200 = emaSeries(closes, 200);
  const rsi = rsiWilderSeries(closes, 14);
  const { line: macdL, signal: macdS, hist: macdH } = macdSeries(closes, 12, 26, 9);

  const snap = technical.snapshot;
  const currentPrice = snap.close;
  const currentEma20 = lastFinite(e20) ?? snap.ema20 ?? 0;
  const currentEma50 = lastFinite(e50) ?? snap.ema50 ?? 0;
  const currentEma200 = lastFinite(e200) ?? snap.ema200 ?? 0;
  const rsiCurrent = snap.rsi14 ?? lastFinite(rsi) ?? 0;
  const macdLine = snap.macdLine ?? lastFinite(macdL) ?? 0;
  const macdSignal = snap.macdSignal ?? lastFinite(macdS) ?? 0;
  const macdHist = snap.macdHist ?? lastFinite(macdH) ?? 0;

  const alignEma = (series: (number | null)[]): number[] =>
    closes.map((_, i) => {
      const v = series[i];
      return v != null && Number.isFinite(v) ? v : 0;
    });

  const ema20History = alignEma(e20);
  const ema50History = alignEma(e50);
  const ema200History = alignEma(e200);

  const adRatioHistory = buildAdRatioSeries(adHistory.months, adHistory.neonRows, 'rolling');
  requireMinLength('A/D ratio', adRatioHistory, minAd);

  return {
    vixHistory,
    indexCloseHistory: closes,
    adRatioHistory,
    currentPrice,
    currentEma20,
    currentEma50,
    currentEma200,
    ema20History,
    ema50History,
    ema200History,
    rsiCurrent,
    macdCurrent: {
      line: macdLine,
      signal: macdSignal,
      hist: macdHist,
    },
  };
}
