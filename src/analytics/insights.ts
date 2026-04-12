import type {
  BasicPnLMetrics,
  BrokerSnapshot,
  ChargesAnalysis,
  InsightItem,
  TradebookAnalytics,
} from './types';

export function buildInsights(
  basic: BasicPnLMetrics | null,
  charges: ChargesAnalysis | null,
  tb: TradebookAnalytics | null,
): InsightItem[] {
  const weaknesses: InsightItem[] = [];
  const strengths: InsightItem[] = [];

  if (basic) {
    if (basic.riskReward < 1 && basic.winRate < 52) {
      weaknesses.push({
        kind: 'weakness',
        title: 'Low R:R with modest win rate',
        detail: 'Payoffs are skewed unfavorably — tighten entries or stretch winners.',
      });
    }
    if (basic.profitFactor >= 1.4 && basic.expectancy > 0) {
      strengths.push({
        kind: 'strength',
        title: 'Solid profit factor',
        detail: 'Gross profits meaningfully exceed gross losses over this window.',
      });
    }
    if (basic.winRate >= 50 && basic.riskReward >= 1.2) {
      strengths.push({
        kind: 'strength',
        title: 'Balanced win rate and payoff',
        detail: 'You are not over-relying on either accuracy or size of winners alone.',
      });
    }
  }

  if (charges) {
    if (charges.chargesPctOfProfit !== null && charges.chargesPctOfProfit > 35) {
      weaknesses.push({
        kind: 'weakness',
        title: 'High cost drag vs profit',
        detail: 'Fees consume a large share of profit — review churn and holding period.',
      });
    }
    if (charges.chargesPctOfProfit !== null && charges.chargesPctOfProfit < 12 && charges.totalCharges > 0) {
      strengths.push({
        kind: 'strength',
        title: 'Efficient cost structure',
        detail: 'Charges are small relative to profit — capital is working, not leaking.',
      });
    }
  }

  if (tb) {
    if (tb.maxDrawdown > 0 && tb.recoveryFactor !== null && tb.recoveryFactor < 1) {
      weaknesses.push({
        kind: 'weakness',
        title: 'Shallow recovery vs drawdown',
        detail: 'Net profit has not comfortably exceeded max equity dip — prioritize risk reduction.',
      });
    }
    if (tb.recoveryFactor !== null && tb.recoveryFactor >= 2) {
      strengths.push({
        kind: 'strength',
        title: 'Strong recovery factor',
        detail: 'Profits have outpaced the worst equity dip in the reconstructed book.',
      });
    }
    if (tb.returnStdDev > 0 && basic && Math.abs(basic.netProfit) > 0) {
      const noisy = tb.returnStdDev > Math.abs(basic.netProfit) / Math.max(8, tb.equityCurve.length * 0.5);
      if (noisy) {
        weaknesses.push({
          kind: 'weakness',
          title: 'High variance in trade outcomes',
          detail: 'P&L swings trade-to-trade — consider sizing rules or playbook consistency.',
        });
      }
    }
    if (
      tb.topDecileContributionPct !== null &&
      tb.topDecileContributionPct > 85 &&
      tb.equityCurve.length >= 8
    ) {
      weaknesses.push({
        kind: 'weakness',
        title: 'Concentrated results',
        detail: 'A handful of trades drive most P&L — dependency risk on rare outcomes.',
      });
    }
  }

  return [...weaknesses, ...strengths];
}

export function computeProgressDeltas(
  previous: BrokerSnapshot | null,
  current: BrokerSnapshot,
): import('./types').ProgressDelta[] {
  if (!previous) return [];
  const p = previous.metrics;
  const c = current.metrics;
  const deltas: import('./types').ProgressDelta[] = [];

  const add = (
    metric: string,
    before: number | null | undefined,
    after: number | null | undefined,
  ) => {
    if (before === null || before === undefined || after === null || after === undefined) return;
    if (Number.isNaN(before) || Number.isNaN(after)) return;
    const improved =
      metric.includes('Drawdown') || metric.includes('charges') || metric.includes('Charges')
        ? after < before
        : after > before;
    const pct =
      Math.abs(before) > 1e-6 ? ((after - before) / Math.abs(before)) * 100 : null;
    deltas.push({ metric, before, after, improved, pctChange: pct });
  };

  if (p.basicPnL && c.basicPnL) {
    add('Profit factor', p.basicPnL.profitFactor, c.basicPnL.profitFactor);
    add('Risk : Reward', p.basicPnL.riskReward, c.basicPnL.riskReward);
    add('Win rate', p.basicPnL.winRate, c.basicPnL.winRate);
  }
  if (p.tradebook && c.tradebook) {
    add('Max drawdown (₹)', p.tradebook.maxDrawdown, c.tradebook.maxDrawdown);
  }

  return deltas.filter((d) => d.improved || (d.pctChange !== null && Math.abs(d.pctChange) > 5));
}
