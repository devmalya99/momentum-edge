import {
  BUSINESS_ANALYSIS_CACHE_TTL_SECONDS,
  businessAnalysisResponseSchema,
  normalizeBusinessTicker,
  type BusinessAnalysisResponse,
  type BusinessAnalysisShortReport,
} from '@/lib/ai/business-analysis';

export const BUSINESS_ANALYSIS_STALE_MS = BUSINESS_ANALYSIS_CACHE_TTL_SECONDS * 1000;

export const BUSINESS_ANALYSIS_API_HEADERS = {
  'Content-Type': 'application/json',
  'X-Requested-With': 'XMLHttpRequest',
} as const;

export function businessAnalysisQueryKey(symbol: string) {
  return ['ai', 'business-analysis', normalizeBusinessTicker(symbol)] as const;
}

export function buildBasicAnalysisResponse(input: {
  ticker: string;
  companyName: string;
  report: Pick<
    BusinessAnalysisShortReport,
    'story' | 'tailwinds' | 'business_exposure'
  >;
  cacheStatus?: 'hit' | 'miss' | 'stale-refreshed';
}): BusinessAnalysisResponse {
  const generatedAt = new Date();
  const cacheExpiresAt = new Date(generatedAt.getTime() + BUSINESS_ANALYSIS_CACHE_TTL_SECONDS * 1000);
  return businessAnalysisResponseSchema.parse({
    ticker: normalizeBusinessTicker(input.ticker),
    companyName: input.companyName.trim(),
    report: {
      story: input.report.story ?? '',
      tailwinds: input.report.tailwinds ?? [],
      business_exposure: input.report.business_exposure ?? [],
      business_strength: [],
      recent_transformations: [],
      proof: [],
    },
    sources: [],
    meta: {
      model: 'gemini-2.5-flash',
      generatedAt: generatedAt.toISOString(),
      cacheExpiresAt: cacheExpiresAt.toISOString(),
      cacheStatus: input.cacheStatus ?? 'miss',
      webSearchQueries: [],
      extendedFetched: false,
    },
  });
}

export function mergeExtendedAnalysisResponse(
  base: BusinessAnalysisResponse,
  extended: Pick<
    BusinessAnalysisShortReport,
    'business_strength' | 'recent_transformations' | 'proof'
  >,
): BusinessAnalysisResponse {
  return businessAnalysisResponseSchema.parse({
    ...base,
    report: {
      ...base.report,
      business_strength: extended.business_strength ?? [],
      recent_transformations: extended.recent_transformations ?? [],
      proof: extended.proof ?? [],
    },
    meta: {
      ...base.meta,
      extendedFetched: true,
    },
  });
}
