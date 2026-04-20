import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { getSessionFromCookies } from '@/lib/auth/server-session';
import {
  AI_STOCK_OVERVIEW_STALE_MS,
  computeStockOverviewScore,
  extractJsonObject,
  QUALITATIVE_QUESTIONS,
  stockOverviewAnalysisSchema,
  stockOverviewModelOutputSchema,
  stockOverviewRequestSchema,
} from '@/lib/ai/stock-overview';
import {
  getAiStockOverviewCache,
  upsertAiStockOverviewCache,
} from '@/lib/db/ai-stock-overview-cache';

const MODEL = 'gemini-3.1-flash-lite-preview';
const API_TAG = '[api/ai/stock-overview]';
const TARGET_FINANCIAL_YEAR = 2026;

function isTrustedSameOriginRequest(request: Request): boolean {
  const origin = request.headers.get('origin');
  const host = request.headers.get('host');
  const secFetchSite = request.headers.get('sec-fetch-site');
  const xrw = request.headers.get('x-requested-with');
  if (!origin || !host) return false;
  let originHost = '';
  try {
    originHost = new URL(origin).host;
  } catch {
    return false;
  }
  const sameHost = originHost === host;
  const trustedFetchSite =
    secFetchSite === null || secFetchSite === 'same-origin' || secFetchSite === 'same-site';
  const hasAjaxMarker = xrw?.toLowerCase() === 'xmlhttprequest';
  return sameHost && trustedFetchSite && hasAjaxMarker;
}

function hasTargetYearEvidenceInFinancials(analysis: unknown): boolean {
  const parsed = stockOverviewAnalysisSchema.safeParse(analysis);
  if (!parsed.success) return false;
  const evidences = Object.values(parsed.data.financialAnalysis).map((item) =>
    item.numericEvidence.toLowerCase(),
  );
  const yearRegex = new RegExp(`\\b${TARGET_FINANCIAL_YEAR}\\b`);
  const fyRegex = new RegExp(`\\bfy\\s*${String(TARGET_FINANCIAL_YEAR).slice(-2)}\\b`, 'i');
  const matches = evidences.filter(
    (txt) => yearRegex.test(txt) || fyRegex.test(txt) || txt.includes('ttm'),
  ).length;
  return matches >= 3;
}

export async function POST(request: Request) {
  const startedAt = Date.now();
  const session = await getSessionFromCookies();
  if (!session) {
    console.warn(`${API_TAG} unauthorized`);
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!isTrustedSameOriginRequest(request)) {
    console.warn(`${API_TAG} request rejected by verification checks`);
    return NextResponse.json({ error: 'Request failed verification checks' }, { status: 403 });
  }
  const dbUrl = process.env.DATABASE_URL?.trim();
  if (!dbUrl) {
    console.error(`${API_TAG} DATABASE_URL missing`);
    return NextResponse.json({ error: 'Database is not configured' }, { status: 503 });
  }

  let ticker = '';
  let companyName = '';
  try {
    const validated = stockOverviewRequestSchema.parse(await request.json());
    ticker = validated.ticker.trim().toUpperCase();
    companyName = validated.companyName.trim();
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Invalid request payload';
    console.warn(`${API_TAG} payload invalid: ${message}`);
    return NextResponse.json({ error: 'Invalid request payload' }, { status: 400 });
  }

  try {
    const nowMs = Date.now();
    const cached = await getAiStockOverviewCache(ticker);
    if (cached) {
      const staleAfterMs = Date.parse(cached.staleAfter);
      const isStale = Number.isNaN(staleAfterMs) ? true : staleAfterMs <= nowMs;
      if (!isStale) {
        const validatedCached = stockOverviewAnalysisSchema.safeParse(cached.analysis);
        if (validatedCached.success) {
          if (hasTargetYearEvidenceInFinancials(validatedCached.data)) {
            console.info(`${API_TAG} cache hit symbol=${ticker}`);
            return NextResponse.json({
              analysis: validatedCached.data,
              meta: {
                model: cached.model,
                cacheStatus: 'hit' as const,
                generatedAt: cached.generatedAt,
                staleAfter: cached.staleAfter,
                isStale: false,
              },
            });
          }
          console.warn(
            `${API_TAG} cache outdated-year symbol=${ticker}; regenerating for ${TARGET_FINANCIAL_YEAR}`,
          );
        } else {
          console.warn(`${API_TAG} cache invalid-shape symbol=${ticker}; regenerating`);
        }
      }
      console.info(`${API_TAG} cache stale symbol=${ticker}`);
    } else {
      console.info(`${API_TAG} cache miss symbol=${ticker}`);
    }

    const apiKey = process.env.GEMINI_API_KEY?.trim();
    if (!apiKey) {
      console.error(`${API_TAG} GEMINI_API_KEY missing symbol=${ticker}`);
      return NextResponse.json(
        { error: 'GEMINI_API_KEY is not configured on the server.' },
        { status: 503 },
      );
    }

    const prompt = [
      `Analyze Indian stock "${ticker}"${companyName ? ` (${companyName})` : ''}.`,
      `Return strict JSON only, matching this exact structure:`,
      `{`,
      ` "fundamentalStory": {`,
      `   "businessExplanation": "max 100 words",`,
      `   "coreSegment": "max 30 words",`,
      `   "mostGrowingSegment": "max 30 words"`,
      ` },`,
      ` "financialAnalysis": {`,
      `   "revenueGrowth": {"rating":"hyper|good|avg|low","numericEvidence":"with real numbers","explanation":"short"},`,
      `   "profitGrowth": {"rating":"hyper|good|avg|low","numericEvidence":"with real numbers","explanation":"short"},`,
      `   "epsGrowth": {"rating":"hyper|good|avg|low","numericEvidence":"with real numbers","explanation":"short"},`,
      `   "profitMarginExpansion": {"rating":"hyper|good|avg|low","numericEvidence":"with real numbers","explanation":"short"},`,
      `   "freeCashFlowGrowth": {"rating":"hyper|good|avg|low","numericEvidence":"with real numbers","explanation":"short"}`,
      ` },`,
      ` "qualitativeAnalysis":[`,
      `   {"id":1..9,"question":"string","verdict":"yes|no|bad","explanation":"max 30 words"}`,
      ` ],`,
      ` "conclusion": {`,
      `   "moatAndWhyInvest":"max 100 words",`,
      `   "futureGrowthProspects":"max 100 words",`,
      `   "risksWhyAvoid":"max 100 words"`,
      ` }`,
      `}`,
      `Qualitative questions (id must match exactly):`,
      ...QUALITATIVE_QUESTIONS.map((q, i) => `${i + 1}) ${q}`),
      `Rules:`,
      `- Use the most recent data with preference for FY${TARGET_FINANCIAL_YEAR} / CY${TARGET_FINANCIAL_YEAR} / TTM ${TARGET_FINANCIAL_YEAR}.`,
      `- In each financialAnalysis.numericEvidence, include a year tag like "(as of FY${TARGET_FINANCIAL_YEAR})" or "(TTM ${TARGET_FINANCIAL_YEAR})".`,
      `- Include real numbers in numericEvidence when available (CAGR %, margin %, ROCE %, debt metrics, FCF).`,
      `- If ${TARGET_FINANCIAL_YEAR} data is not fully reported, explicitly say "FY${TARGET_FINANCIAL_YEAR} partially reported" and use latest TTM around ${TARGET_FINANCIAL_YEAR}.`,
      `- No buy/sell/target price.`,
    ].join('\n');

    const ai = new GoogleGenAI({ apiKey });
    const modelRes = await ai.models.generateContent({ model: MODEL, contents: prompt });
    const raw = (modelRes.text ?? '').trim();
    if (!raw) {
      console.error(`${API_TAG} empty model response symbol=${ticker}`);
      return NextResponse.json({ error: 'Empty response from model' }, { status: 502 });
    }
    const parsed = extractJsonObject(raw);
    const modelOutput = stockOverviewModelOutputSchema.parse(parsed);
    const analysis = stockOverviewAnalysisSchema.parse({
      ...modelOutput,
      score: computeStockOverviewScore(modelOutput),
    });

    const generatedAt = new Date();
    const staleAfter = new Date(generatedAt.getTime() + AI_STOCK_OVERVIEW_STALE_MS);

    await upsertAiStockOverviewCache({
      ticker,
      companyName: companyName || ticker,
      analysis,
      model: MODEL,
      generatedAtIso: generatedAt.toISOString(),
      staleAfterIso: staleAfter.toISOString(),
    });

    const cacheStatus = cached ? ('stale-refreshed' as const) : ('miss' as const);
    console.info(
      `${API_TAG} generated symbol=${ticker} score=${analysis.score.objectiveScore} cacheStatus=${cacheStatus} elapsedMs=${Date.now() - startedAt}`,
    );
    return NextResponse.json({
      analysis,
      meta: {
        model: MODEL,
        cacheStatus,
        generatedAt: generatedAt.toISOString(),
        staleAfter: staleAfter.toISOString(),
        isStale: false,
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Failed to generate overview';
    console.error(`${API_TAG} failed symbol=${ticker} message=${message}`);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
