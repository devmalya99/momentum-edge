'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { init, dispose, type Chart } from 'klinecharts';
import { aggregateIntradayMinutesTo1hKlines } from '@/lib/nse-equity-intraday-kline';
import {
  aggregateNseDailyToKlines,
  CUSTOM_CANDLE_PERIOD_LABEL,
  flattenNseEquityHistoricalChunks,
  type CustomCandlePeriod,
  type DailyCandlePeriod,
} from '@/lib/nse-equity-historical-kline';
import {
  defaultNseChartHistoryRange,
  nseChartHistoricalQueryOptions,
  nseEquityIntradayQueryOptions,
} from '@/lib/nse-chart-query';
import { Loader2 } from 'lucide-react';

const DAILY_PERIODS: DailyCandlePeriod[] = ['1d', '2d', '3d', '5d', '1w', '3w', '1m'];
const EQUITY_PERIODS: CustomCandlePeriod[] = ['1h', ...DAILY_PERIODS];

type Props = {
  /** NSE equity symbol or index name (e.g. `NIFTY 50`) */
  symbol: string;
  /** Equity uses EOD history; index uses NSE graph chart (close-only → synthetic OHLC). */
  seriesKind?: 'equity' | 'index';
  className?: string;
  /** Optional YYYY-MM-DD window; defaults to the last ~3 years */
  historyFrom?: string;
  historyTo?: string;
  /** Initial timeframe (scanner defaults to 1H). */
  defaultPeriod?: CustomCandlePeriod;
};

export default function NseEquityCandleChartWidget({
  symbol,
  seriesKind = 'equity',
  className,
  historyFrom,
  historyTo,
  defaultPeriod = '3d',
}: Props) {
  const nse = symbol.trim().toUpperCase();
  const range = useMemo(() => {
    const d = defaultNseChartHistoryRange();
    return { from: historyFrom ?? d.from, to: historyTo ?? d.to };
  }, [historyFrom, historyTo]);

  const periodOptions = seriesKind === 'equity' ? EQUITY_PERIODS : DAILY_PERIODS;
  const initialPeriod = periodOptions.includes(defaultPeriod) ? defaultPeriod : periodOptions[0]!;

  const [period, setPeriod] = useState<CustomCandlePeriod>(initialPeriod);
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<Chart | null>(null);

  const isIntraday1h = period === '1h' && seriesKind === 'equity';

  const histQuery = useQuery({
    ...nseChartHistoricalQueryOptions(nse, seriesKind, range),
    enabled: !isIntraday1h,
  });

  const intradayQuery = useQuery({
    ...nseEquityIntradayQueryOptions(nse),
    enabled: isIntraday1h,
  });

  const klines = useMemo(() => {
    if (isIntraday1h) {
      const minutes = intradayQuery.data?.minutes ?? [];
      return aggregateIntradayMinutesTo1hKlines(minutes);
    }
    const d = histQuery.data;
    if (!d) return [];
    const flat =
      d.seriesKind === 'index'
        ? d.bars
        : flattenNseEquityHistoricalChunks(d.pack.data);
    return aggregateNseDailyToKlines(flat, period as DailyCandlePeriod);
  }, [histQuery.data, intradayQuery.data?.minutes, isIntraday1h, period]);

  const isLoading = isIntraday1h ? intradayQuery.isLoading : histQuery.isLoading;
  const isError = isIntraday1h ? intradayQuery.isError : histQuery.isError;
  const queryError = isIntraday1h ? intradayQuery.error : histQuery.error;

  useEffect(() => {
    const el = containerRef.current;
    if (!el || nse.length === 0 || klines.length === 0) {
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
          horizontal: { show: true, color: 'rgba(255,255,255,0.06)' },
          vertical: { show: true, color: 'rgba(255,255,255,0.06)' },
        },
        candle: {
          bar: {
            upColor: '#34d399',
            downColor: '#fb7185',
            noChangeColor: '#9ca3af',
            upBorderColor: '#34d399',
            downBorderColor: '#fb7185',
            noChangeBorderColor: '#9ca3af',
            upWickColor: '#34d399',
            downWickColor: '#fb7185',
            noChangeWickColor: '#9ca3af',
          },
        },
      },
    });
    if (!chart) return;
    chartRef.current = chart;

    chart.setSymbol({ ticker: nse, pricePrecision: 2, volumePrecision: 0 });
    chart.setPeriod(isIntraday1h ? { type: 'hour', span: 1 } : { type: 'day', span: 1 });
    chart.setDataLoader({
      getBars: ({ callback }) => {
        callback(klines, false);
      },
    });
    if (seriesKind !== 'index' && !isIntraday1h) {
      chart.createIndicator('VOL', false, { height: 96, minHeight: 72 });
    }
    chart.resize();

    return () => {
      dispose(chart);
      chartRef.current = null;
    };
  }, [nse, klines, seriesKind, isIntraday1h]);

  useEffect(() => {
    const ro = new ResizeObserver(() => {
      chartRef.current?.resize();
    });
    const el = containerRef.current;
    if (el) ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const errMsg =
    queryError instanceof Error ? queryError.message : isError ? 'Failed to load' : null;

  return (
    <ChartShell className={className}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Timeframe</span>
        <PeriodButtonRow periodOptions={periodOptions} period={period} onSelect={setPeriod} />
      </div>
      {isIntraday1h ? (
        <p className="text-[10px] text-gray-500">
          1H uses today&apos;s NSE session (minute prices). Daily timeframes use historical EOD data.
        </p>
      ) : null}

      <ChartFrame
        isLoading={isLoading}
        errMsg={errMsg}
        symbol={nse}
        isIntraday1h={isIntraday1h}
        klinesEmpty={klines.length === 0}
        containerRef={containerRef}
      />
    </ChartShell>
  );
}

function ChartShell({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div className={['flex h-full min-h-0 w-full min-w-0 flex-col gap-2', className].filter(Boolean).join(' ')}>
      {children}
    </div>
  );
}

function PeriodButtonRow({
  periodOptions,
  period,
  onSelect,
}: {
  periodOptions: CustomCandlePeriod[];
  period: CustomCandlePeriod;
  onSelect: (p: CustomCandlePeriod) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1">
      {periodOptions.map((p) => (
        <button
          key={p}
          type="button"
          onClick={() => onSelect(p)}
          className={`rounded-md px-2 py-1 text-[10px] font-bold uppercase tracking-wide transition-colors ${
            period === p ? 'bg-blue-500/30 text-blue-100' : 'text-gray-500 hover:bg-white/5 hover:text-gray-300'
          }`}
        >
          {CUSTOM_CANDLE_PERIOD_LABEL[p]}
        </button>
      ))}
    </div>
  );
}

function ChartFrame({
  isLoading,
  errMsg,
  symbol,
  isIntraday1h,
  klinesEmpty,
  containerRef,
}: {
  isLoading: boolean;
  errMsg: string | null;
  symbol: string;
  isIntraday1h: boolean;
  klinesEmpty: boolean;
  containerRef: React.RefObject<HTMLDivElement | null>;
}) {
  return (
    <div className="relative min-h-0 flex-1 w-full overflow-hidden rounded-xl border border-white/10 bg-[#0a0a0b]">
      {isLoading ? (
        <div className="absolute inset-0 z-10 flex items-center justify-center gap-2 bg-[#0a0a0b]/80 text-sm text-gray-400">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          Loading {symbol}…
        </div>
      ) : null}
      {errMsg && !isLoading ? (
        <div className="absolute inset-0 z-10 flex items-center justify-center px-4 text-center text-sm text-amber-300/90">
          {errMsg}
        </div>
      ) : null}
      {!isLoading && !errMsg && klinesEmpty ? (
        <div className="absolute inset-0 z-10 flex items-center justify-center text-sm text-gray-500">
          {isIntraday1h
            ? `No intraday data for ${symbol} yet (market may be closed).`
            : `No historical rows for ${symbol}.`}
        </div>
      ) : null}
      <div ref={containerRef} className="h-full min-h-[280px] w-full" />
    </div>
  );
}
