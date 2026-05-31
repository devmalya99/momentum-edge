import { ZodError } from 'zod';
import { NextResponse } from 'next/server';
import { getSessionFromCookies } from '@/lib/auth/server-session';
import { requirePremiumMembership } from '@/lib/membership/server';
import { isTrustedSameOriginRequest } from '@/lib/market-analyzer/api-guard';
import {
  normalizeBusinessTicker,
  STOCK_GRADE_CACHE_TTL_SECONDS,
  stockGradeRequestSchema,
  stockGradeResponseSchema,
} from '@/lib/ai/stock-grade';
import { generateStockGrade } from '@/lib/ai/stock-grade-generator';
import { getAiStockGradeCache, upsertAiStockGradeCache } from '@/lib/db/ai-stock-grade-cache';

const API_TAG = '[api/ai/stock-grade]';

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

    const parsed = stockGradeRequestSchema.parse(await request.json());
    const ticker = normalizeBusinessTicker(parsed.ticker);
    const companyName = parsed.companyName.trim();
    const refresh = parsed.refresh === true;
    const cacheOnly = parsed.cacheOnly === true;
    const cacheKey = buildCacheKey(ticker);
    const cached = await getAiStockGradeCache(cacheKey);
    const nowMs = Date.now();

    const readFreshCache = () => {
      if (!cached) return null;
      const staleAfterMs = Date.parse(cached.staleAfter);
      const isStale = Number.isNaN(staleAfterMs) ? true : staleAfterMs <= nowMs;
      if (isStale) return null;
      return stockGradeResponseSchema.parse({
        ...cached.payload,
        meta: {
          ...cached.payload.meta,
          cacheStatus: 'hit',
        },
      });
    };

    if (cacheOnly) {
      const hit = readFreshCache();
      if (hit) return NextResponse.json(hit);
      return NextResponse.json({ error: 'Grade not cached' }, { status: 404 });
    }

    if (!refresh) {
      const hit = readFreshCache();
      if (hit) return NextResponse.json(hit);
    }

    const generated = await generateStockGrade({ ticker, companyName });

    const generatedAt = new Date();
    const cacheExpiresAt = new Date(generatedAt.getTime() + STOCK_GRADE_CACHE_TTL_SECONDS * 1000);
    const payload = stockGradeResponseSchema.parse({
      ...generated,
      meta: {
        ...generated.meta,
        generatedAt: generatedAt.toISOString(),
        cacheExpiresAt: cacheExpiresAt.toISOString(),
        cacheStatus: cached ? 'stale-refreshed' : 'miss',
      },
    });

    await upsertAiStockGradeCache({
      cacheKey,
      ticker,
      companyName,
      payload,
      grade: payload.grade,
      model: payload.meta.model,
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
          message: 'Stock grade payload failed schema validation',
          issues: error.issues,
        },
        { status: 422 },
      );
    }
    const message = error instanceof Error ? error.message : 'Failed to generate stock grade';
    console.error(`${API_TAG} failed: ${message}`);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
