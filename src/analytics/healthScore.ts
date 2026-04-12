import type { BasicPnLMetrics, BrokerSnapshotMetrics, ChargesAnalysis, HealthScoreResult, TradebookAnalytics } from './types';

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

export function computeHealthScore(m: BrokerSnapshotMetrics): HealthScoreResult {
  const b = m.basicPnL;
  const ch = m.charges;
  const tb = m.tradebook;

  const breakdown: HealthScoreResult['breakdown'] = [];

  let score = 0;

  // Profitability (0–30)
  let pPts = 15;
  if (b) {
    if (b.netProfit > 0) pPts += 10;
    else pPts -= 10;
    if (b.profitFactor >= 1.5) pPts += 5;
    else if (b.profitFactor >= 1) pPts += 2;
    else pPts -= 8;
  } else if (tb?.equityCurve?.length) {
    const net = tb.equityCurve[tb.equityCurve.length - 1].equity;
    if (net > 0) pPts += 12;
    else pPts -= 8;
  }
  pPts = clamp(pPts, 0, 30);
  breakdown.push({ label: 'Profitability', points: Math.round(pPts), max: 30 });
  score += pPts;

  // Risk control (0–25)
  let rPts = 10;
  if (tb) {
    if (tb.recoveryFactor !== null && tb.recoveryFactor >= 2) rPts += 10;
    else if (tb.recoveryFactor !== null && tb.recoveryFactor >= 1) rPts += 5;
    if (tb.maxDrawdown > 0 && b && Math.abs(b.netProfit) > 0) {
      const ddRatio = tb.maxDrawdown / Math.abs(b.netProfit);
      if (ddRatio < 0.5) rPts += 5;
      else if (ddRatio > 2) rPts -= 8;
    }
  } else {
    rPts = 12;
  }
  rPts = clamp(rPts, 0, 25);
  breakdown.push({ label: 'Risk control', points: Math.round(rPts), max: 25 });
  score += rPts;

  // Consistency (0–25)
  let cPts = 10;
  if (b) {
    if (b.winRate >= 45 && b.winRate <= 62 && b.riskReward >= 1) cPts += 10;
    else if (b.winRate >= 40) cPts += 5;
    if (tb && tb.returnStdDev > 0 && b.netProfit !== 0) {
      const coef = tb.returnStdDev / (Math.abs(b.netProfit) / Math.max(5, tb.equityCurve.length));
      if (coef < 1.2) cPts += 5;
      else if (coef > 3) cPts -= 6;
    } else {
      cPts += 3;
    }
  }
  cPts = clamp(cPts, 0, 25);
  breakdown.push({ label: 'Consistency', points: Math.round(cPts), max: 25 });
  score += cPts;

  // Cost efficiency (0–20)
  let costPts = 10;
  costPts += scoreCostEfficiency(ch, b, tb);
  costPts = clamp(costPts, 0, 20);
  breakdown.push({ label: 'Cost efficiency', points: Math.round(costPts), max: 20 });
  score += costPts;

  score = Math.round(clamp(score, 0, 100));

  const category: HealthScoreResult['category'] =
    score < 35 ? 'Beginner' : score < 55 ? 'Developing' : score < 75 ? 'Consistent' : 'Advanced';

  return { score, category, breakdown };
}

function scoreCostEfficiency(
  ch: ChargesAnalysis | null,
  b: BasicPnLMetrics | null,
  _tb: TradebookAnalytics | null,
): number {
  if (!ch || !b) return 5;
  let pts = 8;
  const vsGross = ch.costEfficiencyVsGrossProfitPct;
  const vsNet = ch.chargesPctOfProfit;
  const primary = vsGross !== null ? vsGross : vsNet;
  if (primary !== null) {
    if (primary < 12) pts += 6;
    else if (primary < 25) pts += 3;
    else if (primary > 40) pts -= 8;
  } else if (vsNet !== null) {
    if (vsNet < 12) pts += 4;
    else if (vsNet > 40) pts -= 6;
  }
  if (ch.brokeragePctOfTurnover !== null) {
    if (ch.brokeragePctOfTurnover < 0.05) pts += 3;
    else if (ch.brokeragePctOfTurnover > 0.2) pts -= 4;
  }
  return pts;
}
