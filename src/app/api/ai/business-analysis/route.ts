import { ZodError } from 'zod';
import { NextResponse } from 'next/server';
import { getSessionFromCookies } from '@/lib/auth/server-session';
import { requirePremiumMembership } from '@/lib/membership/server';
import { isTrustedSameOriginRequest } from '@/lib/market-analyzer/api-guard';
import {
  businessAnalysisRequestSchema,
  businessAnalysisResponseSchema,
  BUSINESS_ANALYSIS_CACHE_TTL_SECONDS,
  deriveDirection,
  normalizeBusinessTicker,
  sanitizeBusinessAnalysisSources,
} from '@/lib/ai/business-analysis';
import { generateBusinessAnalysisWithContext } from '@/lib/ai/business-analysis-generator';
import {
  getAiBusinessAnalysisCache,
  upsertAiBusinessAnalysisCache,
} from '@/lib/db/ai-business-analysis-cache';

const API_TAG = '[api/ai/business-analysis]';

function buildCacheKey(ticker: string): string {
  return `TICKER:${normalizeBusinessTicker(ticker)}`;
}

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const session = await getSessionFromCookies();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const premiumGate = await requirePremiumMembership(session.sub);
    if (premiumGate) return premiumGate;
    if (!isTrustedSameOriginRequest(request)) {
      return NextResponse.json({ error: 'Request failed verification checks' }, { status: 403 });
    }

    const parsed = businessAnalysisRequestSchema.parse(await request.json());
    const ticker = normalizeBusinessTicker(parsed.ticker);
    const companyName = parsed.companyName.trim();
    const refresh = parsed.refresh === true;
    const cacheKey = buildCacheKey(ticker);
    const cached = await getAiBusinessAnalysisCache(cacheKey);
    const nowMs = Date.now();

    if (!refresh && cached) {
      const staleAfterMs = Date.parse(cached.staleAfter);
      const isStale = Number.isNaN(staleAfterMs) ? true : staleAfterMs <= nowMs;
      if (!isStale) {
        const payload = businessAnalysisResponseSchema.parse({
          ...cached.payload,
          sources: sanitizeBusinessAnalysisSources(cached.payload.sources ?? []),
          meta: {
            ...cached.payload.meta,
            cacheStatus: 'hit',
          },
        });
        return NextResponse.json(payload);
      }
    }

    const generated = await generateBusinessAnalysisWithContext({
      ticker,
      companyName,
    });
    const previousCategory = cached?.category ?? null;
    const previousCompositeScore = cached?.compositeScore ?? null;
    const direction = deriveDirection({
      currentCategory: generated.llmPayload.category,
      currentCompositeScore: generated.compositeScore,
      previousCategory,
      previousCompositeScore,
    });

    const generatedAt = new Date();
    const cacheExpiresAt = new Date(generatedAt.getTime() + BUSINESS_ANALYSIS_CACHE_TTL_SECONDS * 1000);
    const cacheStatus = cached ? 'stale-refreshed' : 'miss';

    const payload = businessAnalysisResponseSchema.parse({
      ticker,
      companyName,
      category: generated.llmPayload.category,
      compositeScore: generated.compositeScore,
      direction,
      previousCategory: previousCategory ?? undefined,
      previousCompositeScore: previousCompositeScore ?? undefined,
      scorecard: generated.llmPayload.scorecard,
      businessSegments: generated.llmPayload.businessSegments,
      executiveSummary: '',
      ratingReasons: generated.llmPayload.ratingReasons,
      keyPositives: [],
      keyRisks: [],
      sources: sanitizeBusinessAnalysisSources(generated.sources),
      meta: {
        model: generated.model,
        generatedAt: generatedAt.toISOString(),
        cacheExpiresAt: cacheExpiresAt.toISOString(),
        cacheStatus,
        webSearchQueries: generated.webSearchQueries,
      },
    });

    await upsertAiBusinessAnalysisCache({
      cacheKey,
      ticker,
      companyName,
      payload,
      category: payload.category,
      compositeScore: payload.compositeScore,
      direction: payload.direction,
      ratingReasons: payload.ratingReasons,
      previousCategory: payload.previousCategory ?? null,
      previousCompositeScore: payload.previousCompositeScore ?? null,
      model: generated.model,
      generatedAtIso: payload.meta.generatedAt,
      staleAfterIso: payload.meta.cacheExpiresAt,
    });

    return NextResponse.json(payload);
  } catch (error) {
    if (error instanceof ZodError) {
      console.error(`${API_TAG} validation failed`, JSON.stringify(error.issues));
      return NextResponse.json(
        {
          error: 'Unprocessable Entity',
          message: 'Business analysis payload failed schema validation',
          issues: error.issues,
        },
        { status: 422 },
      );
    }
    const message = error instanceof Error ? error.message : 'Failed to generate business analysis';
    console.error(`${API_TAG} failed: ${message}`);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
