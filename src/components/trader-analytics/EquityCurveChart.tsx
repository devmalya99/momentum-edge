'use client';

import { useMemo } from 'react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { PnlChartTrade } from '@/analytics/types';
import { buildEquityCurve, type EquityPoint, type BuildEquityCurveOptions } from '@/analytics/pnlChartMath';
import { formatInr } from '@/lib/format-inr';

const GRID = '#ffffff08';
const AXIS = '#ffffff35';

function EquityTooltipBody({
  active,
  payload,
  cumulativeLabel,
}: {
  active?: boolean;
  payload?: { payload: EquityPoint }[];
  cumulativeLabel: string;
}) {
  if (!active || !payload?.length) return null;
  const d = payload[0]!.payload;
  return (
    <div className="rounded-xl border border-white/10 bg-[#1a1a1c] px-3 py-2 text-xs shadow-xl">
      <div className="mb-1.5 font-medium text-gray-400">
        {d.tradeIndex === 0
          ? 'Start'
          : d.label
            ? `${d.label} · trade #${d.tradeIndex}`
            : `Trade #${d.tradeIndex}`}
      </div>
      <div className="font-semibold text-white">
        {cumulativeLabel} {formatInr(d.equity)}
      </div>
      {d.tradeIndex > 0 ? (
        <div className="mt-0.5 text-gray-400">This row {formatInr(d.pnl)}</div>
      ) : null}
    </div>
  );
}

type Props = {
  trades: PnlChartTrade[];
  className?: string;
  height?: number;
  curveOptions?: BuildEquityCurveOptions;
  /** X-axis caption (default: symbol row / file order). */
  xAxisLabel?: string;
  /** Tooltip / semantics: cumulative profit vs generic equity. */
  cumulativeLabel?: string;
};

export default function EquityCurveChart({
  trades,
  className,
  height = 260,
  curveOptions,
  xAxisLabel = 'Symbol row order (file)',
  cumulativeLabel = 'Cumulative',
}: Props) {
  const data = useMemo(() => buildEquityCurve(trades, curveOptions), [trades, curveOptions]);
  const lastEquity = data.length ? data[data.length - 1]!.equity : 0;
  const lineColor = lastEquity >= 0 ? '#22c55e' : '#f87171';

  if (data.length === 0) {
    return (
      <div
        className={`flex items-center justify-center rounded-2xl border border-dashed border-white/10 text-sm text-gray-500 ${className ?? ''}`}
        style={{ minHeight: height, height }}
      >
        No P&amp;L rows to chart.
      </div>
    );
  }

  return (
    <div className={className} style={{ width: '100%', height }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
          <XAxis
            dataKey="tradeIndex"
            stroke={AXIS}
            tick={{ fontSize: 10 }}
            tickLine={false}
            label={{
              value: xAxisLabel,
              position: 'insideBottom',
              offset: -2,
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
            cursor={{ stroke: 'rgba(255,255,255,0.15)' }}
            content={(props) => (
              <EquityTooltipBody
                active={props.active}
                payload={props.payload as unknown as { payload: EquityPoint }[] | undefined}
                cumulativeLabel={cumulativeLabel}
              />
            )}
          />
          <ReferenceLine y={0} stroke="#ffffff45" strokeDasharray="4 4" />
          <Line
            type="monotone"
            dataKey="equity"
            stroke={lineColor}
            strokeWidth={2.5}
            dot={false}
            activeDot={{ r: 4, strokeWidth: 0, fill: lineColor }}
            animationDuration={600}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
