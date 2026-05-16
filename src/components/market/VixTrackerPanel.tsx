'use client';

import React, { useMemo } from 'react';
import { Activity, AlertTriangle, Loader2, RefreshCcw } from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  ReferenceArea,
} from 'recharts';
import type { VixChartPoint } from '@/lib/nse-vix-types';
import { useVixHistoryQuery } from '@/features/vix-tracker/query/use-vix-history-query';

type Props = {
  reloadToken?: number;
  sessions?: number;
};

function vixLevel(close: number): {
  label: string;
  color: string;
  bg: string;
  border: string;
} {
  if (close < 15) {
    return {
      label: 'Low volatility',
      color: 'text-emerald-400',
      bg: 'bg-emerald-500/10',
      border: 'border-emerald-500/20',
    };
  }
  if (close < 20) {
    return {
      label: 'Normal range',
      color: 'text-blue-400',
      bg: 'bg-blue-500/10',
      border: 'border-blue-500/20',
    };
  }
  if (close < 25) {
    return {
      label: 'Elevated fear',
      color: 'text-amber-400',
      bg: 'bg-amber-500/10',
      border: 'border-amber-500/20',
    };
  }
  return {
    label: 'High fear',
    color: 'text-red-400',
    bg: 'bg-red-500/10',
    border: 'border-red-500/20',
  };
}

export default function VixTrackerPanel({ reloadToken = 0, sessions = 60 }: Props) {
  const { data, isLoading, isFetching, error, refetch } = useVixHistoryQuery({
    sessions,
    reloadToken,
  });

  const latest = data?.latest ?? null;
  const points = data?.points ?? [];
  const status = latest ? vixLevel(latest.close) : null;
  const errorMessage = error instanceof Error ? error.message : error ? String(error) : null;
  const showInitialLoader = isLoading && !data;

  const yDomain = useMemo(() => {
    if (points.length === 0) return [0, 30] as [number, number];
    const vals = points.map((p) => p.close);
    const min = Math.min(...vals);
    const max = Math.max(...vals);
    const pad = Math.max(0.5, (max - min) * 0.08);
    return [Math.max(0, min - pad), max + pad] as [number, number];
  }, [points]);

  return (
    <section className="p-8 rounded-3xl bg-[#161618] border border-white/5 space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold text-gray-500 uppercase tracking-widest flex items-center gap-2">
            <Activity className="text-violet-400" size={16} />
            India VIX Tracker
          </h2>
          <p className="text-xs text-gray-500 mt-1">
            Last {sessions} NSE sessions — India VIX (implied volatility index). Data refreshes at
            most once per hour unless you reload manually.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void refetch()}
          disabled={isFetching}
          className="self-start p-2.5 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 text-gray-400 hover:text-white disabled:opacity-50"
          aria-label="Refresh VIX history"
        >
          <RefreshCcw size={16} className={isFetching ? 'animate-spin' : ''} />
        </button>
      </div>

      {errorMessage ? (
        <div className="flex items-start gap-2 text-sm text-amber-300/95 rounded-xl border border-amber-500/20 bg-amber-500/5 px-3 py-2">
          <AlertTriangle size={18} className="shrink-0 mt-0.5" />
          <span>{errorMessage}</span>
        </div>
      ) : null}

      {showInitialLoader ? (
        <div className="h-72 flex flex-col items-center justify-center gap-3 border border-white/5 rounded-2xl bg-[#0a0a0b]">
          <Loader2 className="text-violet-400 animate-spin" size={28} />
          <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">
            Loading VIX history…
          </span>
        </div>
      ) : latest && status ? (
        <>
          <div className="flex flex-wrap items-end gap-4">
            <div>
              <span className="text-5xl font-black tracking-tight tabular-nums text-violet-200">
                {latest.close.toFixed(2)}
              </span>
              <span className="ml-2 text-sm text-gray-500 font-bold">India VIX</span>
            </div>
            <span
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold ${status.bg} ${status.color} ${status.border}`}
            >
              {status.label}
            </span>
            <p className="text-xs text-gray-500 w-full sm:w-auto sm:ml-auto tabular-nums">
              {latest.tradeDate}{' '}
              <span
                className={
                  latest.changePct >= 0 ? 'text-red-400/90' : 'text-emerald-400/90'
                }
              >
                {latest.changePts >= 0 ? '+' : ''}
                {latest.changePts.toFixed(2)} ({latest.changePct >= 0 ? '+' : ''}
                {latest.changePct.toFixed(2)}%)
              </span>
            </p>
          </div>

          {points.length > 0 ? (
            <div className="h-80 w-full min-w-0">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={points} margin={{ top: 8, right: 12, left: 0, bottom: 8 }}>
                  <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
                  <XAxis
                    dataKey="label"
                    tick={{ fill: '#6b7280', fontSize: 9 }}
                    interval="preserveStartEnd"
                    minTickGap={24}
                    angle={-35}
                    textAnchor="end"
                    height={56}
                  />
                  <YAxis
                    tick={{ fill: '#6b7280', fontSize: 10 }}
                    width={40}
                    domain={yDomain}
                    tickFormatter={(v) => (typeof v === 'number' ? v.toFixed(1) : v)}
                  />
                  <ReferenceArea
                    y1={0}
                    y2={15}
                    fill="#10b981"
                    fillOpacity={0.06}
                    strokeOpacity={0}
                  />
                  <ReferenceArea
                    y1={15}
                    y2={20}
                    fill="#3b82f6"
                    fillOpacity={0.06}
                    strokeOpacity={0}
                  />
                  <ReferenceArea
                    y1={20}
                    y2={25}
                    fill="#f59e0b"
                    fillOpacity={0.08}
                    strokeOpacity={0}
                  />
                  <ReferenceArea
                    y1={25}
                    y2={yDomain[1]}
                    fill="#ef4444"
                    fillOpacity={0.08}
                    strokeOpacity={0}
                  />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const p = payload[0].payload as VixChartPoint;
                      return (
                        <div className="rounded-xl border border-white/10 bg-[#161618] px-3 py-2 text-xs shadow-xl">
                          <div className="text-[11px] font-medium text-gray-500 mb-1.5">
                            {p.tradeDate}
                          </div>
                          <div className="font-semibold text-violet-300">
                            Close: {p.close.toFixed(2)}
                          </div>
                          <div className="mt-1 text-gray-500">
                            O {p.open.toFixed(2)} · H {p.high.toFixed(2)} · L {p.low.toFixed(2)}
                          </div>
                          <div
                            className={`mt-1 ${p.changePct >= 0 ? 'text-red-400/90' : 'text-emerald-400/90'}`}
                          >
                            {p.changePts >= 0 ? '+' : ''}
                            {p.changePts.toFixed(2)} ({p.changePct >= 0 ? '+' : ''}
                            {p.changePct.toFixed(2)}%)
                          </div>
                        </div>
                      );
                    }}
                  />
                  <ReferenceLine
                    y={15}
                    stroke="#10b981"
                    strokeDasharray="4 4"
                    strokeOpacity={0.5}
                  />
                  <ReferenceLine
                    y={20}
                    stroke="#f59e0b"
                    strokeDasharray="4 4"
                    strokeOpacity={0.5}
                  />
                  <ReferenceLine
                    y={25}
                    stroke="#ef4444"
                    strokeDasharray="4 4"
                    strokeOpacity={0.5}
                  />
                  <Line
                    type="monotone"
                    dataKey="close"
                    name="India VIX close"
                    stroke="#a78bfa"
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4, fill: '#c4b5fd' }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : null}

          <p className="text-[11px] text-gray-500">
            Bands: &lt;15 calm · 15–20 normal · 20–25 elevated · &gt;25 high fear. Not a trade signal
            on its own — use with breadth and price structure.
          </p>
        </>
      ) : (
        <p className="text-sm text-gray-500 py-8 text-center">No VIX data available.</p>
      )}
    </section>
  );
}
