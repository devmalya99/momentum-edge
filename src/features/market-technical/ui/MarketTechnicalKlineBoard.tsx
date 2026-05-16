'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { init, dispose, type Chart, type IndicatorCreate, type KLineData } from 'klinecharts';
import { Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import type { MarketTechnicalSnapshot, MarketTechnicalKind } from '@/features/market-technical/types';
import {
  useMarketTechnicalQuery,
  type MarketTechnicalQueryInput,
} from '@/features/market-technical/query/use-market-technical-query';
import type { NseDailyBar, CustomCandlePeriod } from '@/lib/nse-equity-historical-kline';
import { aggregateNseDailyToKlines, CUSTOM_CANDLE_PERIOD_LABEL } from '@/lib/nse-equity-historical-kline';

const TIMEFRAMES: CustomCandlePeriod[] = ['1d', '2d', '3d', '5d', '1w', '3w', '1m'];

function fmtPrice(n: number | null, digits = 2): string {
  if (n == null || !Number.isFinite(n)) return '—';
  return n.toLocaleString('en-IN', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

function fmtPct(n: number | null): string {
  if (n == null || !Number.isFinite(n)) return '—';
  const sign = n > 0 ? '+' : '';
  return `${sign}${n.toFixed(2)}%`;
}

function IndicatorCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-[#0a0a0b] px-3 py-2.5 sm:px-4 sm:py-3">
      <p className="text-[10px] font-bold uppercase tracking-wide text-gray-500">{label}</p>
      <p className="mt-1 text-sm font-semibold tabular-nums text-gray-100">{value}</p>
      {sub ? <p className="mt-0.5 text-[10px] text-gray-600">{sub}</p> : null}
    </div>
  );
}

function snapshotCards(s: MarketTechnicalSnapshot) {
  return [
    { label: 'Close', value: fmtPrice(s.close) },
    { label: '1D change', value: fmtPct(s.changePct) },
    { label: 'RSI (14)', value: fmtPrice(s.rsi14, 2) },
    { label: 'EMA 20', value: fmtPrice(s.ema20) },
    { label: 'EMA 50', value: fmtPrice(s.ema50) },
    { label: 'EMA 200', value: fmtPrice(s.ema200) },
    { label: 'MACD line', value: fmtPrice(s.macdLine, 3) },
    { label: 'MACD signal', value: fmtPrice(s.macdSignal, 3) },
    { label: 'MACD hist', value: fmtPrice(s.macdHist, 3) },
    { label: 'BB upper (20)', value: fmtPrice(s.bbUpper) },
    { label: 'BB middle', value: fmtPrice(s.bbMiddle) },
    { label: 'BB lower (20)', value: fmtPrice(s.bbLower) },
  ];
}

export type MarketTechnicalKlineBoardProps = Omit<MarketTechnicalQueryInput, 'symbol' | 'kind'> & {
  /** Chart + card heading */
  title?: string;
  symbol: string;
  kind: MarketTechnicalKind;
};

/**
 * NSE-backed candle chart (klinecharts) with EMA overlay and a 2×6 grid of indicator snapshot cards.
 * Plug any `symbol` + `kind` (`index` uses NSE graph chart; `equity` uses historical API).
 */
export function MarketTechnicalKlineBoard({
  title,
  symbol,
  kind,
  indexFlag = '5Y',
  from,
  to,
  reloadToken,
  className,
}: MarketTechnicalKlineBoardProps) {
  const params = useMemo(
    (): MarketTechnicalQueryInput => ({
      kind,
      symbol,
      indexFlag: kind === 'index' ? indexFlag : undefined,
      from: kind === 'equity' ? from : undefined,
      to: kind === 'equity' ? to : undefined,
      reloadToken,
    }),
    [kind, symbol, indexFlag, from, to, reloadToken],
  );

  const q = useMarketTechnicalQuery(params);

  const [candlePeriod, setCandlePeriod] = useState<CustomCandlePeriod>('3d');

  const dailyBars: NseDailyBar[] = useMemo(() => {
    if (!q.data?.bars?.length) return [];
    return [...q.data.bars]
      .map((b) => ({
        timestamp: b.t,
        open: b.o,
        high: b.h,
        low: b.l,
        close: b.c,
        volume: b.v,
        turnover: 0,
      }))
      .sort((a, b) => a.timestamp - b.timestamp);
  }, [q.data]);

  const klines: KLineData[] = useMemo(
    () => aggregateNseDailyToKlines(dailyBars, candlePeriod),
    [dailyBars, candlePeriod],
  );

  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<Chart | null>(null);
  const sym = symbol.trim().toUpperCase();

  useEffect(() => {
    const el = containerRef.current;
    if (!el || sym.length === 0 || klines.length === 0) {
      if (chartRef.current) {
        dispose(chartRef.current);
        chartRef.current = null;
      }
      return;
    }

    if (chartRef.current) {
      dispose(chartRef.current);
      chartRef.current = null;
    }

    const chart = init(el, {
      locale: 'en-US',
      styles: {
        grid: {
          show: true,
          horizontal: { show: true, color: 'rgba(148,163,184,0.12)' },
          vertical: { show: true, color: 'rgba(148,163,184,0.08)' },
        },
        candle: {
          type: 'candle_solid',
          bar: {
            upColor: '#22c55e',
            downColor: '#f43f5e',
            noChangeColor: '#94a3b8',
            upBorderColor: '#4ade80',
            downBorderColor: '#fb7185',
            noChangeBorderColor: '#94a3b8',
            upWickColor: '#86efac',
            downWickColor: '#fda4af',
            noChangeWickColor: '#94a3b8',
          },
        },
        xAxis: {
          tickText: { color: '#94a3b8', size: 11, weight: '500' },
          axisLine: { color: 'rgba(148,163,184,0.25)' },
        },
        yAxis: {
          tickText: { color: '#94a3b8', size: 11, weight: '500' },
          axisLine: { color: 'rgba(148,163,184,0.25)' },
        },
        crosshair: {
          horizontal: {
            show: true,
            line: { show: true, style: 'dashed', color: 'rgba(96,165,250,0.45)', dashedValue: [4, 4] },
            text: { show: true, color: '#e2e8f0', backgroundColor: 'rgba(30,41,59,0.92)' },
          },
          vertical: {
            show: true,
            line: { show: true, style: 'dashed', color: 'rgba(96,165,250,0.45)', dashedValue: [4, 4] },
            text: { show: true, color: '#e2e8f0', backgroundColor: 'rgba(30,41,59,0.92)' },
          },
        },
      },
    });
    if (!chart) return;
    chartRef.current = chart;

    chart.setSymbol({ ticker: sym, pricePrecision: 2, volumePrecision: 0 });
    chart.setPeriod({ type: 'day', span: 1 });
    chart.setDataLoader({
      getBars: ({ callback }) => {
        callback(klines, false);
      },
    });

    /** `isStack: true` + `candle_pane` overlays EMA on the price chart (see klinecharts indicator guide). */
    const emaOverlay: IndicatorCreate = {
      name: 'EMA',
      calcParams: [20, 50, 200],
      styles: {
        lines: [
          { color: '#38bdf8', size: 1.75, style: 'solid', dashedValue: [0, 0] },
          { color: '#fbbf24', size: 1.75, style: 'solid', dashedValue: [0, 0] },
          { color: '#c084fc', size: 1.75, style: 'solid', dashedValue: [0, 0] },
        ],
      },
    };
    chart.createIndicator(emaOverlay, true, { id: 'candle_pane' });

    if (kind === 'equity') {
      chart.createIndicator('VOL', false, { height: 96, minHeight: 72 });
    }

    chart.resize();
    chart.scrollToRealTime(0);

    return () => {
      dispose(chart);
      chartRef.current = null;
    };
  }, [sym, klines, kind]);

  useEffect(() => {
    const ro = new ResizeObserver(() => chartRef.current?.resize());
    const el = containerRef.current;
    if (el) ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const errMsg =
    q.error instanceof Error ? q.error.message : q.isError ? 'Failed to load' : null;

  const heading = title ?? sym;
  const asOf =
    q.data?.snapshot?.asOfTimestamp != null
      ? format(new Date(q.data.snapshot.asOfTimestamp), 'dd MMM yyyy')
      : null;

  return (
    <div className={['flex min-h-0 w-full min-w-0 flex-col gap-3 space-y-0', className].filter(Boolean).join(' ')}>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h3 className="text-xs font-bold uppercase tracking-widest text-gray-500">{heading}</h3>
          <p className="text-xs text-gray-500">
            NSE India data ({kind === 'index' ? `index · ${indexFlag}` : 'equity history'}). Timeframe buckets match{' '}
            <span className="text-gray-400">NseEquityCandleChartWidget</span>. EMA 20 / 50 / 200 are drawn on the price
            pane; cards use the latest daily bar in range.
          </p>
        </div>
        {asOf ? (
          <span className="text-[10px] font-medium uppercase tracking-wide text-gray-600">As of {asOf}</span>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Timeframe</span>
        <div className="flex flex-wrap gap-1">
          {TIMEFRAMES.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setCandlePeriod(p)}
              className={`rounded-md px-2 py-1 text-[10px] font-bold uppercase tracking-wide transition-colors ${
                candlePeriod === p
                  ? 'bg-blue-500/35 text-blue-100 ring-1 ring-blue-400/40'
                  : 'text-gray-500 hover:bg-white/5 hover:text-gray-300'
              }`}
            >
              {CUSTOM_CANDLE_PERIOD_LABEL[p]}
            </button>
          ))}
        </div>
      </div>

      <div className="relative min-h-[320px] w-full min-w-0 flex-1 overflow-hidden rounded-xl border border-white/15 bg-linear-to-b from-[#12121a] to-[#0a0a0f] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] sm:min-h-[380px]">
        {q.isLoading ? (
          <div className="absolute inset-0 z-10 flex items-center justify-center gap-2 bg-[#0a0a0b]/80 text-sm text-gray-400">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            Loading {sym}…
          </div>
        ) : q.isFetching ? (
          <div className="pointer-events-none absolute right-2 top-2 z-10 flex items-center gap-1.5 rounded-lg border border-white/10 bg-[#0a0a0b]/90 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-gray-400">
            <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
            Updating
          </div>
        ) : null}
        {errMsg && !q.isLoading ? (
          <div className="absolute inset-0 z-10 flex items-center justify-center px-4 text-center text-sm text-amber-300/90">
            {errMsg}
          </div>
        ) : null}
        {!q.isLoading && !errMsg && klines.length === 0 ? (
          <div className="absolute inset-0 z-10 flex items-center justify-center text-sm text-gray-500">
            No bars returned for {sym}.
          </div>
        ) : null}
        <div ref={containerRef} className="h-[min(52vh,520px)] min-h-[280px] w-full flex-1" />
      </div>

      {q.data?.snapshot ? (
        <div className="grid grid-cols-2 gap-2 sm:gap-3 md:grid-cols-4 lg:grid-cols-6">
          {snapshotCards(q.data.snapshot).map((c) => (
            <IndicatorCard key={c.label} label={c.label} value={c.value} />
          ))}
        </div>
      ) : null}
    </div>
  );
}
