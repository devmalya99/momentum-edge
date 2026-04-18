'use client';

import { useMemo } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { PnlChartTrade } from '@/analytics/types';
import { buildDistributionBars, medianPnL, type DistributionBarPoint } from '@/analytics/pnlChartMath';
import { formatInr } from '@/lib/format-inr';

const GREEN = '#22c55e';
const RED = '#f87171';
const GRID = '#ffffff08';
const AXIS = '#ffffff35';
const MEDIAN_STROKE = '#60a5fa';
const AVG_STROKE = '#f59e0b';

function PnlBarTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { payload: DistributionBarPoint }[];
}) {
  if (!active || !payload?.length) return null;
  const p = payload[0]!.payload;
  return (
    <div className="rounded-xl border border-white/10 bg-[#1a1a1c] px-3 py-2.5 text-xs shadow-xl max-w-[240px]">
      <div className="mb-2 font-semibold text-white">{p.label ?? '—'}</div>
      <div className="space-y-1 text-gray-300">
        <div className="flex justify-between gap-4">
          <span className="text-gray-500">Realized P&amp;L</span>
          <span className="font-mono tabular-nums text-white">{formatInr(p.pnl)}</span>
        </div>
        {typeof p.pnlPct === 'number' && Number.isFinite(p.pnlPct) ? (
          <div className="flex justify-between gap-4">
            <span className="text-gray-500">Return</span>
            <span
              className={`font-mono tabular-nums font-medium ${p.pnlPct >= 0 ? 'text-emerald-400' : 'text-red-400'}`}
            >
              {p.pnlPct.toFixed(2)}%
            </span>
          </div>
        ) : null}
        {typeof p.totalTradeValue === 'number' && Number.isFinite(p.totalTradeValue) ? (
          <div className="flex justify-between gap-4">
            <span className="text-gray-500">Total trade value</span>
            <span className="font-mono tabular-nums text-white">{formatInr(p.totalTradeValue)}</span>
          </div>
        ) : null}
        <div className="pt-1 border-t border-white/10 text-[10px] text-gray-500">
          Sort #{p.idx} (ascending by realized ₹ P&amp;L)
        </div>
      </div>
    </div>
  );
}

type Props = {
  trades: PnlChartTrade[];
  className?: string;
  height?: number;
};

export default function TradePnlPctDistributionChart({ trades, className, height = 280 }: Props) {
  const barData = useMemo(() => buildDistributionBars(trades), [trades]);
  const median = useMemo(() => medianPnL(barData.map((d) => d.pnl)), [barData]);
  const averagePnl = useMemo(() => {
    if (barData.length === 0) return 0;
    const total = barData.reduce((sum, row) => sum + row.pnl, 0);
    return total / barData.length;
  }, [barData]);

  if (barData.length === 0) {
    return (
      <div
        className={`flex items-center justify-center rounded-2xl border border-dashed border-white/10 text-sm text-gray-500 ${className ?? ''}`}
        style={{ minHeight: height, height }}
      >
        No P&amp;L rows to chart.
      </div>
    );
  }

  const many = barData.length > 40;
  const showInrOnX = barData.length > 0 && barData.length <= 24;
  const bottomMargin = showInrOnX ? 52 : 4;

  return (
    <div className={className} style={{ width: '100%', height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={barData} margin={{ top: 8, right: 8, left: 0, bottom: bottomMargin }}>
          <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
          <XAxis
            dataKey="idx"
            stroke={AXIS}
            tick={{ fontSize: showInrOnX ? 8 : 10 }}
            tickLine={false}
            interval={many ? 'preserveStartEnd' : 0}
            angle={showInrOnX ? -40 : 0}
            textAnchor={showInrOnX ? 'end' : 'middle'}
            height={showInrOnX ? 48 : undefined}
            tickFormatter={(v) => {
              const n = Number(v);
              const row = barData.find((d) => d.idx === n);
              if (showInrOnX && row) return formatInr(row.pnl, { min: 0, max: 0 });
              return String(n);
            }}
            label={{
              value: showInrOnX
                ? 'Realized P&L (₹, ascending)'
                : many
                  ? 'Sorted index (asc by ₹ P&L)'
                  : 'Sorted index (1 = largest loss)',
              position: 'insideBottom',
              offset: showInrOnX ? -2 : -4,
              fill: '#6b7280',
              fontSize: 10,
            }}
          />
          <YAxis
            stroke={AXIS}
            tick={{ fontSize: 10 }}
            tickFormatter={(v) => formatInr(Number(v), { min: 0, max: 0 })}
            width={64}
          />
          <Tooltip
            cursor={{ fill: 'rgba(255,255,255,0.04)' }}
            content={(props) => (
              <PnlBarTooltip
                active={props.active}
                payload={props.payload as unknown as { payload: DistributionBarPoint }[] | undefined}
              />
            )}
          />
          <ReferenceLine y={0} stroke="#ffffff45" strokeWidth={1} />
          <ReferenceLine
            y={median}
            stroke={MEDIAN_STROKE}
            strokeWidth={1.5}
            label={{
              value: `Median ${formatInr(median, { min: 0, max: 0 })}`,
              position: 'insideTopRight',
              fill: MEDIAN_STROKE,
              fontSize: 10,
            }}
          />
          <ReferenceLine
            y={averagePnl}
            stroke={AVG_STROKE}
            strokeDasharray="5 5"
            strokeWidth={1.5}
            label={{
              value: `Avg ${formatInr(averagePnl, { min: 0, max: 0 })}`,
              position: 'insideTopLeft',
              fill: AVG_STROKE,
              fontSize: 10,
            }}
          />
          <Bar dataKey="pnl" radius={[3, 3, 0, 0]} maxBarSize={many ? 6 : 28}>
            {barData.map((entry) => (
              <Cell key={entry.idx} fill={entry.pnl >= 0 ? GREEN : RED} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
