'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { init, dispose, type Chart } from 'klinecharts';
import { fetchNseEquityHistorical } from '@/lib/nse-equity-historical-client';
import { fetchNseIndexHistorical } from '@/lib/nse-index-historical-client';
import {
  aggregateNseDailyToKlines,
  CUSTOM_CANDLE_PERIOD_LABEL,
  flattenNseEquityHistoricalChunks,
  type CustomCandlePeriod,
} from '@/lib/nse-equity-historical-kline';
import { Loader2 } from 'lucide-react';

const PERIODS: CustomCandlePeriod[] = ['1d', '2d', '3d', '5d', '1w', '3w', '1m'];

function ymd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function defaultHistoryRange(): { from: string; to: string } {
  const end = new Date();
  const start = new Date(end.getTime());
  start.setFullYear(start.getFullYear() - 3);
  return { from: ymd(start), to: ymd(end) };
}

type Props = {
  /** NSE equity symbol or index name (e.g. `NIFTY 50`) */
  symbol: string;
  /** Equity uses EOD history; index uses NSE graph chart (close-only → synthetic OHLC). */
  seriesKind?: 'equity' | 'index';
  className?: string;
  /** Optional YYYY-MM-DD window; defaults to the last ~3 years */
  historyFrom?: string;
  historyTo?: string;
};

export default function NseEquityCandleChartWidget({
  symbol,
  seriesKind = 'equity',
  className,
  historyFrom,
  historyTo,
}: Props) {
  const nse = symbol.trim().toUpperCase();
  const range = useMemo(() => {
    const d = defaultHistoryRange();
    return { from: historyFrom ?? d.from, to: historyTo ?? d.to };
  }, [historyFrom, historyTo]);

  const [period, setPeriod] = useState<CustomCandlePeriod>('3d');
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<Chart | null>(null);

  const histQuery = useQuery({
    queryKey:
      seriesKind === 'index'
        ? (['nse-index-historical', nse] as const)
        : (['nse-equity-historical', nse, range.from, range.to] as const),
    queryFn: async () => {
      if (seriesKind === 'index') {
        const { bars } = await fetchNseIndexHistorical(nse, { flag: '5Y' });
        return { seriesKind: 'index' as const, bars };
      }
      const pack = await fetchNseEquityHistorical(nse, { from: range.from, to: range.to });
      return { seriesKind: 'equity' as const, pack };
    },
    enabled: nse.length > 0,
    staleTime: 5 * 60_000,
  });

  const klines = useMemo(() => {
    const d = histQuery.data;
    if (!d) return [];
    const flat =
      d.seriesKind === 'index'
        ? d.bars
        : flattenNseEquityHistoricalChunks(d.pack.data);
    return aggregateNseDailyToKlines(flat, period);
  }, [histQuery.data, period]);

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
    chart.setPeriod({ type: 'day', span: 1 });
    chart.setDataLoader({
      getBars: ({ callback }) => {
        callback(klines, false);
      },
    });
    if (seriesKind !== 'index') {
      chart.createIndicator('VOL', false, { height: 96, minHeight: 72 });
    }
    chart.resize();

    return () => {
      dispose(chart);
      chartRef.current = null;
    };
  }, [nse, klines, seriesKind]);

  useEffect(() => {
    const ro = new ResizeObserver(() => {
      chartRef.current?.resize();
    });
    const el = containerRef.current;
    if (el) ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const errMsg =
    histQuery.error instanceof Error ? histQuery.error.message : histQuery.isError ? 'Failed to load' : null;

  return (
    <div className={['flex h-full min-h-0 w-full min-w-0 flex-col gap-2', className].filter(Boolean).join(' ')}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Timeframe</span>
        <div className="flex flex-wrap gap-1">
          {PERIODS.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPeriod(p)}
              className={`rounded-md px-2 py-1 text-[10px] font-bold uppercase tracking-wide transition-colors ${
                period === p ? 'bg-blue-500/30 text-blue-100' : 'text-gray-500 hover:bg-white/5 hover:text-gray-300'
              }`}
            >
              {CUSTOM_CANDLE_PERIOD_LABEL[p]}
            </button>
          ))}
        </div>
      </div>

      <div className="relative min-h-0 flex-1 w-full overflow-hidden rounded-xl border border-white/10 bg-[#0a0a0b]">
        {histQuery.isLoading ? (
          <div className="absolute inset-0 z-10 flex items-center justify-center gap-2 bg-[#0a0a0b]/80 text-sm text-gray-400">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            Loading {nse}…
          </div>
        ) : null}
        {errMsg && !histQuery.isLoading ? (
          <div className="absolute inset-0 z-10 flex items-center justify-center px-4 text-center text-sm text-amber-300/90">
            {errMsg}
          </div>
        ) : null}
        {!histQuery.isLoading && !errMsg && klines.length === 0 ? (
          <div className="absolute inset-0 z-10 flex items-center justify-center text-sm text-gray-500">
            No historical rows for {nse}.
          </div>
        ) : null}
        <div ref={containerRef} className="h-full min-h-[280px] w-full" />
      </div>
    </div>
  );
}
