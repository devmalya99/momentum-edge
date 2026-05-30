import { ZodError } from 'zod';
import { NextResponse } from 'next/server';
import { getSessionFromCookies } from '@/lib/auth/server-session';
import { requirePremiumMembership } from '@/lib/membership/server';
import { isTrustedSameOriginRequest } from '@/lib/market-analyzer/api-guard';
import {
  businessAnalysisRequestSchema,
  businessAnalysisResponseSchema,
  BUSINESS_ANALYSIS_CACHE_TTL_SECONDS,
  normalizeBusinessTicker,
  sanitizeBusinessAnalysisSources,
} from '@/lib/ai/business-analysis';
import {
  buildGeneratedReportFromStreamFinish,
  streamBusinessAnalysisReport,
  type GeneratedBusinessAnalysisReport,
} from '@/lib/ai/business-analysis-report-generator';
import {
  getAiBusinessAnalysisCache,
  upsertAiBusinessAnalysisCache,
} from '@/lib/db/ai-business-analysis-cache';
import { businessAnalysisLog } from '@/lib/ai/business-analysis-stream-log';

const API_TAG = '[api/ai/business-analysis]';

function buildCacheKey(ticker: string): string {
  return `TICKER:${normalizeBusinessTicker(ticker)}`;
}

type BusinessAnalysisPayload = ReturnType<typeof businessAnalysisResponseSchema.parse>;

function streamHeaders(): HeadersInit {
  return {
    'Content-Type': 'text/plain; charset=utf-8',
    'Cache-Control': 'no-store',
  };
}

function toCachedTextStreamResponse(
  object: unknown,
  meta: Record<string, unknown>,
): Response {
  const jsonText = JSON.stringify(object);
  businessAnalysisLog.api('cache-stream-response', {
    ...meta,
    payloadChars: jsonText.length,
    instant: true,
  });
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoder.encode(jsonText));
      controller.close();
    },
  });
  return new Response(stream, { headers: streamHeaders() });
}

function buildBasicPayload(input: {
  ticker: string;
  companyName: string;
  generated: GeneratedBusinessAnalysisReport;
  generatedAt: Date;
  cacheExpiresAt: Date;
  cacheStatus: 'hit' | 'miss' | 'stale-refreshed';
}): BusinessAnalysisPayload {
  return businessAnalysisResponseSchema.parse({
    ticker: input.ticker,
    companyName: input.companyName,
    report: {
      story: input.generated.report.story,
      tailwinds: input.generated.report.tailwinds,
      business_exposure: input.generated.report.business_exposure,
      business_strength: [],
      recent_transformations: [],
      proof: [],
    },
    sources: sanitizeBusinessAnalysisSources(input.generated.sources),
    meta: {
      model: input.generated.model,
      generatedAt: input.generatedAt.toISOString(),
      cacheExpiresAt: input.cacheExpiresAt.toISOString(),
      cacheStatus: input.cacheStatus,
      webSearchQueries: input.generated.webSearchQueries,
      extendedFetched: false,
    },
  });
}

function buildExtendedPayload(input: {
  ticker: string;
  companyName: string;
  generated: GeneratedBusinessAnalysisReport;
  baseReport: BusinessAnalysisPayload['report'];
  cachedSources: BusinessAnalysisPayload['sources'];
  generatedAt: Date;
  cacheExpiresAt: Date;
  cacheStatus: 'hit' | 'miss' | 'stale-refreshed';
}): BusinessAnalysisPayload {
  return businessAnalysisResponseSchema.parse({
    ticker: input.ticker,
    companyName: input.companyName,
    report: {
      ...input.baseReport,
      business_strength: input.generated.report.business_strength,
      recent_transformations: input.generated.report.recent_transformations,
      proof: input.generated.report.proof,
    },
    sources: sanitizeBusinessAnalysisSources([...input.cachedSources, ...input.generated.sources]),
    meta: {
      model: input.generated.model,
      generatedAt: input.generatedAt.toISOString(),
      cacheExpiresAt: input.cacheExpiresAt.toISOString(),
      cacheStatus: input.cacheStatus,
      webSearchQueries: input.generated.webSearchQueries,
      extendedFetched: true,
    },
  });
}

function cachedReportSlice(
  report: BusinessAnalysisPayload['report'],
  detailLevel: 'basic' | 'extended',
) {
  if (detailLevel === 'basic') {
    return {
      story: report.story,
      tailwinds: report.tailwinds,
      business_exposure: report.business_exposure,
    };
  }
  return {
    business_strength: report.business_strength,
    recent_transformations: report.recent_transformations,
    proof: report.proof,
  };
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
    const detailLevel = parsed.detailLevel ?? 'basic';
    const cacheKey = buildCacheKey(ticker);
    const cached = await getAiBusinessAnalysisCache(cacheKey);
    const nowMs = Date.now();

    businessAnalysisLog.api('request', {
      ticker,
      companyName,
      detailLevel,
      refresh,
      hasDbCache: Boolean(cached),
    });

    if (!refresh && cached) {
      const staleAfterMs = Date.parse(cached.staleAfter);
      const isStale = Number.isNaN(staleAfterMs) ? true : staleAfterMs <= nowMs;
      if (!isStale) {
        const hasExtended = cached.payload.meta?.extendedFetched === true;
        if (detailLevel === 'basic' || hasExtended) {
          const parsedPayload = businessAnalysisResponseSchema.safeParse({
            ...cached.payload,
            sources: sanitizeBusinessAnalysisSources(cached.payload.sources ?? []),
            meta: {
              ...cached.payload.meta,
              cacheStatus: 'hit',
            },
          });
          if (parsedPayload.success) {
            businessAnalysisLog.api('cache-hit', { ticker, detailLevel, source: 'db' });
            return toCachedTextStreamResponse(
              cachedReportSlice(parsedPayload.data.report, detailLevel),
              { ticker, detailLevel, source: 'db' },
            );
          }
          businessAnalysisLog.api('cache-hit-parse-failed', { ticker, detailLevel });
        } else {
          businessAnalysisLog.api('cache-hit-missing-extended', { ticker, detailLevel });
        }
      } else {
        businessAnalysisLog.api('cache-stale', { ticker, detailLevel });
      }
    }

    const generatedAt = new Date();
    const cacheExpiresAt = new Date(generatedAt.getTime() + BUSINESS_ANALYSIS_CACHE_TTL_SECONDS * 1000);
    const cacheStatus = cached ? 'stale-refreshed' : 'miss';

    businessAnalysisLog.api('live-stream-start', { ticker, detailLevel, cacheStatus });

    const result = streamBusinessAnalysisReport(
      {
        ticker,
        companyName,
        detailLevel,
      },
      {
        onFinish: async ({ text, providerMetadata }) => {
          try {
            businessAnalysisLog.api('live-stream-finish-callback', {
              ticker,
              detailLevel,
              textChars: text.length,
            });
            const generated = await buildGeneratedReportFromStreamFinish({
              ticker,
              companyName,
              detailLevel,
              text,
              providerMetadata,
            });

            if (detailLevel === 'basic') {
              const payload = buildBasicPayload({
                ticker,
                companyName,
                generated,
                generatedAt,
                cacheExpiresAt,
                cacheStatus,
              });
              await upsertAiBusinessAnalysisCache({
                cacheKey,
                ticker,
                companyName,
                payload,
                model: generated.model,
                generatedAtIso: payload.meta.generatedAt,
                staleAfterIso: payload.meta.cacheExpiresAt,
              });
              businessAnalysisLog.api('cache-persist-success', {
                ticker,
                detailLevel: 'basic',
                cacheStatus,
              });
              return;
            }

            const payload = buildExtendedPayload({
              ticker,
              companyName,
              generated,
              baseReport: cached?.payload.report ?? {
                story: '',
                tailwinds: [],
                business_exposure: [],
                business_strength: [],
                recent_transformations: [],
                proof: [],
              },
              cachedSources: cached?.payload.sources ?? [],
              generatedAt,
              cacheExpiresAt,
              cacheStatus,
            });
            await upsertAiBusinessAnalysisCache({
              cacheKey,
              ticker,
              companyName,
              payload,
              model: generated.model,
              generatedAtIso: payload.meta.generatedAt,
              staleAfterIso: payload.meta.cacheExpiresAt,
            });
            businessAnalysisLog.api('cache-persist-success', {
              ticker,
              detailLevel: 'extended',
              cacheStatus,
            });
          } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            console.error(`${API_TAG} cache persist failed: ${message}`);
            businessAnalysisLog.api('cache-persist-failed', { ticker, detailLevel, message });
          }
        },
      },
    );

    businessAnalysisLog.api('return-text-stream', { ticker, detailLevel });
    return result.toTextStreamResponse({ headers: streamHeaders() });
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
