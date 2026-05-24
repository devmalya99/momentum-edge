import { ZodError } from 'zod';
import { NextResponse } from 'next/server';
import { getSessionFromCookies } from '@/lib/auth/server-session';
import { requirePremiumMembership } from '@/lib/membership/server';
import { isTrustedSameOriginRequest } from '@/lib/market-analyzer/api-guard';
import {
  businessAnalysisHighlightsRequestSchema,
  businessAnalysisHighlightsResponseSchema,
  businessAnalysisResponseSchema,
  hasBusinessAnalysisHighlights,
  normalizeBusinessTicker,
} from '@/lib/ai/business-analysis';
import { generateBusinessAnalysisHighlights } from '@/lib/ai/business-analysis-highlights-generator';
import {
  getAiBusinessAnalysisCache,
  upsertAiBusinessAnalysisCache,
} from '@/lib/db/ai-business-analysis-cache';

const API_TAG = '[api/ai/business-analysis/highlights]';

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

    const parsed = businessAnalysisHighlightsRequestSchema.parse(await request.json());
    const ticker = normalizeBusinessTicker(parsed.ticker);
    const companyName = parsed.companyName.trim();
    const refresh = parsed.refresh === true;
    const cacheKey = buildCacheKey(ticker);
    const cached = await getAiBusinessAnalysisCache(cacheKey);

    if (!refresh && cached && hasBusinessAnalysisHighlights(cached.payload)) {
      const payload = businessAnalysisHighlightsResponseSchema.parse({
        ticker,
        companyName,
        executiveSummary: cached.payload.executiveSummary ?? '',
        keyPositives: cached.payload.keyPositives ?? [],
        keyRisks: cached.payload.keyRisks ?? [],
        meta: {
          model: cached.model,
          generatedAt: cached.generatedAt,
          cacheStatus: 'hit',
        },
      });
      return NextResponse.json(payload);
    }

    const generated = await generateBusinessAnalysisHighlights({
      ticker,
      companyName,
      category: cached?.payload.category,
      compositeScore: cached?.compositeScore,
      ratingReasons: cached?.payload.ratingReasons,
      scorecard: cached?.payload.scorecard,
    });

    const generatedAt = new Date();
    const cacheStatus = cached ? 'stale-refreshed' : 'miss';

    const response = businessAnalysisHighlightsResponseSchema.parse({
      ticker,
      companyName,
      executiveSummary: generated.llmPayload.executiveSummary,
      keyPositives: generated.llmPayload.keyPositives,
      keyRisks: generated.llmPayload.keyRisks,
      meta: {
        model: generated.model,
        generatedAt: generatedAt.toISOString(),
        cacheStatus,
      },
    });

    if (cached) {
      const mergedPayload = businessAnalysisResponseSchema.parse({
        ...cached.payload,
        executiveSummary: response.executiveSummary,
        keyPositives: response.keyPositives,
        keyRisks: response.keyRisks,
      });

      await upsertAiBusinessAnalysisCache({
        cacheKey,
        ticker,
        companyName: cached.companyName,
        payload: mergedPayload,
        category: cached.category,
        compositeScore: cached.compositeScore,
        direction: cached.direction,
        ratingReasons: cached.ratingReasons,
        previousCategory: cached.previousCategory,
        previousCompositeScore: cached.previousCompositeScore,
        model: cached.model,
        generatedAtIso: cached.generatedAt,
        staleAfterIso: cached.staleAfter,
      });
    }

    return NextResponse.json(response);
  } catch (error) {
    if (error instanceof ZodError) {
      console.error(`${API_TAG} validation failed`, JSON.stringify(error.issues));
      return NextResponse.json(
        {
          error: 'Unprocessable Entity',
          message: 'Business analysis highlights failed schema validation',
          issues: error.issues,
        },
        { status: 422 },
      );
    }
    const message =
      error instanceof Error ? error.message : 'Failed to generate business analysis highlights';
    console.error(`${API_TAG} failed: ${message}`);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
