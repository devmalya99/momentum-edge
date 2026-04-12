import React from 'react';
import type { BasicPnLMetrics, BrokerSnapshot, ChargesAnalysis, HealthScoreResult } from '@/analytics/types';
import { formatInr } from '@/lib/format-inr';

export function HealthHelpContent({ health }: { health: HealthScoreResult }) {
  const catHint =
    health.category === 'Advanced'
      ? 'Strong overall profile on this snapshot.'
      : health.category === 'Consistent'
        ? 'Solid middle ground — a few dimensions still have room to improve.'
        : health.category === 'Developing'
          ? 'Several pillars are weak; focus on one fix at a time (risk, costs, or consistency).'
          : 'Early stage on this data — treat numbers as a baseline, not a verdict on you as a trader.';

  return (
    <>
      <p className="text-gray-400">
        Blends four pillars: profitability, risk control, consistency, and cost efficiency into one 0–100 score. It
        reflects this import only, not future results.
      </p>
      <p className="text-sky-200/90 border-t border-white/10 pt-2 mt-1">
        Your score is {health.score}/100 ({health.category}). {catHint}
      </p>
      <ul className="list-disc pl-4 text-gray-400 space-y-1 text-[12px]">
        <li>
          <span className="text-gray-300">Profitability</span> — Net positive with reasonable profit factor?
        </li>
        <li>
          <span className="text-gray-300">Risk control</span> — Drawdown manageable vs what you made?
        </li>
        <li>
          <span className="text-gray-300">Consistency</span> — Win rate and R:R in a sane band; not wildly noisy.
        </li>
        <li>
          <span className="text-gray-300">Cost efficiency</span> — Fees not eating most of the profit.
        </li>
      </ul>
    </>
  );
}

export function ProgressHelpContent() {
  return (
    <>
      <p className="text-gray-400">
        Compares this snapshot to the previous one you saved. Only metrics that exist in both imports are shown.
      </p>
      <p className="text-gray-400">
        For drawdown and charge ratios, a <span className="text-gray-200">drop</span> usually means improvement. For
        profit factor, R:R, and win rate, a <span className="text-gray-200">rise</span> usually means improvement.
      </p>
    </>
  );
}

export function CorePnLHelpContent({ basic }: { basic: BasicPnLMetrics }) {
  const pfOk = basic.profitFactor >= 1.5;
  const rrOk = basic.riskReward >= 1.2;
  const wrOk = basic.winRate >= 45;

  return (
    <>
      <p className="text-gray-400">
        The <span className="text-gray-200">P&amp;L overview</span> cards split gross profit on winning symbol rows,
        gross loss on losing rows, all fees parsed from the charges section, and what is left after subtracting those
        fees from the sum of symbol realized P&amp;L. The headline row (net, win rate, profit factor, R:R) still uses
        the same symbol table; net profit may follow the broker summary when the row sum is effectively zero.
      </p>
      <p className="text-sky-200/90 border-t border-white/10 pt-2 mt-1">
        Net profit {basic.netProfit >= 0 ? 'is positive' : 'is negative'} at {formatInr(basic.netProfit)}.{' '}
        {pfOk
          ? `Profit factor ${basic.profitFactor.toFixed(2)} is healthy (many traders aim for roughly 1.2–1.5+). `
          : `Profit factor ${basic.profitFactor.toFixed(2)} is tight — gross wins are not clearly ahead of gross losses. `}
        {rrOk
          ? `R:R ${basic.riskReward.toFixed(2)} suggests average wins are meaningful vs average losses. `
          : `R:R ${basic.riskReward.toFixed(2)} is low — winners may be small vs losers, or a few symbols skew stats. `}
        {wrOk
          ? `Win rate ${basic.winRate.toFixed(0)}% is in a workable band for many systems.`
          : `Win rate ${basic.winRate.toFixed(0)}% is on the low side unless your R:R is very strong.`}
      </p>
    </>
  );
}

export function AvgWinLossHelpContent({ basic }: { basic: BasicPnLMetrics }) {
  return (
    <>
      <p className="text-gray-400">
        Average win is the mean realized profit on winning symbol rows; average loss is the mean on losing rows
        (usually negative). Expectancy is average realized P&L per row that had a win or a loss.
      </p>
      <p className="text-sky-200/90 border-t border-white/10 pt-2 mt-1">
        Your avg win is {formatInr(basic.avgWin)} and avg loss is {formatInr(basic.avgLoss)}. Expectancy per active row
        is {formatInr(basic.expectancy)}
        {basic.expectancy > 0 ? ' — positive expectancy on this file.' : ' — flat or negative on this file.'}
      </p>
    </>
  );
}

export function ChargesHelpContent({
  charges,
  netProfit,
}: {
  charges: ChargesAnalysis;
  netProfit: number;
}) {
  const pct = charges.chargesPctOfProfit;
  const stt = charges.sttPctOfProfit;
  const brok = charges.brokeragePctOfTurnover;

  return (
    <>
      <p className="text-gray-400">
        Taken from the charges section of your P&L. We split brokerage, STT, GST, stamp duty, DP/CDSL-style lines, STCG /
        capital-gains tax when labeled, and other exchange/SEBI-type fees. “% of profit” uses broker-reported net
        profit; <span className="text-gray-200">cost efficiency</span> in discipline cards uses total fees ÷ sum of
        winning rows × 100. Brokerage % of turnover shows fee friction vs traded notional.
      </p>
      <p className="text-sky-200/90 border-t border-white/10 pt-2 mt-1">
        Total charges {formatInr(charges.totalCharges)}
        {netProfit > 0 && pct !== null
          ? ` — about ${pct.toFixed(1)}% of your ${formatInr(netProfit)} profit. `
          : '. '}
        {pct !== null && pct > 35
          ? 'That share is high — you may be over-trading or targeting very small moves.'
          : pct !== null && pct < 15
            ? 'Cost drag is relatively small vs profit.'
            : pct !== null
              ? 'Moderate drag — compare to your style and holding period.'
              : ''}
      </p>
      {stt !== null && (
        <p className="text-gray-400 text-[12px]">
          STT is ~{stt.toFixed(1)}% of profit — STT rises with sell activity; many small sells inflate this.
        </p>
      )}
      {brok !== null && (
        <p className="text-gray-400 text-[12px]">
          Brokerage is ~{brok.toFixed(3)}% of turnover — sanity-check vs your broker plan and churn.
        </p>
      )}
    </>
  );
}

export function InterpretationHelpContent() {
  return (
    <>
      <p className="text-gray-400">
        Each card combines your number with a plain-English read. Colors are rules of thumb, not guarantees.
      </p>
      <ul className="list-disc pl-4 text-gray-400 space-y-1 text-[12px]">
        <li>
          <span className="text-emerald-400">Green</span> — looks strong for typical discretionary trading.
        </li>
        <li>
          <span className="text-sky-400">Blue</span> — acceptable; watch it if other cards are red.
        </li>
        <li>
          <span className="text-rose-400">Red</span> — likely hurting results; review stops, targets, frequency, or
          costs.
        </li>
      </ul>
    </>
  );
}

export function EdgeDetectionHelpContent() {
  return (
    <>
      <p className="text-gray-400">
        Automatic flags from your numbers: strengths look supportive; “watch” items are common leak areas (drawdown,
        costs, variance, concentration).
      </p>
      <p className="text-gray-400 text-[12px]">Prompts for review, not personalized advice — check against your rules and journal.</p>
    </>
  );
}

export function ImprovementTrackingHelpContent({ snapshots }: { snapshots: BrokerSnapshot[] }) {
  return (
    <>
      <p className="text-gray-400">
        Each point is one saved P&amp;L import (left → right = oldest → newest). We plot profit factor and R:R when
        available; otherwise net profit from the workbook.
      </p>
      <p className="text-sky-200/90 border-t border-white/10 pt-2 mt-1">
        You have {snapshots.length} snapshot(s). Rising lines on the shown metrics usually mean improvement across
        uploads.
      </p>
    </>
  );
}

export function UploadHelpContent() {
  return (
    <>
      <p className="text-gray-400">
        Zerodha-style equity P&amp;L workbook (.xlsx): summary block (Charges, Other Credit &amp; Debit, Realized /
        Unrealized P&amp;L) and the symbol table (Quantity, Buy Value, Sell Value, Realized P&amp;L, Realized P&amp;L Pct.
        when present).
      </p>
      <p className="text-gray-400 text-[12px]">
        IndexedDB stores <span className="text-gray-300">pnl_summary</span> (those four headline fields) and{' '}
        <span className="text-gray-300">trade_details</span> (symbol, realised P&amp;L, %, and quantity × buy value) per
        snapshot.
      </p>
    </>
  );
}

export function ProfitabilityDisciplineHelpContent({ basic }: { basic: BasicPnLMetrics }) {
  return (
    <>
      <p className="text-gray-400">
        Share of symbol rows in your P&amp;L export where realized P&amp;L is <span className="text-gray-200">strictly positive</span>,
        divided by <span className="text-gray-200">all symbol rows</span> (including breakeven). This is a hit-rate on booked outcomes, not
        the same as win rate (which ignores breakeven rows in the denominator).
      </p>
      <p className="text-sky-200/90 border-t border-white/10 pt-2 mt-1 text-[12px]">
        Here: {basic.winRowCount} profitable / {basic.totalRowCount} rows = {basic.profitabilityPct.toFixed(1)}%.
      </p>
    </>
  );
}

export function RiskControlDisciplineHelpContent({ basic }: { basic: BasicPnLMetrics }) {
  return (
    <>
      <p className="text-gray-400">
        Among rows that <span className="text-gray-200">lost money</span>, what fraction lost more than{' '}
        <span className="text-gray-200">₹1,000</span> on that symbol? We treat ₹1,000 as a 1% loss on ₹1L notional risk — adjust your mental
        benchmark if your capital differs. <span className="text-gray-200">Lower is better</span> (fewer “large” losers vs your losing set).
      </p>
      <p className="text-sky-200/90 border-t border-white/10 pt-2 mt-1 text-[12px]">
        {basic.lossRowCount === 0
          ? 'No losing rows — metric not applicable.'
          : `${basic.largeLossRowCount} large losses (worse than −₹1,000) / ${basic.lossRowCount} losing rows.`}
      </p>
    </>
  );
}

export function CostEfficiencyDisciplineHelpContent() {
  return (
    <>
      <p className="text-gray-400">
        <span className="text-gray-200">Total charges</span> (brokerage, STT, GST, stamp duty, DP charges, STCG / capital-gains tax when parsed,
        plus other labeled fees) divided by the <span className="text-gray-200">sum of winning rows’ realized P&amp;L</span>, times 100. It answers:
        “What share of gross profit taken from winners is eaten by fees?”
      </p>
      <p className="text-gray-400 text-[12px]">
        If there are no winning rows, we cannot form this ratio — you’ll see a dash. Lower percentages mean more of your gross profit survives
        costs.
      </p>
    </>
  );
}

export function ConsistencyDisciplineHelpContent({ basic }: { basic: BasicPnLMetrics }) {
  return (
    <>
      <p className="text-gray-400">
        <span className="text-gray-200">Count of profitable symbol rows ÷ count of losing symbol rows.</span> Higher means more winning lines
        than losing lines in the export (not dollar-weighted). If there are no losing rows, the ratio is not shown.
      </p>
      <p className="text-sky-200/90 border-t border-white/10 pt-2 mt-1 text-[12px]">
        {basic.lossRowCount === 0
          ? 'No losing rows — ratio undefined.'
          : `Ratio ${basic.consistencyWinLossRatio!.toFixed(2)} (${basic.winRowCount} wins : ${basic.lossRowCount} losses).`}
      </p>
    </>
  );
}

export function PnlOverviewBreakdownHelpContent() {
  return (
    <>
      <p className="text-gray-400">
        <span className="text-gray-200">Gross profit</span> sums realized P&amp;L only on winning symbol rows.{' '}
        <span className="text-gray-200">Total loss</span> is the sum of negative realized P&amp;L (shown as a negative rupee total).{' '}
        <span className="text-gray-200">Total charges</span> is everything we parsed in the fee breakdown.{' '}
        <span className="text-gray-200">After fees</span> is (sum of all symbol realized P&amp;L rows) minus total charges — your take-home from
        the table before other adjustments.
      </p>
      <p className="text-gray-400 text-[12px]">
        Symbol P&amp;L may already include some per-trade costs at the broker; account-level taxes and DP lines are subtracted again via the
        charges block when present.
      </p>
    </>
  );
}

export function NetProfitStatHelpContent({ basic }: { basic: BasicPnLMetrics }) {
  return (
    <>
      <p className="text-gray-400">
        Primary net figure used across the app: sum of symbol realized P&amp;L when that sum is meaningful, otherwise the broker summary line.
        Compare to <span className="text-gray-200">After fees</span> in the overview for cash left after parsed account charges.
      </p>
    </>
  );
}

export function WinRateStatHelpContent() {
  return (
    <>
      <p className="text-gray-400">
        Winning symbol rows ÷ (winning + losing rows); breakeven rows are excluded. Classic “win rate” on outcomes with a clear sign.
      </p>
    </>
  );
}

export function ProfitFactorStatHelpContent() {
  return (
    <>
      <p className="text-gray-400">
        Gross profits from winning rows divided by the absolute value of gross losses from losing rows. Above 1 means aggregate wins exceed
        aggregate losses before fee context.
      </p>
    </>
  );
}

export function RiskRewardStatHelpContent() {
  return (
    <>
      <p className="text-gray-400">
        Average winning row’s P&amp;L divided by the average losing row’s P&amp;L (as a positive magnitude). Describes typical payoff asymmetry
        across symbols in this file.
      </p>
    </>
  );
}

