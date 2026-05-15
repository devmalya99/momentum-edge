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
  CalendarDays,
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
  ReferenceArea,
  ReferenceLine,
} from 'recharts';
import { format, parseISO } from 'date-fns';
import TradingViewWidget from '@/components/TradingViewWidget';
import LargeDealsPanel from '@/components/market/LargeDealsPanel';
import { NSE_MONTHLY_LOOKBACK } from '@/lib/nse-month-keys';
import type { Holiday } from '@/lib/nse-holiday-types';
import InfoTooltip from '@/components/shared/InfoTooltip';
import { Calendar } from '@/components/ui/calendar';

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

function parseHolidayDate(value: string): Date | null {
  const direct = new Date(value);
  if (!Number.isNaN(direct.getTime())) return direct;
  const alt = parseISO(value);
  if (!Number.isNaN(alt.getTime())) return alt;
  return null;
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function daysBetween(a: Date, b: Date): number {
  const ms = startOfDay(b).getTime() - startOfDay(a).getTime();
  return Math.round(ms / 86400000);
}

function getLastWeekdayOfMonth(year: number, monthIndex: number, weekday: number): Date {
  const d = new Date(year, monthIndex + 1, 0);
  while (d.getDay() !== weekday) d.setDate(d.getDate() - 1);
  return d;
}

function isLastWeekOfMonth(d: Date): boolean {
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  return d.getDate() + 7 > last;
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

  const [neonRows, setNeonRows] = useState<NeonDailyRow[]>([]);
  const [neonLoading, setNeonLoading] = useState(false);
  const [neonError, setNeonError] = useState<string | null>(null);

  const [largeDealsReloadToken, setLargeDealsReloadToken] = useState(0);
  const [tradingHolidays, setTradingHolidays] = useState<Holiday[]>([]);
  const [holidaysLoading, setHolidaysLoading] = useState(true);
  const [holidaysError, setHolidaysError] = useState<string | null>(null);
  const [calendarMonth, setCalendarMonth] = useState<Date>(new Date());
  const [selectedCalendarDate, setSelectedCalendarDate] = useState<Date | undefined>(new Date());

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

  const loadTradingHolidays = useCallback(async () => {
    setHolidaysLoading(true);
    setHolidaysError(null);
    try {
      const response = await fetch('/api/nse/holidays?type=trading', { cache: 'no-store' });
      const payload = await response.json();
      if (!response.ok) {
        const msg =
          typeof payload?.error === 'string' ? payload.error : 'Failed to load trading holidays.';
        throw new Error(msg);
      }
      const rows = Array.isArray(payload?.holidays) ? (payload.holidays as Holiday[]) : [];
      const sorted = [...rows].sort((a, b) => {
        const da = parseHolidayDate(a.tradingDate)?.getTime() ?? Number.MAX_SAFE_INTEGER;
        const db = parseHolidayDate(b.tradingDate)?.getTime() ?? Number.MAX_SAFE_INTEGER;
        return da - db;
      });
      setTradingHolidays(sorted);
    } catch (err: unknown) {
      console.error(err);
      const message = err instanceof Error ? err.message : 'Request failed.';
      setHolidaysError(message);
      setTradingHolidays([]);
    } finally {
      setHolidaysLoading(false);
    }
  }, []);

  const refreshAll = useCallback(() => {
    void loadLive();
    void loadHistory();
    void loadNeonDaily();
    void loadTradingHolidays();
    setLargeDealsReloadToken((t) => t + 1);
  }, [loadLive, loadHistory, loadNeonDaily, loadTradingHolidays]);

  useEffect(() => {
    void loadLive();
  }, [loadLive]);

  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  useEffect(() => {
    void loadNeonDaily();
  }, [loadNeonDaily]);

  useEffect(() => {
    void loadTradingHolidays();
  }, [loadTradingHolidays]);

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

  type ChartBaseRow = Omit<ChartPoint, 'ratioPlot' | 'neonRatio'>;

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
      }));
    }

    const neonVals = chartBase.map((p) => neonByDate.get(p.tradeDate) ?? null);

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
    }));
  }, [chartBase, smoothPeriod, chartYear, neonByDate, neonMonthPrefixes, maxNseTradeDate]);

  const historySummary = useMemo(() => {
    if (chartYear !== 'rolling') {
      return `${chartYear} (Jan–Dec)`;
    }
    if (historyMonths.length === 0) return '';
    return historyMonths.map((m) => m.yearKey).join(' · ');
  }, [chartYear, historyMonths]);

  const nearestTradingHoliday = useMemo(() => {
    const now = new Date();
    const upcoming = [...tradingHolidays]
      .map((h) => {
        const d = parseHolidayDate(h.tradingDate);
        return d ? { holiday: h, ts: d.getTime() } : null;
      })
      .filter((x): x is { holiday: Holiday; ts: number } => x != null && x.ts >= now.getTime())
      .sort((a, b) => a.ts - b.ts);
    return upcoming[0]?.holiday ?? null;
  }, [tradingHolidays]);

  const holidayByDateKey = useMemo(() => {
    const map = new Map<string, Holiday>();
    for (const holiday of tradingHolidays) {
      const d = parseHolidayDate(holiday.tradingDate);
      if (!d) continue;
      map.set(format(d, 'yyyy-MM-dd'), holiday);
    }
    return map;
  }, [tradingHolidays]);

  const selectedCalendarHoliday = useMemo(() => {
    if (!selectedCalendarDate) return null;
    return holidayByDateKey.get(format(selectedCalendarDate, 'yyyy-MM-dd')) ?? null;
  }, [selectedCalendarDate, holidayByDateKey]);

  const expiryWatch = useMemo(() => {
    const today = new Date();
    const y = today.getFullYear();
    const m = today.getMonth();
    const candidates = [
      getLastWeekdayOfMonth(y, m, 2), // Tuesday
      getLastWeekdayOfMonth(y, m, 4), // Thursday
      getLastWeekdayOfMonth(y, m + 1, 2),
      getLastWeekdayOfMonth(y, m + 1, 4),
    ]
      .filter((d) => startOfDay(d).getTime() >= startOfDay(today).getTime())
      .sort((a, b) => a.getTime() - b.getTime());

    const next = candidates[0] ?? null;
    if (!next) {
      return {
        dateLabel: 'N/A',
        seriesLabel: 'Monthly expiry',
        daysLeft: null as number | null,
        daysToLastFriday: null as number | null,
        inRedWeek: false,
        level: 'normal' as 'normal' | 'caution' | 'warn' | 'critical',
        message: 'Could not calculate next monthly expiry.',
      };
    }

    const daysLeft = daysBetween(today, next);
    const isTuesdaySeries = next.getDay() === 2;
    const seriesLabel = isTuesdaySeries ? 'Month-end Tuesday expiry' : 'Month-end Thursday expiry';
    const lastFriday = getLastWeekdayOfMonth(y, m, 5);
    const dayOfMonth = today.getDate();
    const inRedWeek = dayOfMonth >= 21 && dayOfMonth <= 31;
    const daysToLastFriday = daysBetween(today, lastFriday);

    const isMondayBeforeExpiry = today.getDay() === 1 && daysLeft <= 3;
    const isLastFridayBeforeExpiry =
      today.getDay() === 5 && isLastWeekOfMonth(today) && daysLeft <= 6;

    let level: 'normal' | 'caution' | 'warn' | 'critical' = 'normal';
    let message = 'Standard positioning environment.';

    if (daysLeft <= 1) {
      level = 'critical';
      message = 'Expiry is imminent. Volatility and sharp intraday whipsaws are likely.';
    } else if (inRedWeek) {
      level = 'warn';
      message =
        'Inside Red Week (21st-31st). Stay cautious and keep positions light due to expiry volatility.';
    } else if (daysLeft <= 10 || isMondayBeforeExpiry || isLastFridayBeforeExpiry) {
      level = 'caution';
      message = 'Outside Red Week. Volatility can build as expiry gets closer; size positions accordingly.';
    }

    return {
      dateLabel: format(next, 'dd MMM yyyy'),
      seriesLabel,
      daysLeft,
      daysToLastFriday,
      inRedWeek,
      level,
      message,
    };
  }, []);

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
  const refreshSpinning = busy || neonLoading;

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

      <div className="p-6 rounded-3xl bg-[#161618] border border-white/5 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-bold text-gray-500 uppercase tracking-widest flex items-center gap-2">
            <CalendarDays className="text-blue-400" size={16} />
            NSE Trading Holidays
          </h2>
          <span className="text-[11px] text-gray-500">
            {tradingHolidays.length > 0 ? `${tradingHolidays.length} holidays loaded` : 'No data'}
          </span>
        </div>
        {holidaysLoading ? (
          <div className="text-sm text-gray-500">Loading holiday calendar…</div>
        ) : holidaysError ? (
          <div className="text-sm text-amber-300">
            Could not load trading holidays: {holidaysError}
          </div>
        ) : nearestTradingHoliday ? (
          <div className="rounded-2xl border border-blue-400/40 bg-blue-500/10 px-4 py-3">
            <p className="text-sm font-semibold text-gray-200">{nearestTradingHoliday.description}</p>
            <p className="text-xs text-gray-500 mt-1">
              {nearestTradingHoliday.tradingDate} ({nearestTradingHoliday.weekDay}){' '}
              <span className="ml-1 rounded-full border border-blue-400/35 bg-blue-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-blue-200">
                Nearest
              </span>
            </p>
            <p className="text-[11px] text-gray-500 mt-1">
              <span className="inline-flex items-center gap-1.5">
                Session: {nearestTradingHoliday.morning_session || 'Closed'} /{' '}
                {nearestTradingHoliday.evening_session || 'Closed'}
                <InfoTooltip message="Morning and evening are exchange session windows. Closed / Open means the morning session is closed while the evening session remains open for applicable segments." />
              </span>
            </p>
          </div>
        ) : (
          <div className="text-sm text-gray-500">No trading holidays found.</div>
        )}
      </div>

      <div className="p-6 rounded-3xl bg-[#161618] border border-white/5 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-bold text-gray-500 uppercase tracking-widest flex items-center gap-2">
            <CalendarDays className="text-blue-400" size={16} />
            Monthly Volatility Calendar
          </h2>
        </div>
        <p className="text-xs text-gray-500">
          Today is highlighted in green, Red Week (21st-31st) is marked in red, and NSE trading
          holidays are outlined in blue.
        </p>
        <div className="rounded-2xl border border-white/10 bg-[#0a0a0b] p-3 sm:p-4 flex justify-center">
          <Calendar
            mode="single"
            month={calendarMonth}
            onMonthChange={setCalendarMonth}
            selected={selectedCalendarDate}
            onSelect={setSelectedCalendarDate}
            className="w-auto bg-transparent! p-0 text-gray-200"
            classNames={{
              root: 'w-auto',
              months: 'justify-center',
              month: 'w-auto',
              table: 'w-auto',
              month_caption: 'text-gray-200',
              weekday: 'text-gray-500',
            }}
            modifiers={{
              redWeek: (date) =>
                date.getFullYear() === calendarMonth.getFullYear() &&
                date.getMonth() === calendarMonth.getMonth() &&
                date.getDate() >= 21,
              nseHoliday: (date) => holidayByDateKey.has(format(date, 'yyyy-MM-dd')),
              todayExact: (date) => format(date, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd'),
            }}
            modifiersClassNames={{
              redWeek:
                'bg-red-500/20 text-red-200 hover:bg-red-500/30 aria-selected:bg-red-500/30 aria-selected:text-red-100',
              nseHoliday: 'ring-1 ring-blue-400/70 ring-inset',
              todayExact:
                'bg-emerald-500/25 text-emerald-100 font-bold hover:bg-emerald-500/35 aria-selected:bg-emerald-500/35',
            }}
          />
        </div>
        <div className="flex flex-wrap items-center gap-3 text-[11px] text-gray-400">
          <span className="inline-flex items-center gap-1.5">
            <span className="size-2.5 rounded-full bg-emerald-400/80" />
            Today
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="size-2.5 rounded-full bg-red-400/80" />
            Red Week (21-31)
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="size-2.5 rounded-full border border-blue-400/80" />
            NSE Holiday
          </span>
        </div>
        {selectedCalendarDate ? (
          <div className="text-xs text-gray-400">
            Selected: <span className="text-gray-200">{format(selectedCalendarDate, 'dd MMM yyyy')}</span>
            {selectedCalendarHoliday ? (
              <span className="text-blue-200">
                {' '}
                · Holiday: {selectedCalendarHoliday.description} (
                {selectedCalendarHoliday.morning_session || 'Closed'} /{' '}
                {selectedCalendarHoliday.evening_session || 'Closed'})
              </span>
            ) : null}
          </div>
        ) : null}
      </div>

      <div
        className={`p-6 rounded-3xl border space-y-4 ${
          expiryWatch.inRedWeek
            ? 'bg-red-500/8 border-red-400/25'
            : 'bg-emerald-500/8 border-emerald-400/25'
        }`}
      >
        <h2
          className={`text-sm font-bold uppercase tracking-widest ${
            expiryWatch.inRedWeek ? 'text-red-200/90' : 'text-emerald-200/90'
          }`}
        >
          Monthly Expiry Volatility Watch
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="rounded-2xl border border-white/10 bg-[#0a0a0b] px-4 py-3">
            <p className="text-[11px] uppercase tracking-wide text-gray-500">Next expiry</p>
            <p className="text-sm font-semibold text-gray-200 mt-1">{expiryWatch.dateLabel}</p>
            <p className="text-[11px] text-gray-500 mt-1">{expiryWatch.seriesLabel}</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-[#0a0a0b] px-4 py-3">
            <p className="text-[11px] uppercase tracking-wide text-gray-500">Timeline</p>
            <p className="text-sm font-semibold text-gray-200 mt-1">
              {expiryWatch.daysLeft == null ? 'N/A' : `${expiryWatch.daysLeft} day(s) left`}
            </p>
            <p className="text-[11px] text-gray-500 mt-1">
              {expiryWatch.daysToLastFriday == null
                ? '10-day pre-expiry risk window'
                : `${expiryWatch.daysToLastFriday} day(s) to month last Friday`}
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-[#0a0a0b] px-4 py-3">
            <p className="text-[11px] uppercase tracking-wide text-gray-500">Risk signal</p>
            <p
              className={`text-sm font-semibold mt-1 ${
                expiryWatch.level === 'critical'
                  ? 'text-red-300'
                  : expiryWatch.level === 'warn'
                    ? 'text-amber-300'
                    : expiryWatch.level === 'caution'
                      ? 'text-yellow-300'
                      : 'text-emerald-300'
              }`}
            >
              {expiryWatch.level === 'critical'
                ? 'High volatility likely'
                : expiryWatch.level === 'warn'
                  ? 'Stay light'
                  : expiryWatch.level === 'caution'
                    ? 'Volatility building'
                    : 'Normal'}
            </p>
            <p className="text-[11px] text-gray-400 mt-1">
              {expiryWatch.inRedWeek
                ? 'Inside Red Week (21st-31st)'
                : 'Outside Red Week (21st-31st)'}
            </p>
            <p className="text-[11px] text-gray-500 mt-1">{expiryWatch.message}</p>
          </div>
        </div>
      </div>

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
                  For any month that has Neon daily snapshots, the A/D line uses those values (same
                  smoothing as NSE) so the series stays continuous when NSE monthly lags.
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

        <div className="rounded-2xl border border-blue-500/25 bg-blue-500/6 p-4 sm:p-5 space-y-3">
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
                  : 'Months with Neon data use stored dailies so the series stays continuous when NSE monthly lags.'}
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
                className="cursor-pointer rounded-xl border border-white/10 bg-[#0a0a0b] px-3 py-2.5 text-sm font-semibold tabular-nums text-gray-200 outline-none transition-colors hover:border-white/20 focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/30 min-w-40"
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
            Neon A/D: {neonError}
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
                <ReferenceArea
                  y1={0.8}
                  y2={1.4}
                  fill="#ef4444"
                  fillOpacity={0.14}
                  strokeOpacity={0}
                  ifOverflow="visible"
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
                    const lineLabel = chartUsesNeonBlend
                      ? smoothPeriod <= 1
                        ? 'Session A/D (NSE + Neon)'
                        : `${smoothPeriod}-session avg (NSE + Neon)`
                      : smoothPeriod <= 1
                        ? 'Session A/D (NSE)'
                        : `${smoothPeriod}-session avg (NSE)`;
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
                      </div>
                    );
                  }}
                />
                <ReferenceLine
                  y={1.2}
                  stroke="#ef4444"
                  strokeDasharray="5 5"
                  label={{
                    value: '1.2',
                    fill: '#ef4444',
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
