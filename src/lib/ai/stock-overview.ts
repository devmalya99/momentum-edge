import { z } from 'zod';

export const AI_STOCK_OVERVIEW_STALE_MS = 7 * 24 * 60 * 60 * 1000;

const normalizeLowerString = (v: unknown): unknown =>
  typeof v === 'string' ? v.trim().toLowerCase() : v;

const normalizeQualitativeVerdict = (v: unknown): unknown => {
  const raw = normalizeLowerString(v);
  if (typeof raw !== 'string') return raw;
  const cleaned = raw.replace(/[^a-z\s-]/g, ' ').replace(/\s+/g, ' ').trim();

  if (
    cleaned === 'yes' ||
    cleaned === 'y' ||
    cleaned === 'true' ||
    cleaned === 'positive' ||
    cleaned === 'good' ||
    cleaned.startsWith('yes ') ||
    cleaned.includes('gaining') ||
    cleaned.includes('improving')
  ) {
    return 'yes';
  }
  if (
    cleaned === 'bad' ||
    cleaned === 'negative' ||
    cleaned === 'poor' ||
    cleaned === 'weak' ||
    cleaned === 'bearish' ||
    cleaned.includes('declining') ||
    cleaned.includes('deteriorating') ||
    cleaned.includes('worsening')
  ) {
    return 'bad';
  }
  if (
    cleaned === 'no' ||
    cleaned === 'n' ||
    cleaned === 'false' ||
    cleaned === 'neutral' ||
    cleaned === 'unclear' ||
    cleaned === 'mixed' ||
    cleaned.startsWith('no ') ||
    cleaned.includes('partly') ||
    cleaned.includes('partially')
  ) {
    return 'no';
  }

  // Default to neutral bucket instead of failing hard.
  return 'no';
};

const financialRatingSchema = z.preprocess(
  normalizeLowerString,
  z.enum(['hyper', 'good', 'avg', 'low']),
);
const qualitativeVerdictSchema = z.preprocess(
  normalizeQualitativeVerdict,
  z.enum(['yes', 'no', 'bad']),
);

export const stockOverviewRequestSchema = z.object({
  ticker: z.string().trim().min(1).max(40),
  companyName: z.string().trim().max(256).optional().default(''),
});

export const stockOverviewScoresRequestSchema = z.object({
  tickers: z.array(z.string().trim().min(1).max(40)).min(1).max(1000),
});

const financialMetricSchema = z.object({
  rating: financialRatingSchema,
  numericEvidence: z.string().trim().min(1).max(220),
  explanation: z.string().trim().min(1).max(220),
});

const qualitativeQuestionSchema = z.object({
  id: z.number().int().min(1).max(9),
  question: z.string().trim().min(1).max(200),
  verdict: qualitativeVerdictSchema,
  explanation: z.string().trim().min(1).max(260),
});

export const stockOverviewModelOutputSchema = z.object({
  fundamentalStory: z.object({
    businessExplanation: z.string().trim().min(1).max(900),
    coreSegment: z.string().trim().min(1).max(200),
    mostGrowingSegment: z.string().trim().min(1).max(200),
  }),
  financialAnalysis: z.object({
    revenueGrowth: financialMetricSchema,
    profitGrowth: financialMetricSchema,
    epsGrowth: financialMetricSchema,
    profitMarginExpansion: financialMetricSchema,
    freeCashFlowGrowth: financialMetricSchema,
  }),
  qualitativeAnalysis: z.array(qualitativeQuestionSchema).length(9),
  conclusion: z.object({
    moatAndWhyInvest: z.string().trim().min(1).max(900),
    futureGrowthProspects: z.string().trim().min(1).max(900),
    risksWhyAvoid: z.string().trim().min(1).max(900),
  }),
});

const computedScoreSchema = z.object({
  financialPoints: z.number().int().min(0).max(50),
  qualitativePoints: z.number().int().min(0).max(90),
  totalPoints: z.number().int().min(0).max(140),
  maxPoints: z.literal(140),
  objectiveScore: z.number().int().min(0).max(100),
  sectionPercentages: z.object({
    financial: z.number().int().min(0).max(100),
    qualitative: z.number().int().min(0).max(100),
  }),
});

export const stockOverviewAnalysisSchema = stockOverviewModelOutputSchema.extend({
  score: computedScoreSchema,
});

export type StockOverviewCacheStatus = 'hit' | 'miss' | 'stale-refreshed';
export type StockOverviewRequest = z.infer<typeof stockOverviewRequestSchema>;
export type StockOverviewModelOutput = z.infer<typeof stockOverviewModelOutputSchema>;
export type StockOverviewAnalysis = z.infer<typeof stockOverviewAnalysisSchema>;
export type FinancialRating = z.infer<typeof financialRatingSchema>;
export type QualitativeVerdict = z.infer<typeof qualitativeVerdictSchema>;

export const stockOverviewApiResponseSchema = z.object({
  analysis: stockOverviewAnalysisSchema,
  meta: z.object({
    model: z.string().trim().min(1),
    cacheStatus: z.enum(['hit', 'miss', 'stale-refreshed']),
    generatedAt: z.string().trim().min(1),
    staleAfter: z.string().trim().min(1),
    isStale: z.boolean(),
  }),
});

export type StockOverviewApiResponse = z.infer<typeof stockOverviewApiResponseSchema>;

export const stockOverviewScoresResponseSchema = z.object({
  scores: z.array(
    z.object({
      ticker: z.string().trim().min(1),
      objectiveScore: z.number().int().min(0).max(100),
      isStale: z.boolean(),
    }),
  ),
});

export type StockOverviewScoresResponse = z.infer<typeof stockOverviewScoresResponseSchema>;

export const QUALITATIVE_QUESTIONS: readonly string[] = [
  'Operating in sunrise/new-age sector',
  'Reinvesting cash in high-growth sector',
  'Near debt-free or reducing debt significantly',
  'Segment operating in high-growth environment',
  'Working with reputed clients',
  'Gaining market share',
  'Good ROCE or near-term ROCE improvement visibility',
  'Gaining good orders',
  'Ability to generate massive cash flow',
] as const;

export function extractJsonObject(text: string): unknown {
  const trimmed = text.trim();
  if (!trimmed) throw new Error('Model returned empty text');
  const first = trimmed.indexOf('{');
  const last = trimmed.lastIndexOf('}');
  if (first < 0 || last <= first) {
    throw new Error('Model response did not contain a JSON object');
  }
  return JSON.parse(trimmed.slice(first, last + 1));
}

const FINANCIAL_POINTS: Record<FinancialRating, number> = {
  hyper: 10,
  good: 8,
  avg: 6,
  low: 3,
};

const QUALITATIVE_POINTS: Record<QualitativeVerdict, number> = {
  yes: 10,
  no: 5,
  bad: 3,
};

export function computeStockOverviewScore(output: StockOverviewModelOutput) {
  const financial = output.financialAnalysis;
  const financialPoints =
    FINANCIAL_POINTS[financial.revenueGrowth.rating] +
    FINANCIAL_POINTS[financial.profitGrowth.rating] +
    FINANCIAL_POINTS[financial.epsGrowth.rating] +
    FINANCIAL_POINTS[financial.profitMarginExpansion.rating] +
    FINANCIAL_POINTS[financial.freeCashFlowGrowth.rating];

  const qualitativePoints = output.qualitativeAnalysis.reduce(
    (sum, item) => sum + QUALITATIVE_POINTS[item.verdict],
    0,
  );

  const maxPoints = 140;
  const totalPoints = financialPoints + qualitativePoints;
  const financialPercentage = Math.round((financialPoints / 50) * 100);
  const qualitativePercentage = Math.round((qualitativePoints / 90) * 100);
  const objectiveScore = Math.max(
    0,
    Math.min(100, Math.round(financialPercentage * 0.3 + qualitativePercentage * 0.7)),
  );

  return {
    financialPoints,
    qualitativePoints,
    totalPoints,
    maxPoints: 140 as const,
    objectiveScore,
    sectionPercentages: {
      financial: financialPercentage,
      qualitative: qualitativePercentage,
    },
  };
}
