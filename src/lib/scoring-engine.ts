import type { AiAnalysis } from '@/lib/validations/stock-schema';

export const SCORING_DICTIONARY = {
  financials: {
    hyper: 5,
    good: 3.5,
    avg: 1.5,
    low: 0,
  },
  qualitative: {
    yes: 16.66,
    neutral: 8,
    bad: 0,
  },
  valuation: {
    undervalued: 5,
    fair: 2.5,
    overvalued: 0,
  },
  technicals: {
    trend: {
      bullish: 8,
      consolidation: 4,
      bearish: 0,
    },
    relativeStrength: {
      outperforming: 6,
      neutral: 3,
      underperforming: 0,
    },
    momentumRSI: {
      healthy: 3,
      oversold: 1.5,
      overbought: 0,
    },
    volumeAccumulation: {
      accumulating: 3,
      distributing: 0,
    },
  },
} as const;

type Verdict = 'Strong Buy' | 'Accumulate' | 'Hold' | 'Avoid';

export type QuantamentalScoredResult = {
  data: AiAnalysis;
  scores: {
    financial: number;
    qualitative: number;
    valuation: number;
    technical: number;
    total: number;
  };
  verdict: Verdict;
};

function roundTo2(value: number): number {
  return Number(value.toFixed(2));
}

function toSafeNumber(value: number | undefined): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function getVerdict(totalScore: number): Verdict {
  if (totalScore >= 80) return 'Strong Buy';
  if (totalScore >= 65) return 'Accumulate';
  if (totalScore >= 50) return 'Hold';
  return 'Avoid';
}

export function calculateQuantamentalScore(parsedData: AiAnalysis): QuantamentalScoredResult {
  const financialMetrics = parsedData.analysis.financialAnalysis.metrics;
  const financialScore = roundTo2(
    toSafeNumber(SCORING_DICTIONARY.financials[financialMetrics.revenueGrowth]) +
      toSafeNumber(SCORING_DICTIONARY.financials[financialMetrics.epsGrowth]) +
      toSafeNumber(SCORING_DICTIONARY.financials[financialMetrics.marginExpansion]) +
      toSafeNumber(SCORING_DICTIONARY.financials[financialMetrics.freeCashFlow]),
  );

  const qualitativeMetrics = parsedData.analysis.qualitativeAnalysis.metrics;
  const qualitativeScore = roundTo2(
    qualitativeMetrics.reduce((sum, metric) => {
      return sum + toSafeNumber(SCORING_DICTIONARY.qualitative[metric.verdict]);
    }, 0),
  );

  const valuationData = parsedData.analysis.valuationAnalysis;
  const valuationScore = roundTo2(
    toSafeNumber(SCORING_DICTIONARY.valuation[valuationData.vsIndustry.rating]) +
      toSafeNumber(SCORING_DICTIONARY.valuation[valuationData.vsHistory.rating]),
  );

  const technicalData = parsedData.analysis.technicalAnalysis;
  const technicalScore = roundTo2(
    toSafeNumber(SCORING_DICTIONARY.technicals.trend[technicalData.trend.status]) +
      toSafeNumber(
        SCORING_DICTIONARY.technicals.relativeStrength[technicalData.relativeStrength.status],
      ) +
      toSafeNumber(SCORING_DICTIONARY.technicals.momentumRSI[technicalData.momentumRSI.status]) +
      toSafeNumber(
        SCORING_DICTIONARY.technicals.volumeAccumulation[technicalData.volumeAccumulation.status],
      ),
  );

  const totalScore = roundTo2(financialScore + qualitativeScore + valuationScore + technicalScore);

  return {
    data: parsedData,
    scores: {
      financial: financialScore,
      qualitative: qualitativeScore,
      valuation: valuationScore,
      technical: technicalScore,
      total: totalScore,
    },
    verdict: getVerdict(totalScore),
  };
}
