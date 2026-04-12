import type { PnlChartTrade } from './types';

export function medianPnL(values: number[]): number {
  if (values.length === 0) return 0;
  const s = [...values].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 === 1 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
}

/** Peak-to-trough drawdown on the equity series (non-positive; 0 = no drawdown). */
export function maxDrawdownFromEquity(equities: number[]): number {
  if (equities.length === 0) return 0;
  let peak = equities[0]!;
  let maxDd = 0;
  for (const eq of equities) {
    peak = Math.max(peak, eq);
    maxDd = Math.min(maxDd, eq - peak);
  }
  return maxDd;
}

export function filterChartTrades(trades: PnlChartTrade[]): PnlChartTrade[] {
  return trades.filter((t) => Number.isFinite(t.pnl));
}

export type DistributionBarPoint = {
  idx: number;
  pnl: number;
  label?: string;
};

/** Ascending PnL: largest losses left, largest profits right. */
export function buildDistributionBars(trades: PnlChartTrade[]): DistributionBarPoint[] {
  const rows = filterChartTrades(trades);
  const sorted = [...rows].sort((a, b) => a.pnl - b.pnl);
  return sorted.map((t, i) => ({
    idx: i + 1,
    pnl: t.pnl,
    label: t.label,
  }));
}

export type EquityPoint = {
  tradeIndex: number;
  equity: number;
  pnl: number;
  label?: string;
};

export type BuildEquityCurveOptions = {
  /** Include (0, 0) before the first trade so the path starts at zero P&amp;L. */
  includeOrigin?: boolean;
};

/** Cumulative equity in the order trades appear (e.g. workbook row order). */
export function buildEquityCurve(
  trades: PnlChartTrade[],
  options?: BuildEquityCurveOptions,
): EquityPoint[] {
  const rows = filterChartTrades(trades);
  const out: EquityPoint[] = [];
  let equity = 0;

  if (options?.includeOrigin) {
    out.push({ tradeIndex: 0, equity: 0, pnl: 0 });
  }

  for (let i = 0; i < rows.length; i++) {
    const t = rows[i]!;
    equity += t.pnl;
    out.push({
      tradeIndex: i + 1,
      equity,
      pnl: t.pnl,
      label: t.label,
    });
  }

  return out;
}

export function netProfitFromTrades(trades: PnlChartTrade[]): number {
  return filterChartTrades(trades).reduce((a, t) => a + t.pnl, 0);
}
