'use client';

import { useMemo } from 'react';
import type { PnlChartTrade } from '@/analytics/types';
import {
  buildDistributionBars,
  buildEquityCurve,
  maxDrawdownFromEquity,
  medianPnL,
  netProfitFromTrades,
} from '@/analytics/pnlChartMath';
import { formatInr } from '@/lib/format-inr';
import { SectionTitleRow } from './SectionInfo';
import TradeDistributionChart from './TradeDistributionChart';
import EquityCurveChart from './EquityCurveChart';

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="p-4 rounded-2xl bg-[#161618] border border-white/5">
      <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">{label}</div>
      <div className="text-lg font-bold tabular-nums">{value}</div>
    </div>
  );
}

export default function PnlSymbolChartsBlock({
  rows,
}: {
  rows: { symbol: string; realizedPnL: number }[];
}) {
  const trades: PnlChartTrade[] = useMemo(
    () => rows.map((r) => ({ pnl: r.realizedPnL, label: r.symbol })),
    [rows],
  );

  const barData = useMemo(() => buildDistributionBars(trades), [trades]);
  const median = useMemo(() => medianPnL(barData.map((d) => d.pnl)), [barData]);
  const pnls = useMemo(() => trades.map((t) => t.pnl), [trades]);
  const maxLoss = pnls.length ? Math.min(...pnls) : 0;
  const maxProfit = pnls.length ? Math.max(...pnls) : 0;
  const equityPts = useMemo(() => buildEquityCurve(trades), [trades]);
  const maxDd = maxDrawdownFromEquity(equityPts.map((e) => e.equity));
  const net = netProfitFromTrades(trades);
  const count = trades.length;

  return (
    <section className="space-y-4">
      <SectionTitleRow title="P&L workbook — trade distribution & equity" infoLabel="How to read these charts">
        <p className="text-gray-400 text-sm">
          Bars use <span className="text-white font-semibold">realized P&L per symbol</span>, sorted from worst loss to
          best profit. The dashed line is the median realized P&L — it highlights skew and outliers.
        </p>
        <p className="text-gray-400 text-sm mt-2">
          The equity curve cumulates the same amounts in <span className="text-white font-semibold">spreadsheet row order</span>{' '}
          (as in your file), so it reflects how running P&L built up as rows appear in the export — not chronological trade
          time unless your sheet is already time-ordered.
        </p>
      </SectionTitleRow>

      <div className="grid lg:grid-cols-2 gap-8">
        <div className="p-6 rounded-3xl bg-[#161618] border border-white/5 space-y-4 min-h-[320px]">
          <h4 className="text-sm font-bold text-gray-300">Realized P&L distribution</h4>
          <p className="text-xs text-gray-500 -mt-2">Sorted ascending; green = profit, red = loss.</p>
          <div className="h-[240px] w-full">
            <TradeDistributionChart trades={trades} height={240} />
          </div>
        </div>
        <div className="p-6 rounded-3xl bg-[#161618] border border-white/5 space-y-4 min-h-[320px]">
          <h4 className="text-sm font-bold text-gray-300">Cumulative equity curve</h4>
          <p className="text-xs text-gray-500 -mt-2">Running sum in file row order; line green if ending above zero.</p>
          <div className="h-[240px] w-full">
            <EquityCurveChart trades={trades} height={240} />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <MiniStat label="Net profit (rows)" value={formatInr(net)} />
        <MiniStat label="Symbols (rows)" value={String(count)} />
        <MiniStat label="Max drawdown" value={formatInr(Math.abs(maxDd), { min: 0, max: 0 })} />
        <MiniStat label="Median P&L" value={formatInr(median, { min: 1, max: 2 })} />
        <MiniStat label="Max loss (row)" value={formatInr(maxLoss)} />
        <MiniStat label="Max profit (row)" value={formatInr(maxProfit)} />
      </div>
    </section>
  );
}
