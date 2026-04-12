import type {
  BasicPnLMetrics,
  ChargesAnalysis,
  MetricInterpretation,
  ParsedPnL,
  MetricTone,
} from './types';

const EPS = 1e-6;

/** Loss beyond this (₹) counts as “large” vs 1% of ₹1L notional risk. */
export const PNL_LARGE_LOSS_THRESHOLD_INR = 1000;

/** KPIs for discipline cards; can be derived from stored `pnlSymbolRows` when metrics JSON is older. */
export type DisciplineKpis = {
  profitabilityPct: number;
  riskControlLargeLossPct: number | null;
  consistencyWinLossRatio: number | null;
  costEfficiencyVsGrossProfitPct: number | null;
  winRowCount: number;
  lossRowCount: number;
  largeLossRowCount: number;
  totalRowCount: number;
};

export function computeDisciplineKpisFromSymbolRows(
  rows: { realizedPnL: number }[],
  charges: ChargesAnalysis | null,
): DisciplineKpis | null {
  const filtered = rows.filter((r) => Number.isFinite(r.realizedPnL));
  if (filtered.length === 0) return null;

  const wins = filtered.filter((r) => r.realizedPnL > EPS);
  const losses = filtered.filter((r) => r.realizedPnL < -EPS);
  const totalRowCount = filtered.length;
  const winRowCount = wins.length;
  const lossRowCount = losses.length;
  const grossWins = wins.reduce((a, r) => a + r.realizedPnL, 0);
  const largeLossRowCount = losses.filter((r) => r.realizedPnL < -PNL_LARGE_LOSS_THRESHOLD_INR).length;

  const profitabilityPct = totalRowCount > 0 ? (winRowCount / totalRowCount) * 100 : 0;
  const riskControlLargeLossPct = lossRowCount > 0 ? (largeLossRowCount / lossRowCount) * 100 : null;
  const consistencyWinLossRatio = lossRowCount > 0 ? winRowCount / lossRowCount : null;
  const costEfficiencyVsGrossProfitPct =
    grossWins > EPS && charges !== null ? (charges.totalCharges / grossWins) * 100 : null;

  return {
    profitabilityPct,
    riskControlLargeLossPct,
    consistencyWinLossRatio,
    costEfficiencyVsGrossProfitPct,
    winRowCount,
    lossRowCount,
    largeLossRowCount,
    totalRowCount,
  };
}

function fmtInr(n: number): string {
  return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
}

function toneForRR(rr: number): MetricTone {
  if (rr >= 2) return 'strong';
  if (rr >= 1) return 'acceptable';
  return 'weak';
}

function toneForWinRate(wr: number): MetricTone {
  if (wr >= 55) return 'strong';
  if (wr >= 45) return 'acceptable';
  return 'weak';
}

function toneForChargesPct(pct: number | null): MetricTone {
  if (pct === null) return 'acceptable';
  if (pct <= 15) return 'strong';
  if (pct <= 35) return 'acceptable';
  return 'weak';
}

export function computeBasicPnLMetrics(parsed: ParsedPnL): BasicPnLMetrics | null {
  const rows = parsed.symbolRows.filter(
    (r) => Math.abs(r.realizedPnL) > EPS || r.quantity > EPS || r.sellValue > EPS,
  );

  if (rows.length === 0) return null;

  const wins = rows.filter((r) => r.realizedPnL > EPS);
  const losses = rows.filter((r) => r.realizedPnL < -EPS);
  const flat = rows.filter((r) => Math.abs(r.realizedPnL) <= EPS);

  const winRowCount = wins.length;
  const lossRowCount = losses.length;
  const flatRowCount = flat.length;
  const totalRowCount = rows.length;

  const grossWins = wins.reduce((a, r) => a + r.realizedPnL, 0);
  const grossLosses = losses.reduce((a, r) => a + r.realizedPnL, 0);

  const largeLossRowCount = losses.filter((r) => r.realizedPnL < -PNL_LARGE_LOSS_THRESHOLD_INR).length;
  const profitabilityPct = totalRowCount > 0 ? (winRowCount / totalRowCount) * 100 : 0;
  const riskControlLargeLossPct =
    lossRowCount > 0 ? (largeLossRowCount / lossRowCount) * 100 : null;
  const consistencyWinLossRatio = lossRowCount > 0 ? winRowCount / lossRowCount : null;

  const withOutcome = wins.length + losses.length;
  const winRate = withOutcome > 0 ? (wins.length / withOutcome) * 100 : 0;

  const avgWin = wins.length ? grossWins / wins.length : 0;
  const avgLoss = losses.length ? grossLosses / losses.length : 0;

  const riskReward =
    avgWin > EPS && avgLoss < -EPS ? avgWin / Math.abs(avgLoss) : avgWin > EPS ? avgWin : 0;

  const profitFactor =
    grossLosses < -EPS ? grossWins / Math.abs(grossLosses) : grossWins > EPS ? 99 : 0;

  const netFromRows = rows.reduce((a, r) => a + r.realizedPnL, 0);
  const symbolRowNetBeforeCharges = netFromRows;
  const summaryNet = parsed.summary.realizedPnL;

  // Broker summary lines are easy to mis-parse (wrong cell, % column, merged cells). Prefer the sum of
  // symbol-level "Realized P&L" when it is clearly non-zero; fall back to summary when the table sums to ~0.
  let netProfit: number;
  if (Math.abs(netFromRows) > EPS) {
    netProfit = netFromRows;
  } else if (summaryNet !== undefined && Number.isFinite(summaryNet)) {
    netProfit = summaryNet;
  } else {
    netProfit = netFromRows;
  }

  const outcomesCount = withOutcome + (flat.length > 0 ? 0 : 0);
  const expectancy = withOutcome > 0 ? (grossWins + grossLosses) / withOutcome : 0;

  const turnover = rows.reduce((a, r) => a + r.buyValue + r.sellValue, 0);

  return {
    netProfit,
    winRate,
    avgWin,
    avgLoss,
    riskReward,
    expectancy,
    profitFactor,
    grossWins,
    grossLosses,
    outcomesCount: withOutcome,
    turnover,
    symbolRowNetBeforeCharges,
    winRowCount,
    lossRowCount,
    flatRowCount,
    totalRowCount,
    profitabilityPct,
    largeLossRowCount,
    riskControlLargeLossPct,
    consistencyWinLossRatio,
  };
}

export function computeChargesAnalysis(
  parsed: ParsedPnL,
  basic: BasicPnLMetrics | null,
): ChargesAnalysis {
  const d = parsed.chargesDetail;
  const total = d.totalCharges > EPS ? d.totalCharges : (parsed.summary.charges ?? 0);

  const net = basic?.netProfit ?? parsed.summary.realizedPnL ?? 0;
  const turnover = basic?.turnover ?? 0;

  const chargesPctOfProfit = net > EPS ? (total / net) * 100 : null;
  const brokeragePctOfTurnover = turnover > EPS ? (d.brokerage / turnover) * 100 : null;
  const sttPctOfProfit = net > EPS ? (d.stt / net) * 100 : null;

  const grossProfitForCost = basic && basic.grossWins > EPS ? basic.grossWins : null;
  const costEfficiencyVsGrossProfitPct =
    grossProfitForCost !== null ? (total / grossProfitForCost) * 100 : null;

  const rowNetBeforeCharges =
    basic !== null
      ? (basic.symbolRowNetBeforeCharges ?? basic.grossWins + basic.grossLosses)
      : null;
  const profitAfterFeesAndCharges =
    rowNetBeforeCharges !== null ? rowNetBeforeCharges - total : null;

  return {
    brokerage: d.brokerage,
    stt: d.stt,
    gst: d.gst,
    stampDuty: d.stampDuty ?? 0,
    dpCharges: d.dpCharges ?? 0,
    stcgTax: d.stcgTax ?? 0,
    otherCharges: d.otherCharges,
    totalCharges: total,
    chargesPctOfProfit,
    brokeragePctOfTurnover,
    sttPctOfProfit,
    costEfficiencyVsGrossProfitPct,
    profitAfterFeesAndCharges,
  };
}

export function buildPnLInterpretations(
  basic: BasicPnLMetrics | null,
  charges: ChargesAnalysis,
): MetricInterpretation[] {
  const out: MetricInterpretation[] = [];

  if (basic) {
    out.push({
      metricKey: 'rr',
      label: 'Risk : Reward',
      value: basic.riskReward.toFixed(2),
      tone: toneForRR(basic.riskReward),
      message:
        basic.riskReward < 1
          ? 'Low R:R — winners may be cut early vs losers; review exits and position sizing.'
          : basic.riskReward >= 2
            ? 'Healthy payoff ratio — edge is driven by asymmetric payoffs.'
            : 'Acceptable R:R — room to let winners run further.',
    });

    out.push({
      metricKey: 'winRate',
      label: 'Win rate',
      value: `${basic.winRate.toFixed(1)}%`,
      tone: toneForWinRate(basic.winRate),
      message:
        basic.winRate < 40
          ? 'Win rate is low — strategy may rely on large winners; ensure R:R supports it.'
          : 'Win rate looks balanced vs payoff structure.',
    });

    out.push({
      metricKey: 'profitFactor',
      label: 'Profit factor',
      value: basic.profitFactor.toFixed(2),
      tone: basic.profitFactor >= 1.5 ? 'strong' : basic.profitFactor >= 1 ? 'acceptable' : 'weak',
      message:
        basic.profitFactor < 1
          ? 'Profit factor below 1 — gross losses exceed gross wins over this window.'
          : 'Profit factor supports a positive expectancy.',
    });

    out.push({
      metricKey: 'expectancy',
      label: 'Expectancy / symbol (realized)',
      value: fmtInr(basic.expectancy),
      tone: basic.expectancy > 0 ? 'strong' : basic.expectancy === 0 ? 'acceptable' : 'weak',
      message:
        basic.expectancy <= 0
          ? 'Negative average outcome per realized symbol — review setups and frequency.'
          : 'Positive average realized outcome per active symbol row.',
    });
  }

  out.push({
    metricKey: 'chargesPct',
    label: 'Charges % of profit',
    value: charges.chargesPctOfProfit === null ? '—' : `${charges.chargesPctOfProfit.toFixed(1)}%`,
    tone: toneForChargesPct(charges.chargesPctOfProfit),
    message:
      charges.chargesPctOfProfit !== null && charges.chargesPctOfProfit > 40
        ? 'High charges vs profit — possible overtrading or tight targets; trim frequency or size.'
        : 'Cost drag is within a reasonable band vs reported profit.',
  });

  out.push({
    metricKey: 'sttPct',
    label: 'STT % of profit',
    value: charges.sttPctOfProfit === null ? '—' : `${charges.sttPctOfProfit.toFixed(1)}%`,
    tone:
      charges.sttPctOfProfit === null
        ? 'acceptable'
        : charges.sttPctOfProfit > 25
          ? 'weak'
          : 'acceptable',
    message:
      charges.sttPctOfProfit !== null && charges.sttPctOfProfit > 25
        ? 'STT is eating a large share of profit — fewer round-trips or larger hold periods may help.'
        : 'STT burden looks moderate relative to profit.',
  });

  return out;
}
