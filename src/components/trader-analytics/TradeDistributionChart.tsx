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
import { buildDistributionBars, medianPnL } from '@/analytics/pnlChartMath';
import { formatInr } from '@/lib/format-inr';

const GREEN = '#22c55e';
const RED = '#f87171';
const GRID = '#ffffff08';
const AXIS = '#ffffff35';
const MEDIAN_STROKE = '#60a5fa';

type Props = {
  trades: PnlChartTrade[];
  className?: string;
  height?: number;
};

export default function TradeDistributionChart({ trades, className, height = 260 }: Props) {
  const barData = useMemo(() => buildDistributionBars(trades), [trades]);
  const median = useMemo(() => medianPnL(barData.map((d) => d.pnl)), [barData]);

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

  return (
    <div className={className} style={{ width: '100%', height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={barData} margin={{ top: 8, right: 8, left: 0, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
          <XAxis
            dataKey="idx"
            stroke={AXIS}
            tick={{ fontSize: 10 }}
            tickLine={false}
            interval={many ? 'preserveStartEnd' : 0}
            label={{
              value: many ? 'Sorted index' : 'Sorted index (1 = largest loss)',
              position: 'insideBottom',
              offset: -4,
              fill: '#6b7280',
              fontSize: 10,
            }}
          />
          <YAxis
            stroke={AXIS}
            tick={{ fontSize: 10 }}
            tickFormatter={(v) => formatInr(Number(v), { min: 0, max: 0 })}
            width={56}
          />
          <Tooltip
            cursor={{ fill: 'rgba(255,255,255,0.04)' }}
            contentStyle={{
              backgroundColor: '#1a1a1c',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 12,
            }}
            labelStyle={{ color: '#9ca3af', fontSize: 11 }}
            formatter={(value) => [formatInr(Number(value ?? 0)), 'Realized P&L']}
            labelFormatter={(_label, payload) => {
              const p = payload?.[0]?.payload as { idx?: number; label?: string } | undefined;
              if (p?.label) return `${p.label} · sort #${p.idx}`;
              return `Sort #${p?.idx ?? ''}`;
            }}
          />
          <ReferenceLine
            y={median}
            stroke={MEDIAN_STROKE}
            strokeDasharray="5 5"
            strokeWidth={1.5}
            label={{
              value: `Median ${formatInr(median, { min: 1, max: 1 })}`,
              position: 'insideTopRight',
              fill: MEDIAN_STROKE,
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
