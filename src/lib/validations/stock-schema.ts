import { z } from 'zod';

const financialMetricRatingSchema = z.enum(['hyper', 'good', 'avg', 'low']);
const qualitativeVerdictSchema = z.enum(['yes', 'neutral', 'bad']);
const valuationRatingSchema = z.enum(['undervalued', 'fair', 'overvalued']);
const trendStatusSchema = z.enum(['bullish', 'consolidation', 'bearish']);
const relativeStrengthStatusSchema = z.enum(['outperforming', 'neutral', 'underperforming']);
const momentumRsiStatusSchema = z.enum(['healthy', 'overbought', 'oversold']);
const volumeAccumulationStatusSchema = z.enum(['accumulating', 'distributing']);
const quantamentalVerdictSchema = z.enum(['Strong Buy', 'Accumulate', 'Hold', 'Avoid']);

export const aiAnalysisSchema = z.object({
  analysis: z.object({
    fundamentalStory: z.object({
      companyOverview: z.object({
        whatItDoes: z.string(),
        industryTags: z.array(z.string()),
        revenueSegments: z.object({
          topGenerators: z.array(z.string()),
          fastestGrowing: z.string(),
        }),
      }),
      competitivePositioning: z.object({
        moatAndMarketLeadership: z.string(),
        specialtiesAndDifferentiation: z.string(),
      }),
      capitalAndCashflowAnalysis: z.object({
        ocfVsMarketCap5Yr: z.string(),
        debtCondition4Yr: z.string(),
        capexSelfFundingAbility: z.string(),
      }),
      futureVisibility: z.object({
        orderBookHealthVsMarketCap: z.string(),
      }),
      investmentThesis: z.object({
        top5ReasonsToOwn: z.array(z.string()),
        top3Risks: z.array(z.string()),
        growthTriggers: z.string(),
      }),
    }),
    financialAnalysis: z.object({
      metrics: z.object({
        revenueGrowth: financialMetricRatingSchema,
        epsGrowth: financialMetricRatingSchema,
        marginExpansion: financialMetricRatingSchema,
        freeCashFlow: financialMetricRatingSchema,
      }),
    }),
    qualitativeAnalysis: z.object({
      metrics: z.array(
        z.object({
          category: z.string(),
          verdict: qualitativeVerdictSchema,
          explanation: z.string(),
        }),
      ),
    }),
    valuationAnalysis: z.object({
      vsIndustry: z.object({
        rating: valuationRatingSchema,
        evidence: z.string(),
      }),
      vsHistory: z.object({
        rating: valuationRatingSchema,
        evidence: z.string(),
      }),
    }),
    technicalAnalysis: z.object({
      trend: z.object({
        status: trendStatusSchema,
        explanation: z.string(),
      }),
      relativeStrength: z.object({
        status: relativeStrengthStatusSchema,
      }),
      momentumRSI: z.object({
        status: momentumRsiStatusSchema,
      }),
      volumeAccumulation: z.object({
        status: volumeAccumulationStatusSchema,
      }),
    }),
  }),
});

export const quantamentalScoredResultSchema = z.object({
  data: aiAnalysisSchema,
  scores: z.object({
    financial: z.number(),
    qualitative: z.number(),
    valuation: z.number(),
    technical: z.number(),
    total: z.number(),
  }),
  verdict: quantamentalVerdictSchema,
});

export const quantamentalScoresRequestSchema = z.object({
  tickers: z.array(z.string().trim().min(1).max(40)).min(1).max(1000),
});

export const quantamentalScoresResponseSchema = z.object({
  scores: z.array(
    z.object({
      ticker: z.string().trim().min(1),
      totalScore: z.number().int().min(0).max(100),
      isStale: z.boolean(),
    }),
  ),
});

export type AiAnalysis = z.infer<typeof aiAnalysisSchema>;
export type FinancialMetricRating = z.infer<typeof financialMetricRatingSchema>;
export type QualitativeVerdict = z.infer<typeof qualitativeVerdictSchema>;
export type ValuationRating = z.infer<typeof valuationRatingSchema>;
export type TrendStatus = z.infer<typeof trendStatusSchema>;
export type RelativeStrengthStatus = z.infer<typeof relativeStrengthStatusSchema>;
export type MomentumRsiStatus = z.infer<typeof momentumRsiStatusSchema>;
export type VolumeAccumulationStatus = z.infer<typeof volumeAccumulationStatusSchema>;
export type QuantamentalVerdict = z.infer<typeof quantamentalVerdictSchema>;
export type QuantamentalScoredResult = z.infer<typeof quantamentalScoredResultSchema>;
export type QuantamentalScoresRequest = z.infer<typeof quantamentalScoresRequestSchema>;
export type QuantamentalScoresResponse = z.infer<typeof quantamentalScoresResponseSchema>;
