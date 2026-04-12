'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  TrendingUp,
  TrendingDown,
  Info,
  RefreshCcw,
  AlertTriangle,
  CheckCircle2,
  Globe,
  ShieldCheck,
  BarChart3,
  Users,
} from 'lucide-react';
import { motion } from 'motion/react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import { format, parseISO, subMonths } from 'date-fns';
import TradingViewWidget from '@/components/TradingViewWidget';
import TradingViewScreenerWidget from '@/components/TradingViewScreenerWidget';
import LargeDealsPanel from '@/components/market/LargeDealsPanel';
import { NSE_MONTHLY_LOOKBACK } from '@/lib/nse-month-keys';

interface ADData {
  timestamp: string;
  advance: {
    count: {
      Advances: number;
      Unchange: number;
      Declines: number;
      Total: number;
    };
  };
}

type NseMonthlyRow = {
  ADD_DAY_STRING: string;
  ADD_DAY: string;
  ADD_ADVANCES: number;
  ADD_DECLINES: number;
  ADD_ADV_DCLN_RATIO: number;
  TIMESTAMP: string;
};

type MonthlySeriesBlock = {
  yearKey: string;
  data: NseMonthlyRow[];
  error?: string;
};

type FiiRatioRow = {
  date: string;
  indexLong: number;
  indexShort: number;
  fiiLong: number;
  fiiShort: number;
};

type ChartPoint = {
  label: string;
  /** Raw session A/D ratio from NSE monthly API; null when this day exists only from Neon (NSE lag). */
  ratio: number | null;
  /** Smoothed primary A/D (NSE, or Neon in months with stored dailies — see `primarySessionAdRatio`). */
  ratioPlot: number | null;
  advances: number;
  declines: number;
  monthKey: string;
  sortKey: number;
  /** Asia/Kolkata session date `YYYY-MM-DD` (Neon `trade_date`). */
  tradeDate: string;
  /** True when this point was added from Neon because NSE monthly had not published that session yet. */
  neonOnlyDay?: boolean;
  /** Neon snapshot A/D for this session date (when loaded for the selected chart year). */
  neonRatio: number | null;
  /** Neon A/D for the same calendar day one month earlier. */
  oldMonthNeonRatio: number | null;
  oldMonthNeonRatioPlot: number | null;
};

type NeonDailyRow = {
  trade_date: string;
  ad_ratio: number | null;
  advances: number;
  declines: number;
};

/** Postgres / JSON sometimes returns numerics as strings. */
function toFiniteNumber(v: unknown): number | null {
  if (v == null) return null;
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function normalizeNeonApiRows(raw: unknown): NeonDailyRow[] {
  if (!Array.isArray(raw)) return [];
  const out: NeonDailyRow[] = [];
  for (const item of raw) {
    if (typeof item !== 'object' || item === null) continue;
    const o = item as Record<string, unknown>;
    const td = typeof o.trade_date === 'string' ? o.trade_date : '';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(td)) continue;
    const ad = toFiniteNumber(o.ad_ratio);
    if (ad == null) continue;
    out.push({
      trade_date: td,
      ad_ratio: ad,
      advances: toFiniteNumber(o.advances) ?? 0,
      declines: toFiniteNumber(o.declines) ?? 0,
    });
  }
  return out;
}

function currentCalendarYearIst(): number {
  return parseInt(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
    }).format(new Date()),
    10,
  );
}

/** True if `tradeDate` (YYYY-MM-DD) falls in the current Asia/Kolkata calendar month. */
function isTradeDateInCurrentMonthYearIst(tradeDate: string): boolean {
  const now = new Date();
  const y = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
  }).format(now);
  const m = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    month: '2-digit',
  }).format(now);
  return tradeDate.startsWith(`${y}-${m}-`);
}

function formatDateIst(d: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

const SMOOTH_PERIOD_MIN = 3;
const SMOOTH_PERIOD_MAX = 10;
const SMOOTH_PERIOD_OPTIONS = Array.from(
  { length: SMOOTH_PERIOD_MAX - SMOOTH_PERIOD_MIN + 1 },
  (_, i) => SMOOTH_PERIOD_MIN + i,
);

/**
 * Trailing mean on chronological ratios: at index i, average of indices
 * max(0, i - window + 1) … i (partial window at the start of the series).
 */
function trailingSessionAvg(values: number[], window: number): number[] {
  const w = Math.max(1, Math.min(60, Math.floor(window)));
  return values.map((_, i, arr) => {
    const start = Math.max(0, i - w + 1);
    const slice = arr.slice(start, i + 1);
    return slice.reduce((a, b) => a + b, 0) / slice.length;
  });
}

/** Like `trailingSessionAvg`, but ignores nulls in the window (partial average). */
function trailingSessionAvgNullable(values: (number | null)[], window: number): (number | null)[] {
  const w = Math.max(1, Math.min(60, Math.floor(window)));
  return values.map((_, i, arr) => {
    const start = Math.max(0, i - w + 1);
    const slice = arr.slice(start, i + 1).filter((x): x is number => x != null && Number.isFinite(x));
    if (slice.length === 0) return null;
    return slice.reduce((a, b) => a + b, 0) / slice.length;
  });
}

/**
 * Months (`YYYY-MM`) that have at least one Neon snapshot in the selected chart year.
 * For those months we prefer Neon for the primary A/D line when a daily Neon value exists,
 * so the plot stays continuous when NSE monthly lags (e.g. March → April).
 */
function neonMonthPrefixesForYear(
  neonRows: NeonDailyRow[],
  chartYear: number,
): Set<string> {
  const yp = `${chartYear}-`;
  const s = new Set<string>();
  for (const r of neonRows) {
    if (!r.trade_date.startsWith(yp)) continue;
    const ad = toFiniteNumber(r.ad_ratio);
    if (ad == null) continue;
    s.add(r.trade_date.slice(0, 7));
  }
  return s;
}

function primarySessionAdRatio(
  tradeDate: string,
  nseRatio: number | null,
  neonRatio: number | null,
  chartYear: number | 'rolling',
  neonMonthPrefixes: Set<string>,
  lastNseTradeDate: string,
): number | null {
  const nn = toFiniteNumber(neonRatio);
  const ns = toFiniteNumber(nseRatio);

  if (chartYear === 'rolling') {
    if (nn != null) {
      if (ns == null) return nn;
      if (isTradeDateInCurrentMonthYearIst(tradeDate)) return nn;
      if (lastNseTradeDate && tradeDate > lastNseTradeDate) return nn;
    }
    if (ns != null) return ns;
    return nn;
  }
  const ym = tradeDate.slice(0, 7);
  if (neonMonthPrefixes.has(ym) && nn != null) {
    return nn;
  }
  if (ns != null) return ns;
  return nn;
}

export default function MarketView() {
  const [data, setData] = useState<ADData | null>(null);
  const [liveLoading, setLiveLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [historyMonths, setHistoryMonths] = useState<MonthlySeriesBlock[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [smoothPeriod, setSmoothPeriod] = useState(3);
  /** Rolling window (server default / env) vs one calendar year (Jan–Dec). */
  const [chartYear, setChartYear] = useState<number | 'rolling'>('rolling');

  const [fiiRatioRows, setFiiRatioRows] = useState<FiiRatioRow[]>([]);
  const [fiiLoading, setFiiLoading] = useState(true);
  const [fiiError, setFiiError] = useState<string | null>(null);

  const [neonRows, setNeonRows] = useState<NeonDailyRow[]>([]);
  const [neonLoading, setNeonLoading] = useState(false);
  const [neonError, setNeonError] = useState<string | null>(null);
  /** Full 0–100% oscillator scale vs zoom-to-data for small moves. */
  const [fiiYAxisFullRange, setFiiYAxisFullRange] = useState(true);

  const [largeDealsReloadToken, setLargeDealsReloadToken] = useState(0);

  const chartYearOptions = useMemo(() => {
    const cy = new Date().getFullYear();
    const oldest = Math.max(1990, cy - 25);
    const years: number[] = [];
    for (let y = cy; y >= oldest; y--) years.push(y);
    return years;
  }, []);

  const loadLive = useCallback(async () => {
    setLiveLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/nse/advance-decline', { cache: 'no-store' });
      const payload = await response.json();

      if (!response.ok) {
        const msg =
          typeof payload?.error === 'string'
            ? payload.error
            : 'Failed to load NSE advance/decline data.';
        const detail =
          typeof payload?.detail === 'string' && payload.detail.length > 0
            ? ` ${payload.detail}`
            : '';
        throw new Error(msg + detail);
      }

      setData(payload as ADData);
    } catch (err: unknown) {
      console.error(err);
      const message = err instanceof Error ? err.message : 'Request failed.';
      setError(
        `Could not fetch live NSE data. ${message} NSE may rate-limit or require a fresh session; try again shortly.`,
      );
    } finally {
      setLiveLoading(false);
    }
  }, []);

  const loadHistory = useCallback(async () => {
    setHistoryLoading(true);
    setHistoryError(null);
    try {
      const qs = chartYear === 'rolling' ? '' : `?year=${chartYear}`;
      const response = await fetch(`/api/nse/advance-decline-monthly${qs}`, {
        cache: 'no-store',
      });
      const payload = await response.json();

      if (!response.ok) {
        const msg =
          typeof payload?.error === 'string'
            ? payload.error
            : 'Failed to load historical advance/decline.';
        throw new Error(msg);
      }

      setHistoryMonths(Array.isArray(payload.months) ? payload.months : []);
    } catch (err: unknown) {
      console.error(err);
      const message = err instanceof Error ? err.message : 'Request failed.';
      setHistoryError(message);
      setHistoryMonths([]);
    } finally {
      setHistoryLoading(false);
    }
  }, [chartYear]);

  const loadFiiRatio = useCallback(async () => {
    setFiiLoading(true);
    setFiiError(null);
    try {
      const response = await fetch('/api/fii-ratio', { cache: 'no-store' });
      const payload = await response.json();
      if (!response.ok) {
        const msg =
          typeof payload?.error === 'string' ? payload.error : 'Failed to load FII ratio data.';
        throw new Error(msg);
      }
      setFiiRatioRows(Array.isArray(payload.data) ? payload.data : []);
    } catch (err: unknown) {
      console.error(err);
      const message = err instanceof Error ? err.message : 'Request failed.';
      setFiiError(message);
      setFiiRatioRows([]);
    } finally {
      setFiiLoading(false);
    }
  }, []);

  const loadNeonDaily = useCallback(async () => {
    setNeonLoading(true);
    setNeonError(null);
    try {
      const yearForApi =
        chartYear === 'rolling' ? currentCalendarYearIst() : chartYear;
      const response = await fetch(`/api/ad-ratio/daily?year=${yearForApi}`, {
        cache: 'no-store',
      });
      const payload = await response.json();
      if (!response.ok) {
        const msg =
          typeof payload?.error === 'string' ? payload.error : 'Failed to load Neon A/D history.';
        throw new Error(msg);
      }
      setNeonRows(normalizeNeonApiRows(payload.rows));
      if (typeof payload?.error === 'string' && payload.error.length > 0) {
        setNeonError(payload.error);
      }
    } catch (err: unknown) {
      console.error(err);
      const message = err instanceof Error ? err.message : 'Request failed.';
      setNeonError(message);
      setNeonRows([]);
    } finally {
      setNeonLoading(false);
    }
  }, [chartYear]);

  const refreshAll = useCallback(() => {
    void loadLive();
    void loadHistory();
    void loadFiiRatio();
    void loadNeonDaily();
    setLargeDealsReloadToken((t) => t + 1);
  }, [loadLive, loadHistory, loadFiiRatio, loadNeonDaily]);

  useEffect(() => {
    void loadLive();
  }, [loadLive]);

  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  useEffect(() => {
    void loadFiiRatio();
  }, [loadFiiRatio]);

  useEffect(() => {
    void loadNeonDaily();
  }, [loadNeonDaily]);

  const neonByDate = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of neonRows) {
      const ad = toFiniteNumber(r.ad_ratio);
      if (ad != null) {
        m.set(r.trade_date, ad);
      }
    }
    return m;
  }, [neonRows]);

  const neonMonthPrefixes = useMemo(() => {
    if (chartYear === 'rolling') return new Set<string>();
    return neonMonthPrefixesForYear(neonRows, chartYear);
  }, [neonRows, chartYear]);

  /** Latest NSE session date (IST) in the loaded monthly series — used to append Neon days in rolling mode. */
  const maxNseTradeDate = useMemo(() => {
    let max = '';
    for (const block of historyMonths) {
      for (const row of block.data) {
        const ts = new Date(row.TIMESTAMP);
        if (Number.isNaN(ts.getTime())) continue;
        const td = formatDateIst(ts);
        if (td > max) max = td;
      }
    }
    return max;
  }, [historyMonths]);

  const fiiChartData = useMemo(() => {
    return [...fiiRatioRows].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
    );
  }, [fiiRatioRows]);

  /** FII long %: Y-axis fits data + padding so the line uses chart height (clamped to 0–100). */
  const fiiLongYDomain = useMemo((): [number, number] => {
    const vals = fiiChartData
      .map((d) => d.fiiLong)
      .filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
    if (vals.length === 0) return [0, 100];
    const dataMin = Math.min(...vals);
    const dataMax = Math.max(...vals);
    const span = Math.max(dataMax - dataMin, 0.5);
    const pad = Math.max(2, span * 0.14, 3);
    let low = Math.max(0, dataMin - pad * 0.4);
    let high = Math.min(100, dataMax + pad);
    if (high <= low) return [0, Math.min(100, dataMax + 5)];
    if (high - low < 5) {
      const mid = (low + high) / 2;
      low = Math.max(0, mid - 2.5);
      high = Math.min(100, mid + 2.5);
    }
    return [low, high];
  }, [fiiChartData]);

  const fiiLongShowsNeutral50 =
    fiiLongYDomain[0] <= 50 && fiiLongYDomain[1] >= 50;

  /** Long % change per step over the last up-to-10 points (proxy for recent direction). */
  const fiiRecentSlopeInfo = useMemo(() => {
    const window = 10;
    if (fiiChartData.length < 2) {
      return { slope: null as number | null, pointCount: 0, stepCount: 0 };
    }
    const slice = fiiChartData.slice(-Math.min(window, fiiChartData.length));
    if (slice.length < 2) {
      return { slope: null as number | null, pointCount: slice.length, stepCount: 0 };
    }
    const first = slice[0].fiiLong;
    const last = slice[slice.length - 1].fiiLong;
    const stepCount = slice.length - 1;
    return {
      slope: (last - first) / stepCount,
      pointCount: slice.length,
      stepCount,
    };
  }, [fiiChartData]);

  const fiiLatestRow = useMemo(
    () => (fiiChartData.length > 0 ? fiiChartData[fiiChartData.length - 1] : null),
    [fiiChartData],
  );

  const fiiLiveGuidance = useMemo(() => {
    if (!fiiLatestRow || data == null) return null;
    const fl = fiiLatestRow.fiiLong;
    if (!Number.isFinite(fl)) return null;
    const d = data.advance?.count?.Declines ?? 0;
    const a = data.advance?.count?.Advances ?? 0;
    if (a === 0 && d === 0) return null;
    const adRatio = d > 0 ? a / d : a > 0 ? 99 : 0;
    const slope = fiiRecentSlopeInfo.slope;
    const risingFii = slope !== null && slope > 0.12;
    const fallingFii = slope !== null && slope < -0.12;

    const box = (
      title: string,
      detail: string,
      tone: 'amber' | 'emerald' | 'rose' | 'violet' | 'slate',
    ) => {
      const ring = {
        amber: 'border-amber-500/25 bg-amber-500/[0.06]',
        emerald: 'border-emerald-500/25 bg-emerald-500/[0.06]',
        rose: 'border-rose-500/25 bg-rose-500/[0.06]',
        violet: 'border-violet-500/25 bg-violet-500/[0.06]',
        slate: 'border-white/10 bg-white/[0.03]',
      }[tone];
      const titleColor = {
        amber: 'text-amber-200/95',
        emerald: 'text-emerald-200/95',
        rose: 'text-rose-200/95',
        violet: 'text-violet-200/95',
        slate: 'text-gray-300',
      }[tone];
      return { title, detail, ring, titleColor };
    };

    if (risingFii && adRatio < 1) {
      return box(
        'Possible “trap” backdrop',
        'FII long % has been rising recently, but live A/D is below 1.0. That mix often means index futures can lean long while the wider market struggles—avoid treating strength as unanimous participation.',
        'amber',
      );
    }
    if (fl < 25 && adRatio >= 1) {
      return box(
        'Capitulation-style alignment',
        'FII long % is very low (heavy short skew in futures), while breadth is at least neutral-to-strong today. Historically this is where short-covering or relief rallies show up more often—but confirm with price and trend, not this alone.',
        'emerald',
      );
    }
    if (fl > 50 && adRatio > 1) {
      return box(
        'Aligned risk-on context',
        'FII long % is above half and breadth is positive. When both stay aligned, fighting upside in futures can be painful—still use your rules; this is background, not an entry trigger.',
        'violet',
      );
    }
    if (fl >= 70) {
      return box(
        'Crowded long zone',
        'Very high FII long % means a lot of upside conviction is already in the book—useful as a contrarian heads-up when the series rolls over from a peak. Pair with breadth and price.',
        'rose',
      );
    }
    if (fl <= 20) {
      return box(
        'Heavy short skew',
        'Very low FII long % usually means aggressive short positioning; squeezes often start when shorts have less left to sell. Watch for a turn in this line together with breadth improving.',
        'emerald',
      );
    }
    if (fl >= 40 && fl <= 60) {
      if (risingFii) {
        return box(
          'Middle band: FII tide improving',
          'Between ~40–60%, the slope matters: rising FII long % suggests institutions are leaning less bearish in index futures. Do not fight that drift unless breadth disagrees.',
          'slate',
        );
      }
      if (fallingFii) {
        return box(
          'Middle band: FII tide weakening',
          'FII long % is falling through the middle of the range—often momentum toward more defensive futures positioning. Respect it unless breadth is strongly supportive.',
          'slate',
        );
      }
    }
    return box(
      'No single headline',
      'FII positioning is one input. Compare this series with the A/D trend above and live breadth; extremes and divergences matter more than any one print.',
      'slate',
    );
  }, [fiiLatestRow, fiiRecentSlopeInfo, data]);

  type ChartBaseRow = Omit<
    ChartPoint,
    'ratioPlot' | 'neonRatio' | 'oldMonthNeonRatio' | 'oldMonthNeonRatioPlot'
  >;

  const chartBase = useMemo(() => {
    const nseRows: ChartBaseRow[] = [];
    for (const block of historyMonths) {
      for (const row of block.data) {
        const ts = new Date(row.TIMESTAMP);
        if (Number.isNaN(ts.getTime())) continue;
        nseRows.push({
          label: row.ADD_DAY_STRING,
          ratio: row.ADD_ADV_DCLN_RATIO,
          advances: row.ADD_ADVANCES,
          declines: row.ADD_DECLINES,
          monthKey: block.yearKey,
          sortKey: ts.getTime(),
          tradeDate: formatDateIst(ts),
        });
      }
    }

    if (neonRows.length === 0) {
      return nseRows.sort((a, b) => a.sortKey - b.sortKey);
    }

    const byTradeDate = new Map<string, ChartBaseRow>();
    for (const p of nseRows) {
      if (!byTradeDate.has(p.tradeDate)) {
        byTradeDate.set(p.tradeDate, p);
      }
    }

    const yPrefix = chartYear !== 'rolling' ? `${chartYear}-` : '';
    for (const nr of neonRows) {
      const ad = toFiniteNumber(nr.ad_ratio);
      if (ad == null) continue;
      if (byTradeDate.has(nr.trade_date)) continue;

      if (chartYear !== 'rolling') {
        if (!nr.trade_date.startsWith(yPrefix)) continue;
      } else {
        if (maxNseTradeDate && nr.trade_date <= maxNseTradeDate) continue;
      }

      const d = parseISO(`${nr.trade_date}T12:00:00`);
      if (Number.isNaN(d.getTime())) continue;

      byTradeDate.set(nr.trade_date, {
        label: format(d, 'dd MMM yyyy'),
        ratio: null,
        advances: toFiniteNumber(nr.advances) ?? 0,
        declines: toFiniteNumber(nr.declines) ?? 0,
        monthKey: format(d, 'MMM-yyyy').toUpperCase(),
        sortKey: d.getTime(),
        tradeDate: nr.trade_date,
        neonOnlyDay: true,
      });
    }

    return Array.from(byTradeDate.values()).sort((a, b) => a.sortKey - b.sortKey);
  }, [historyMonths, neonRows, chartYear, maxNseTradeDate]);

  const chartSeries = useMemo(() => {
    const w = Math.min(SMOOTH_PERIOD_MAX, Math.max(SMOOTH_PERIOD_MIN, Math.round(smoothPeriod)));
    const ratios = chartBase.map((r) => r.ratio);
    const smoothedNse: (number | null)[] = ratios.some((x) => x == null)
      ? trailingSessionAvgNullable(ratios, w)
      : trailingSessionAvg(ratios as number[], w);

    const overlayNeon = neonByDate.size > 0;

    if (!overlayNeon) {
      return chartBase.map((p, i) => ({
        ...p,
        ratioPlot: smoothedNse[i] ?? null,
        neonRatio: null,
        oldMonthNeonRatio: null,
        oldMonthNeonRatioPlot: null,
      }));
    }

    const neonVals = chartBase.map((p) => neonByDate.get(p.tradeDate) ?? null);
    const oldMonthVals = chartBase.map((p) => {
      try {
        const prevKey = format(subMonths(parseISO(p.tradeDate), 1), 'yyyy-MM-dd');
        return neonByDate.get(prevKey) ?? null;
      } catch {
        return null;
      }
    });
    const oldMonthSmoothed = trailingSessionAvgNullable(oldMonthVals, w);

    const primarySessions = chartBase.map((p, i) =>
      primarySessionAdRatio(
        p.tradeDate,
        p.ratio,
        neonVals[i],
        chartYear,
        neonMonthPrefixes,
        maxNseTradeDate,
      ),
    );
    const smoothedPrimary = trailingSessionAvgNullable(primarySessions, w);

    return chartBase.map((p, i) => ({
      ...p,
      ratioPlot: smoothedPrimary[i] ?? null,
      neonRatio: neonVals[i],
      oldMonthNeonRatio: oldMonthVals[i],
      oldMonthNeonRatioPlot: oldMonthSmoothed[i],
    }));
  }, [chartBase, smoothPeriod, chartYear, neonByDate, neonMonthPrefixes, maxNseTradeDate]);

  const historySummary = useMemo(() => {
    if (chartYear !== 'rolling') {
      return `${chartYear} (Jan–Dec)`;
    }
    if (historyMonths.length === 0) return '';
    return historyMonths.map((m) => m.yearKey).join(' · ');
  }, [chartYear, historyMonths]);

  const advances = data?.advance?.count?.Advances ?? 0;
  const declines = data?.advance?.count?.Declines ?? 0;
  const ratio = declines > 0 ? advances / declines : 0;

  const getBreadthStatus = (r: number) => {
    if (r > 1.5)
      return {
        label: 'Strong Bullish',
        color: 'text-green-400',
        bg: 'bg-green-500/10',
        border: 'border-green-500/20',
        icon: TrendingUp,
      };
    if (r >= 1.0)
      return {
        label: 'Mildly Bullish',
        color: 'text-blue-400',
        bg: 'bg-blue-500/10',
        border: 'border-blue-500/20',
        icon: TrendingUp,
      };
    if (r >= 0.7)
      return {
        label: 'Neutral/Weak',
        color: 'text-yellow-400',
        bg: 'bg-yellow-500/10',
        border: 'border-yellow-500/20',
        icon: Info,
      };
    return {
      label: 'Bearish',
      color: 'text-red-400',
      bg: 'bg-red-500/10',
      border: 'border-red-500/20',
      icon: TrendingDown,
    };
  };

  const status = getBreadthStatus(ratio);

  const getScoringSuggestion = (r: number) => {
    if (r > 2.0) return '9–10 (Extremely High Confidence)';
    if (r > 1.0) return '6–8 (Good Follow-through Likely)';
    if (r >= 0.7) return '4–5 (Caution: Mixed Market)';
    return '0–3 (Avoid: High Failure Rate)';
  };

  const busy = liveLoading || historyLoading;
  const refreshSpinning = busy || fiiLoading || neonLoading;

  /** Prior-month reference line (teal); primary A/D already blends NSE + Neon in `ratioPlot`. */
  const showPriorMonthNeonLine = neonByDate.size > 0;

  const chartUsesNeonBlend =
    neonByDate.size > 0 && (chartYear !== 'rolling' ? neonMonthPrefixes.size > 0 : true);

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <Globe className="text-blue-400" size={32} />
            Market View
          </h1>
          <p className="text-gray-400 mt-1">Live Advance/Decline ratio from NSE India.</p>
        </div>
        <button
          type="button"
          onClick={refreshAll}
          disabled={busy}
          className="p-3 rounded-2xl bg-white/5 border border-white/5 hover:bg-white/10 transition-all text-gray-400 hover:text-white disabled:opacity-50"
        >
          <RefreshCcw size={20} className={refreshSpinning ? 'animate-spin' : ''} />
        </button>
      </div>

      {error && (
        <div className="p-4 rounded-2xl bg-amber-500/5 border border-amber-500/10 flex items-start gap-3">
          <AlertTriangle className="text-amber-500 shrink-0" size={20} />
          <div className="space-y-1">
            <p className="text-sm text-gray-300 font-medium">{error}</p>
            <p className="text-xs text-gray-500">
              Data is loaded through your Next.js server. If errors persist, NSE may be blocking or
              throttling the upstream request.
            </p>
          </div>
        </div>
      )}

      {liveLoading ? (
        <div className="h-64 flex flex-col items-center justify-center gap-4 bg-[#161618] rounded-3xl border border-white/5">
          <div className="w-10 h-10 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin" />
          <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">
            Fetching NSE Breadth...
          </span>
        </div>
      ) : data ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="p-8 rounded-3xl bg-[#161618] border border-white/5 space-y-6"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-gray-500 uppercase tracking-widest">Market Breadth</h2>
              <span className="text-[10px] text-gray-600 font-medium">
                As of {data?.timestamp ?? '—'}
              </span>
            </div>

            <div className="flex items-end gap-3">
              <span className="text-6xl font-black tracking-tight">{ratio.toFixed(2)}</span>
              <span className="text-sm text-gray-500 font-bold mb-2">A/D Ratio</span>
            </div>

            <div
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-2xl border ${status.bg} ${status.color} ${status.border} font-bold`}
            >
              <status.icon size={18} />
              {status.label}
            </div>

            <div className="grid grid-cols-2 gap-4 pt-4">
              <div className="p-4 rounded-2xl bg-[#0a0a0b] border border-white/5 text-center">
                <div className="text-[10px] text-gray-500 font-bold uppercase mb-1">Advances</div>
                <div className="text-2xl font-black text-green-400">{advances}</div>
              </div>
              <div className="p-4 rounded-2xl bg-[#0a0a0b] border border-white/5 text-center">
                <div className="text-[10px] text-gray-500 font-bold uppercase mb-1">Declines</div>
                <div className="text-2xl font-black text-red-400">{declines}</div>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="p-8 rounded-3xl bg-blue-600/5 border border-blue-500/10 space-y-6"
          >
            <h2 className="text-sm font-bold text-blue-400 uppercase tracking-widest flex items-center gap-2">
              <Info size={16} /> Edge Intelligence
            </h2>

            <div className="space-y-6">
              <div className="space-y-4">
                <h3 className="text-lg font-bold">Suggested Scoring Rule</h3>
                <div className="p-4 rounded-2xl bg-[#0a0a0b] border border-white/5">
                  <div className="text-[10px] text-gray-500 font-bold uppercase mb-1">
                    Market Breadth Strength (A/D)
                  </div>
                  <div className="text-xl font-black text-blue-400">{getScoringSuggestion(ratio)}</div>
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="text-sm font-bold text-gray-300">Actionable Insights</h3>
                <div className="space-y-3">
                  <div className="flex gap-3">
                    {ratio > 1.5 ? (
                      <CheckCircle2 className="text-green-400 shrink-0" size={18} />
                    ) : (
                      <div className="w-[18px]" />
                    )}
                    <p className="text-sm text-gray-400 italic">
                      &quot;Breakouts are more reliable in this environment. High probability of
                      extension.&quot;
                    </p>
                  </div>
                  <div className="flex gap-3">
                    {ratio < 0.7 ? (
                      <AlertTriangle className="text-red-400 shrink-0" size={18} />
                    ) : (
                      <div className="w-[18px]" />
                    )}
                    <p className="text-sm text-gray-400 italic">
                      &quot;Caution: False moves increase significantly. Tighten stops or avoid new
                      entries.&quot;
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      ) : (
        <div className="h-64 flex flex-col items-center justify-center gap-4 bg-[#161618] rounded-3xl border border-white/5">
          <TrendingDown className="text-gray-600" size={48} />
          <p className="text-gray-500 font-medium">Failed to initialize NSE data connection.</p>
          <button
            type="button"
            onClick={loadLive}
            className="px-6 py-2 rounded-xl bg-blue-600 text-white font-bold text-sm hover:bg-blue-500 transition-all"
          >
            Retry Connection
          </button>
        </div>
      )}

      <LargeDealsPanel reloadToken={largeDealsReloadToken} />

      <div className="p-8 rounded-3xl bg-[#161618] border border-white/5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-bold text-gray-500 uppercase tracking-widest flex items-center gap-2 flex-wrap">
              <Users className="text-violet-400" size={16} aria-hidden />
              FII long–short mix (index futures)
              <span className="relative inline-flex group">
                <button
                  type="button"
                  className="rounded-lg p-1 text-gray-500 outline-none transition-colors hover:text-violet-400 focus-visible:ring-2 focus-visible:ring-violet-500/50"
                  aria-label="How to interpret this chart"
                >
                  <Info size={16} aria-hidden />
                </button>
                <div
                  role="tooltip"
                  className="invisible absolute left-0 top-full z-50 mt-2 w-[min(24rem,calc(100vw-2.5rem))] max-h-[min(70vh,28rem)] overflow-y-auto rounded-2xl border border-white/10 bg-[#0f0f11] p-4 text-left shadow-2xl shadow-black/50 opacity-0 transition-all duration-200 group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100"
                >
                  <p className="text-[11px] font-bold uppercase tracking-wider text-violet-300/90 mb-2">
                    How to read this chart
                  </p>
                  <ul className="space-y-2.5 text-xs text-gray-400 leading-relaxed list-disc pl-4 marker:text-violet-500/70">
                    <li>
                      <span className="text-gray-300 font-medium">0–100% oscillator</span> — Long %
                      is the share of reported FII index-futures positioning on the long side (long + short
                      ≈ 100%). Think of it as positioning pressure, not a price forecast.
                    </li>
                    <li>
                      <span className="text-gray-300 font-medium">Extremes (contrarian)</span> — Very
                      high long % (often 70%+) can mean crowded upside; very low (often ~20% or below)
                      can mean crowded shorts and eventual cover rallies. The{' '}
                      <span className="text-gray-300">rollover</span> off a peak or trough matters as
                      much as the level.
                    </li>
                    <li>
                      <span className="text-gray-300 font-medium">Middle band (~40–60%)</span> — Treat
                      the <span className="text-gray-300">slope</span> as momentum: rising long % → less
                      bearish / more constructive in futures; falling → the opposite.
                    </li>
                    <li>
                      Always pair with <span className="text-gray-300">NSE breadth</span> (this page’s
                      A/D ratio). The card below the chart summarizes common combinations; it is
                      educational context, not financial advice.
                    </li>
                  </ul>
                </div>
              </span>
            </h2>
            <p className="text-xs text-gray-500 mt-1 max-w-2xl">
              Source: <span className="text-gray-400">api.vrdnation.org</span> (proxied). Daily series —
              use with live and historical breadth, not as a standalone trigger.
            </p>
          </div>
          <label className="flex shrink-0 cursor-pointer items-center gap-2 self-start rounded-xl border border-white/10 bg-[#0a0a0b] px-3 py-2 text-xs text-gray-400">
            <input
              type="checkbox"
              className="rounded border-white/20 bg-[#161618] text-violet-500 focus:ring-violet-500/40"
              checked={fiiYAxisFullRange}
              onChange={(e) => setFiiYAxisFullRange(e.target.checked)}
            />
            <span className="font-semibold text-gray-300 whitespace-nowrap">0–100% scale</span>
          </label>
        </div>

        <div className="rounded-2xl border border-violet-500/25 bg-violet-500/[0.06] p-4 sm:p-5 space-y-3">
          <h3 className="text-[11px] font-bold uppercase tracking-widest text-violet-200/90 flex items-center gap-2">
            <Info className="shrink-0 text-violet-400" size={15} aria-hidden />
            FII long % + NSE breadth (how to combine)
          </h3>
          <p className="text-xs text-gray-400 leading-relaxed">
            Breadth is <span className="text-gray-300">equal-weight participation</span>; FII index
            futures are <span className="text-gray-300">concentrated institutional</span> positioning.
            The useful reads show up when the two disagree or align.
          </p>
          <div className="overflow-x-auto rounded-xl border border-white/10">
            <table className="w-full min-w-[280px] text-left text-[11px] text-gray-400">
              <thead>
                <tr className="border-b border-white/10 bg-[#0a0a0b] text-[10px] font-bold uppercase tracking-wide text-gray-500">
                  <th className="px-3 py-2 font-bold">Setup</th>
                  <th className="px-3 py-2 font-bold">FII long %</th>
                  <th className="px-3 py-2 font-bold">Breadth (A/D)</th>
                  <th className="px-3 py-2 font-bold">Typical read</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                <tr className="bg-[#0a0a0b]/40">
                  <td className="px-3 py-2.5 font-semibold text-gray-300">Trap risk</td>
                  <td className="px-3 py-2.5">Rising (adding longs)</td>
                  <td className="px-3 py-2.5">Weak / &lt; 1.0</td>
                  <td className="px-3 py-2.5 text-amber-200/90">
                    Index can be propped while the broad market fades—be selective.
                  </td>
                </tr>
                <tr>
                  <td className="px-3 py-2.5 font-semibold text-gray-300">Capitulation / cover</td>
                  <td className="px-3 py-2.5">Very low (~&lt; 25%)</td>
                  <td className="px-3 py-2.5">Improving / ≥ 1.0</td>
                  <td className="px-3 py-2.5 text-emerald-200/90">
                    Max-short institutions meet stabilizing breadth—watch for squeeze dynamics.
                  </td>
                </tr>
                <tr className="bg-[#0a0a0b]/40">
                  <td className="px-3 py-2.5 font-semibold text-gray-300">Aligned bull backdrop</td>
                  <td className="px-3 py-2.5">Above ~50%</td>
                  <td className="px-3 py-2.5">Strong / &gt; 1.0</td>
                  <td className="px-3 py-2.5 text-violet-200/90">
                    Futures and breadth agree—trend continuation more plausible (still not a buy signal
                    by itself).
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="text-[10px] text-gray-500 leading-relaxed border-t border-white/5 pt-3">
            Thresholds are rules-of-thumb from how positioning and breadth interact; your process and
            risk limits still come first.
          </p>
        </div>

        {fiiError && (
          <div className="flex items-start gap-2 text-sm text-amber-400/90 rounded-xl border border-amber-500/20 bg-amber-500/5 px-3 py-2">
            <AlertTriangle size={18} className="shrink-0 mt-0.5" />
            <span>{fiiError}</span>
          </div>
        )}

        {fiiLoading && fiiChartData.length === 0 ? (
          <div className="h-72 flex flex-col items-center justify-center gap-3 border border-dashed border-white/10 rounded-2xl">
            <div className="w-8 h-8 border-2 border-violet-500/30 border-t-violet-500 rounded-full animate-spin" />
            <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">
              Loading FII ratio…
            </span>
          </div>
        ) : fiiChartData.length === 0 ? (
          <div className="h-48 flex items-center justify-center text-sm text-gray-500 border border-dashed border-white/10 rounded-2xl">
            No FII ratio rows returned.
          </div>
        ) : (
          <div className="space-y-3 pt-2">
            {fiiLatestRow ? (
              <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between rounded-2xl border border-white/10 bg-[#0a0a0b] px-4 py-3">
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-widest text-gray-500">
                    Latest data point
                  </div>
                  <div className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    <span className="text-2xl font-black tabular-nums text-gray-100">
                      {Number.isFinite(fiiLatestRow.fiiLong) ? `${fiiLatestRow.fiiLong.toFixed(2)}%` : '—'}
                    </span>
                    <span className="text-xs text-gray-500">
                      FII long ·{' '}
                      {(() => {
                        try {
                          return format(parseISO(fiiLatestRow.date), 'PP');
                        } catch {
                          return fiiLatestRow.date;
                        }
                      })()}
                    </span>
                  </div>
                  {fiiRecentSlopeInfo.slope != null && fiiRecentSlopeInfo.stepCount > 0 ? (
                    <p className="mt-1 text-[10px] text-gray-600">
                      Last {fiiRecentSlopeInfo.pointCount} prints ({fiiRecentSlopeInfo.stepCount} step
                      {fiiRecentSlopeInfo.stepCount === 1 ? '' : 's'}): slope{' '}
                      <span className="tabular-nums text-gray-400">
                        {fiiRecentSlopeInfo.slope >= 0 ? '+' : ''}
                        {fiiRecentSlopeInfo.slope.toFixed(3)} pts/step
                      </span>
                    </p>
                  ) : null}
                </div>
                {fiiLiveGuidance ? (
                  <div
                    className={`max-w-xl rounded-xl border px-3 py-2.5 sm:max-w-md ${fiiLiveGuidance.ring}`}
                  >
                    <div className={`text-[11px] font-bold ${fiiLiveGuidance.titleColor}`}>
                      {fiiLiveGuidance.title}
                    </div>
                    <p className="mt-1 text-[11px] leading-relaxed text-gray-400">
                      {fiiLiveGuidance.detail}
                    </p>
                  </div>
                ) : (
                  <p className="max-w-sm text-[11px] text-gray-500">
                    Load live NSE breadth above to see a same-day combination read with this print.
                  </p>
                )}
              </div>
            ) : null}

            <div>
              <h3 className="text-[11px] font-bold uppercase tracking-widest text-gray-500">
                FII long %
              </h3>
              <p className="text-[10px] text-gray-600 mt-0.5">
                {fiiYAxisFullRange ? (
                  <>
                    Full <span className="text-gray-400">0–100%</span> scale for oscillator context;
                    dashed guides at <span className="text-gray-400">20%</span>,{' '}
                    <span className="text-gray-400">50%</span>, <span className="text-gray-400">80%</span>{' '}
                    (common watch levels).
                  </>
                ) : (
                  <>
                    Y-axis zoomed to the loaded series (plus padding) so small changes fill the chart;
                    toggle <span className="text-gray-400">0–100% scale</span> for extreme readings.
                  </>
                )}
              </p>
            </div>
            <div className="h-[280px] w-full min-h-[240px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={fiiChartData}
                  margin={{ top: 8, right: 8, left: 0, bottom: 4 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 10, fill: '#9ca3af' }}
                    tickFormatter={(d) => {
                      try {
                        return format(parseISO(String(d)), 'MMM yy');
                      } catch {
                        return String(d);
                      }
                    }}
                    minTickGap={28}
                  />
                  <YAxis
                    domain={fiiYAxisFullRange ? [0, 100] : fiiLongYDomain}
                    width={44}
                    tick={{ fontSize: 10, fill: '#9ca3af' }}
                    tickFormatter={(v) => `${v}%`}
                    allowDataOverflow={false}
                  />
                  <Tooltip
                    contentStyle={{
                      background: '#141416',
                      border: '1px solid rgba(255,255,255,0.12)',
                      borderRadius: 12,
                      fontSize: 12,
                    }}
                    labelFormatter={(d) => {
                      try {
                        return format(parseISO(String(d)), 'PP');
                      } catch {
                        return String(d);
                      }
                    }}
                    formatter={(value) => {
                      if (value == null) return ['—', 'FII long'];
                      const n = typeof value === 'number' ? value : Number(value);
                      if (Number.isNaN(n)) return ['—', 'FII long'];
                      return [`${n.toFixed(2)}%`, 'FII long'];
                    }}
                  />
                  {fiiYAxisFullRange ? (
                    <>
                      <ReferenceLine
                        y={20}
                        stroke="#78716c"
                        strokeDasharray="4 4"
                        strokeOpacity={0.65}
                      />
                      <ReferenceLine y={50} stroke="#6b7280" strokeDasharray="4 4" />
                      <ReferenceLine
                        y={80}
                        stroke="#78716c"
                        strokeDasharray="4 4"
                        strokeOpacity={0.65}
                      />
                    </>
                  ) : fiiLongShowsNeutral50 ? (
                    <ReferenceLine y={50} stroke="#6b7280" strokeDasharray="4 4" />
                  ) : null}
                  <Line
                    type="monotone"
                    dataKey="fiiLong"
                    name="FII long %"
                    stroke="#22c55e"
                    strokeWidth={2}
                    dot={false}
                    isAnimationActive={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>

      <div className="p-8 rounded-3xl bg-[#161618] border border-white/5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
          <div>
            <h2 className="text-sm font-bold text-gray-500 uppercase tracking-widest flex items-center gap-2">
              <BarChart3 className="text-blue-400" size={16} />
              Daily A/D ratio trend
              {chartYear === 'rolling'
                ? ` (last ${NSE_MONTHLY_LOOKBACK} months, rolling)`
                : ` (${chartYear})`}
            </h2>
            <p className="text-xs text-gray-500 mt-1">
              {chartYear === 'rolling' ? (
                <>
                  Last {NSE_MONTHLY_LOOKBACK} completed months ({historySummary || '…'}), parallel NSE
                  monthly advance/decline requests merged by trading day.
                </>
              ) : (
                <>
                  Calendar year {chartYear}: twelve monthly series (Jan–Dec) merged by trading day.
                </>
              )}{' '}
              Ratio &gt; 1 suggests broader participation on up days; &lt; 1 the opposite. Use with
              price action for trade planning.
              {chartYear !== 'rolling' ? (
                <>
                  {' '}
                  For any month that has Neon daily snapshots, the{' '}
                  <span className="text-blue-300/90">blue A/D line</span> uses those values (same
                  smoothing as NSE) so the series stays continuous when NSE monthly lags. The dashed{' '}
                  <span className="text-teal-200/90">teal</span> line is prior-month same calendar day
                  (Neon) for context.
                </>
              ) : neonRows.length > 0 ? (
                <>
                  {' '}
                  Rolling mode does not request the <span className="text-gray-400">current</span> calendar
                  month from NSE; Neon fills those sessions on the blue line when{' '}
                  <span className="text-gray-400">DATABASE_URL</span> is set.
                </>
              ) : null}
            </p>
          </div>
        </div>

        <div className="rounded-2xl border border-blue-500/25 bg-blue-500/[0.06] p-4 sm:p-5 space-y-3">
          <h3 className="text-[11px] font-bold uppercase tracking-widest text-blue-300/95 flex items-center gap-2">
            <Info className="shrink-0 text-blue-400" size={15} aria-hidden />
            Market breadth vs. the index
          </h3>
          <div className="space-y-2.5 text-xs text-gray-400 leading-relaxed">
            <p>
              Advance/decline treats <span className="text-gray-300">every stock equally</span>. Major
              indices (Sensex, Nifty) are <span className="text-gray-300">narrow and cap-weighted</span>—a
              handful of large names can mask what the wider market is doing. Comparing this chart with
              the benchmark below is how you read that gap.
            </p>
            <ul className="list-disc space-y-1.5 pl-4 marker:text-blue-500/80">
              <li>
                <span className="text-gray-300">Bearish breadth divergence:</span> index still firm or
                grinding up while A/D weakens—money often rotates into heavyweights while the broad market
                sells. The tape can look &quot;fine&quot; until participation collapses.
              </li>
              <li>
                <span className="text-gray-300">Bullish breadth divergence:</span> index still ugly or
                making lows while A/D improves—selling may be exhausting and breadth can turn before the
                index does. Professionals watch this as a <span className="text-gray-300">health</span>{' '}
                read, not a timer by itself.
              </li>
            </ul>
            <p className="text-[11px] text-gray-500 border-t border-white/5 pt-3">
              <span className="font-semibold text-gray-400">Takeaway:</span> rising index with falling
              breadth is a fragile trend; falling index with rising breadth can precede stabilization. Pair
              this with price structure, volume, and your own risk rules—not a standalone buy/sell signal.
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          <p className="text-xs text-gray-500 max-w-xl">
            <span className="text-gray-400 font-medium">A/D plot:</span>{' '}
            {smoothPeriod <= 1 ? (
              <>each point is that session&apos;s raw advance/decline ratio.</>
            ) : (
              <>
                trailing {smoothPeriod}-session average (partial window at the start of the series).
                Set to 1 for raw session ratios.
              </>
            )}
            {chartUsesNeonBlend ? (
              <>
                {' '}
                {chartYear === 'rolling'
                  ? 'Neon extends the blue line after the last NSE session (including the current IST month).'
                  : 'Months with Neon data blend into the blue line so March flows into April without a separate overlay.'}
              </>
            ) : null}
          </p>
          <div className="flex flex-wrap items-center gap-3 sm:gap-4">
            <label className="flex shrink-0 items-center gap-2 text-xs text-gray-400">
              <span className="font-bold uppercase tracking-wide whitespace-nowrap">Year</span>
              <select
                value={chartYear === 'rolling' ? 'rolling' : String(chartYear)}
                onChange={(e) => {
                  const v = e.target.value;
                  setChartYear(v === 'rolling' ? 'rolling' : Number(v));
                }}
                aria-label="Calendar year or rolling window for A/D history"
                className="cursor-pointer rounded-xl border border-white/10 bg-[#0a0a0b] px-3 py-2.5 text-sm font-semibold tabular-nums text-gray-200 outline-none transition-colors hover:border-white/20 focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/30 min-w-[10rem]"
              >
                <option value="rolling">
                  Rolling ({NSE_MONTHLY_LOOKBACK} mo)
                </option>
                {chartYearOptions.map((y) => (
                  <option key={y} value={String(y)}>
                    {y}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex shrink-0 items-center gap-2 text-xs text-gray-400">
              <span className="font-bold uppercase tracking-wide whitespace-nowrap">Smoothing</span>
              <select
                value={smoothPeriod}
                onChange={(e) => setSmoothPeriod(Number(e.target.value))}
                aria-label="Smoothing period in trading sessions"
                className="cursor-pointer rounded-xl border border-white/10 bg-[#0a0a0b] px-3 py-2.5 text-sm font-semibold tabular-nums text-gray-200 outline-none transition-colors hover:border-white/20 focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/30"
              >
                {SMOOTH_PERIOD_OPTIONS.map((n) => (
                  <option key={n} value={n}>
                    {n} {n === 1 ? 'session (raw)' : 'sessions'}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>

        {historyMonths.some((m) => m.error) && (
          <div className="text-xs text-amber-400/90 rounded-xl border border-amber-500/20 bg-amber-500/5 px-3 py-2">
            {historyMonths
              .filter((m) => m.error)
              .map((m) => (
                <span key={m.yearKey} className="block">
                  {m.yearKey}: {m.error}
                </span>
              ))}
          </div>
        )}

        {neonError ? (
          <div className="text-xs text-amber-400/90 rounded-xl border border-amber-500/20 bg-amber-500/5 px-3 py-2">
            Neon A/D overlay: {neonError}
          </div>
        ) : null}

        {historyError && (
          <div className="flex items-start gap-2 text-sm text-red-400/90">
            <AlertTriangle size={18} className="shrink-0 mt-0.5" />
            <span>{historyError}</span>
          </div>
        )}

        {historyLoading ? (
          <div className="h-96 flex flex-col items-center justify-center gap-3 border border-white/5 rounded-2xl bg-[#0a0a0b]">
            <div className="w-8 h-8 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin" />
            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">
              Loading 6 months…
            </span>
          </div>
        ) : chartSeries.length > 0 ? (
          <div className="h-96 w-full min-w-0">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartSeries} margin={{ top: 8, right: 12, left: 0, bottom: 8 }}>
                <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fill: '#6b7280', fontSize: 8 }}
                  interval="preserveStartEnd"
                  minTickGap={28}
                  angle={-40}
                  textAnchor="end"
                  height={64}
                />
                <YAxis
                  tick={{ fill: '#6b7280', fontSize: 10 }}
                  width={36}
                  domain={['auto', 'auto']}
                  tickFormatter={(v) => (typeof v === 'number' ? v.toFixed(1) : v)}
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const p = payload[0].payload as ChartPoint;
                    const plotVal = payload[0].value;
                    const plotText =
                      typeof plotVal === 'number' && Number.isFinite(plotVal)
                        ? plotVal.toFixed(2)
                        : '—';
                    const nnTip = toFiniteNumber(p.neonRatio);
                    const primRaw = primarySessionAdRatio(
                      p.tradeDate,
                      p.ratio,
                      p.neonRatio,
                      chartYear,
                      neonMonthPrefixes,
                      maxNseTradeDate,
                    );
                    const blendedPrimary =
                      nnTip != null &&
                      primRaw != null &&
                      Math.abs(primRaw - nnTip) < 1e-8;
                    const lineLabel = chartUsesNeonBlend
                      ? smoothPeriod <= 1
                        ? 'Session A/D (NSE + Neon)'
                        : `${smoothPeriod}-session avg (NSE + Neon)`
                      : smoothPeriod <= 1
                        ? 'Session A/D (NSE)'
                        : `${smoothPeriod}-session avg (NSE)`;
                    const fmt = (n: number | null | undefined) =>
                      n != null && Number.isFinite(n) ? n.toFixed(2) : '—';
                    return (
                      <div
                        className="rounded-xl border border-white/10 bg-[#161618] px-3 py-2 text-xs shadow-xl"
                        style={{ fontSize: 12 }}
                      >
                        <div className="mb-2 text-[11px] font-medium text-gray-500">
                          {p.label} · {p.monthKey}
                          {p.tradeDate ? (
                            <span className="text-gray-600"> · {p.tradeDate} IST</span>
                          ) : null}
                        </div>
                        <div className="font-semibold text-blue-300">
                          {lineLabel}: {plotText}
                        </div>
                        {blendedPrimary ? (
                          <div className="mt-1 text-[10px] text-gray-500">
                            Primary uses Neon for this month when a stored daily exists (same value as
                            blue line here).
                          </div>
                        ) : null}
                        {p.neonOnlyDay ? (
                          <div className="mt-1 text-[10px] text-amber-200/80">
                            NSE monthly has not published this session yet — point comes from Neon.
                          </div>
                        ) : null}
                        {smoothPeriod > 1 ? (
                          <div className="mt-1 text-gray-500">
                            Raw session (NSE):{' '}
                            {p.ratio != null && Number.isFinite(p.ratio) ? p.ratio.toFixed(2) : '—'}
                          </div>
                        ) : null}
                        {showPriorMonthNeonLine ? (
                          <div className="mt-2 space-y-1 border-t border-white/10 pt-2 text-[11px]">
                            <div className="text-gray-400">
                              Neon (stored) raw: {fmt(p.neonRatio)}
                            </div>
                            <div className="text-teal-200/95">
                              Prior month (Neon): {fmt(p.oldMonthNeonRatioPlot)}
                              {smoothPeriod > 1 ? (
                                <span className="text-gray-500"> raw {fmt(p.oldMonthNeonRatio)}</span>
                              ) : null}
                            </div>
                          </div>
                        ) : null}
                      </div>
                    );
                  }}
                />
                <ReferenceLine
                  y={1}
                  stroke="#6b7280"
                  strokeDasharray="5 5"
                  label={{
                    value: '1.0 neutral',
                    fill: '#6b7280',
                    fontSize: 10,
                    position: 'insideTopRight',
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="ratioPlot"
                  name={
                    chartUsesNeonBlend
                      ? smoothPeriod <= 1
                        ? 'Session A/D (NSE + Neon)'
                        : `${smoothPeriod}-session avg (NSE + Neon)`
                      : smoothPeriod <= 1
                        ? 'Session A/D (NSE)'
                        : `${smoothPeriod}-session avg (NSE)`
                  }
                  stroke="#60a5fa"
                  strokeWidth={2}
                  dot={{ r: 3, fill: '#38bdf8', strokeWidth: 0 }}
                  activeDot={{ r: 5 }}
                  connectNulls={false}
                />
                {showPriorMonthNeonLine ? (
                  <Line
                    type="monotone"
                    dataKey="oldMonthNeonRatioPlot"
                    name={
                      smoothPeriod <= 1
                        ? 'Prior month (Neon)'
                        : `Prior month Neon (${smoothPeriod}-sess. avg)`
                    }
                    stroke="#2dd4bf"
                    strokeWidth={1.75}
                    strokeDasharray="6 4"
                    dot={false}
                    connectNulls={false}
                    isAnimationActive={false}
                  />
                ) : null}
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="h-48 flex flex-col items-center justify-center gap-2 border border-dashed border-white/10 rounded-2xl text-gray-500 text-sm">
            No historical rows to chart.
            <button
              type="button"
              onClick={loadHistory}
              className="text-blue-400 font-medium hover:underline"
            >
              Retry
            </button>
          </div>
        )}

        <div className="mt-10 space-y-5 border-t border-white/5 pt-10">
          <div className="space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-widest text-gray-500">
              SENSEX (TradingView)
            </h3>
            <p className="text-xs text-gray-500">
              Benchmark context to compare with the NSE advance/decline trend above.
            </p>
          </div>
          <div className="pt-2">
            <TradingViewWidget />
          </div>
        </div>

        <div className="mt-10 space-y-5 border-t border-white/5 pt-10">
          <div className="space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-widest text-gray-500">
              India stock screener (TradingView)
            </h3>
            <p className="text-xs text-gray-500">
              Most capitalized and other presets for Indian markets — use alongside breadth and the
              SENSEX chart above.
            </p>
          </div>
          <div className="pt-2">
            <TradingViewScreenerWidget />
          </div>
        </div>
      </div>

      <div className="p-8 rounded-3xl bg-[#161618] border border-white/5 space-y-6">
        <h2 className="text-sm font-bold text-gray-500 uppercase tracking-widest flex items-center gap-2">
          <ShieldCheck className="text-gray-400" size={16} /> Strategy Parameters
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="space-y-4">
            <h3 className="text-green-400 font-bold flex items-center gap-2">
              <TrendingUp size={18} /> Bullish Environment (A/D {'>'} 1.5)
            </h3>
            <ul className="space-y-2 text-sm text-gray-400 list-disc pl-5">
              <li>Momentum follow-through highly likely</li>
              <li>VCP bases tend to break out clean</li>
              <li>Leaders extend 20-30% rapidly</li>
            </ul>
          </div>
          <div className="space-y-4">
            <h3 className="text-red-400 font-bold flex items-center gap-2">
              <TrendingDown size={18} /> Bearish Environment (A/D {'<'} 0.7)
            </h3>
            <ul className="space-y-2 text-sm text-gray-400 list-disc pl-5">
              <li>Breakouts fail often (shakeouts common)</li>
              <li>Momentum dies quickly after breakout</li>
              <li>Market distribution outweighs accumulation</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
