import React from 'react';

type JournalStats = {
  winRate: number;
  totalProfit: number;
  avgGain: number;
  avgLoss: number;
  expectancy: number;
  total: number;
};

export function JournalIntroHelpContent() {
  return (
    <>
      <p className="text-gray-400">
        These analytics use only trades you mark <span className="text-gray-200">Closed</span> in this app. Open
        positions are ignored until you close them.
      </p>
      <p className="text-gray-400 text-[12px]">
        Percentages and R-multiples are based on your logged entry, stop, and exit — not broker charges.
      </p>
    </>
  );
}

export function JournalStatsHelpContent({ stats }: { stats: JournalStats }) {
  const wrOk = stats.winRate >= 45;
  return (
    <>
      <p className="text-gray-400">
        Win rate is winning closed trades ÷ all closed trades. Expectancy is average R-multiple per closed trade (from
        your stop distance). Avg gain/loss are average <span className="text-gray-200">percentage</span> move on wins vs
        losses.
      </p>
      <p className="text-sky-200/90 border-t border-white/10 pt-2 mt-1">
        You have {stats.total} closed trade(s). Win rate {stats.winRate.toFixed(1)}% —{' '}
        {wrOk ? 'in a band many swing systems can work with.' : 'on the low side unless your R-multiples are large.'}{' '}
        Expectancy {stats.expectancy.toFixed(2)}R —{' '}
        {stats.expectancy > 0 ? 'positive average R per trade in the journal.' : 'flat or negative average R.'}
      </p>
    </>
  );
}

export function JournalEquityHelpContent() {
  return (
    <>
      <p className="text-gray-400">
        Starts from your <span className="text-gray-200">Settings → total capital</span> and adds each closed trade’s
        dollar P&L in chronological order. It shows journal-tracked equity, not your broker statement.
      </p>
      <p className="text-gray-400 text-[12px]">Slope and smoothness hint at consistency; sharp drops mean large losing exits in sequence.</p>
    </>
  );
}

export function JournalVerdictHelpContent() {
  return (
    <>
      <p className="text-gray-400">
        Each closed trade has a verdict (A+, A, B, Avoid) from your scoring rules. This chart shows how often each bucket
        wins — so you can see if your highest-conviction tags actually perform.
      </p>
      <p className="text-sky-200/90 border-t border-white/10 pt-2 mt-1">
        If “Avoid” or “B” wins often, your scoring may be misaligned with outcomes — or sample size is still small.
      </p>
    </>
  );
}

export function JournalInsightsHelpContent() {
  return (
    <>
      <p className="text-gray-400">
        These cards are static prompts to review process: one highlights your best verdict bucket; the other reminds you
        to check common mistakes on losers.
      </p>
      <p className="text-gray-400 text-[12px]">Use them as journal prompts, not automated diagnoses.</p>
    </>
  );
}
