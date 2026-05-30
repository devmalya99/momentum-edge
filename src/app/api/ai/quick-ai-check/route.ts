import { ZodError } from 'zod';
import { NextResponse } from 'next/server';
import { getSessionFromCookies } from '@/lib/auth/server-session';
import { requirePremiumMembership } from '@/lib/membership/server';
import { isTrustedSameOriginRequest } from '@/lib/market-analyzer/api-guard';
import {
  normalizeBusinessTicker,
  quickAiCheckRequestSchema,
  quickAiCheckResponseSchema,
} from '@/lib/ai/quick-ai-check';
import { generateQuickAiCheck } from '@/lib/ai/quick-ai-check-generator';
import {
  getAiQuickAiCheckCache,
  upsertAiQuickAiCheckCache,
} from '@/lib/db/ai-quick-ai-check-cache';
import { QUICK_AI_CHECK_CACHE_TTL_SECONDS } from '@/lib/ai/quick-ai-check';

const API_TAG = '[api/ai/quick-ai-check]';

export const dynamic = 'force-dynamic';

function buildCacheKey(ticker: string): string {
  return `TICKER:${normalizeBusinessTicker(ticker)}`;
}

export async function POST(request: Request) {
  try {
    const session = await getSessionFromCookies();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const premiumGate = await requirePremiumMembership(session.sub);
    if (premiumGate) return premiumGate;
    if (!isTrustedSameOriginRequest(request)) {
      return NextResponse.json({ error: 'Request failed verification checks' }, { status: 403 });
    }

    const parsed = quickAiCheckRequestSchema.parse(await request.json());
    const ticker = normalizeBusinessTicker(parsed.ticker);
    const companyName = parsed.companyName.trim();
    const refresh = parsed.refresh === true;
    const cacheKey = buildCacheKey(ticker);
    const cached = await getAiQuickAiCheckCache(cacheKey);
    const nowMs = Date.now();

    if (!refresh && cached) {
      const staleAfterMs = Date.parse(cached.staleAfter);
      const isStale = Number.isNaN(staleAfterMs) ? true : staleAfterMs <= nowMs;
      if (!isStale) {
        return NextResponse.json(
          quickAiCheckResponseSchema.parse({
            ...cached.payload,
            meta: {
              ...cached.payload.meta,
              cacheStatus: 'hit',
            },
          }),
        );
      }
    }

    const generated = await generateQuickAiCheck(
      {
        ticker,
        companyName,
      },
      { bypassCache: true },
    );

    const generatedAt = new Date();
    const cacheExpiresAt = new Date(generatedAt.getTime() + QUICK_AI_CHECK_CACHE_TTL_SECONDS * 1000);
    const payload = quickAiCheckResponseSchema.parse({
      ...generated,
      meta: {
        ...generated.meta,
        generatedAt: generatedAt.toISOString(),
        cacheExpiresAt: cacheExpiresAt.toISOString(),
        cacheStatus: cached ? 'stale-refreshed' : 'miss',
      },
    });

    await upsertAiQuickAiCheckCache({
      cacheKey,
      ticker,
      companyName,
      payload,
      category: payload.category,
      ratingReasons: payload.ratingReasons,
      model: payload.meta.model,
      generatedAtIso: payload.meta.generatedAt,
      staleAfterIso: payload.meta.cacheExpiresAt,
    });

    return NextResponse.json(
      quickAiCheckResponseSchema.parse({
        ...payload,
      }),
    );
  } catch (error) {
    if (error instanceof ZodError) {
      console.error(`${API_TAG} validation failed`, JSON.stringify(error.issues));
      return NextResponse.json(
        {
          error: 'Unprocessable Entity',
          message: 'Quick AI check payload failed schema validation',
          issues: error.issues,
        },
        { status: 422 },
      );
    }
    const message = error instanceof Error ? error.message : 'Failed to generate Quick AI Check';
    console.error(`${API_TAG} failed: ${message}`);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
