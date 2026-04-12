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
import { buildDistributionBarsByPct, medianPnL, type DistributionPctBarPoint } from '@/analytics/pnlChartMath';
import { formatInr } from '@/lib/format-inr';

const GREEN = '#22c55e';
const RED = '#f87171';
const GRID = '#ffffff08';
const AXIS = '#ffffff35';
const MEDIAN_STROKE = '#60a5fa';

function PctBarTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { payload: DistributionPctBarPoint }[];
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
        <div className="flex justify-between gap-4">
          <span className="text-gray-500">Return</span>
          <span
            className={`font-mono tabular-nums font-medium ${p.pnlPct >= 0 ? 'text-emerald-400' : 'text-red-400'}`}
          >
            {p.pnlPct.toFixed(2)}%
          </span>
        </div>
        {typeof p.totalTradeValue === 'number' && Number.isFinite(p.totalTradeValue) ? (
          <div className="flex justify-between gap-4">
            <span className="text-gray-500">Total trade value</span>
            <span className="font-mono tabular-nums text-white">{formatInr(p.totalTradeValue)}</span>
          </div>
        ) : null}
        <div className="pt-1 border-t border-white/10 text-[10px] text-gray-500">
          Sort #{p.idx} (ascending by return %)
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
  const barData = useMemo(() => buildDistributionBarsByPct(trades), [trades]);
  const median = useMemo(() => medianPnL(barData.map((d) => d.pnlPct)), [barData]);

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
  const showPctOnX = barData.length > 0 && barData.length <= 24;
  const bottomMargin = showPctOnX ? 52 : 4;

  return (
    <div className={className} style={{ width: '100%', height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={barData} margin={{ top: 8, right: 8, left: 0, bottom: bottomMargin }}>
          <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
          <XAxis
            dataKey="idx"
            stroke={AXIS}
            tick={{ fontSize: showPctOnX ? 9 : 10 }}
            tickLine={false}
            interval={many ? 'preserveStartEnd' : 0}
            angle={showPctOnX ? -40 : 0}
            textAnchor={showPctOnX ? 'end' : 'middle'}
            height={showPctOnX ? 48 : undefined}
            tickFormatter={(v) => {
              const n = Number(v);
              const row = barData.find((d) => d.idx === n);
              if (showPctOnX && row) return `${row.pnlPct.toFixed(1)}%`;
              return String(n);
            }}
            label={{
              value: showPctOnX
                ? 'Realized return % (ascending)'
                : many
                  ? 'Sorted index (asc by return %)'
                  : 'Sorted index (1 = worst return %)',
              position: 'insideBottom',
              offset: showPctOnX ? -2 : -4,
              fill: '#6b7280',
              fontSize: 10,
            }}
          />
          <YAxis
            stroke={AXIS}
            tick={{ fontSize: 10 }}
            tickFormatter={(v) => `${Number(v).toFixed(1)}%`}
            width={48}
          />
          <Tooltip
            cursor={{ fill: 'rgba(255,255,255,0.04)' }}
            content={(props) => (
              <PctBarTooltip
                active={props.active}
                payload={props.payload as unknown as { payload: DistributionPctBarPoint }[] | undefined}
              />
            )}
          />
          <ReferenceLine y={0} stroke="#ffffff45" strokeWidth={1} />
          <ReferenceLine
            y={median}
            stroke={MEDIAN_STROKE}
            strokeDasharray="5 5"
            strokeWidth={1.5}
            label={{
              value: `Median ${median.toFixed(1)}%`,
              position: 'insideTopRight',
              fill: MEDIAN_STROKE,
              fontSize: 10,
            }}
          />
          <Bar dataKey="pnlPct" radius={[3, 3, 0, 0]} maxBarSize={many ? 6 : 28}>
            {barData.map((entry) => (
              <Cell key={entry.idx} fill={entry.pnlPct >= 0 ? GREEN : RED} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
