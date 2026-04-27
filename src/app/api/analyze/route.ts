import { ZodError } from 'zod';
import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { aiAnalysisSchema, quantamentalScoredResultSchema } from '@/lib/validations/stock-schema';
import { calculateQuantamentalScore } from '@/lib/scoring-engine';
import {
  AI_QUANTAMENTAL_STALE_MS,
  getAiQuantamentalCache,
  upsertAiQuantamentalCache,
} from '@/lib/db/ai-quantamental-cache';

const MODEL = 'gemini-3.1-flash-lite-preview';
const API_TAG = '[api/analyze]';

function extractJsonObject(raw: string): unknown {
  const trimmed = raw.trim();
  if (!trimmed) {
    throw new Error('LLM response is empty');
  }

  const firstBrace = trimmed.indexOf('{');
  const lastBrace = trimmed.lastIndexOf('}');

  if (firstBrace < 0 || lastBrace <= firstBrace) {
    throw new Error('No valid JSON object found in LLM response');
  }

  return JSON.parse(trimmed.slice(firstBrace, lastBrace + 1));
}

function buildPrompt(rawTextPayload: string): string {
  return [
    'You are a stock analysis assistant for Indian equities.',
    'Return strict JSON only. No markdown, no prose outside JSON.',
    'JSON schema to follow exactly:',
    '{',
    '  "analysis": {',
    '    "fundamentalStory": {',
    '      "companyOverview": {',
    '        "whatItDoes": "string",',
    '        "industryTags": ["string"],',
    '        "revenueSegments": { "topGenerators": ["string"], "fastestGrowing": "string" }',
    '      },',
    '      "competitivePositioning": {',
    '        "moatAndMarketLeadership": "string",',
    '        "specialtiesAndDifferentiation": "string"',
    '      },',
    '      "capitalAndCashflowAnalysis": {',
    '        "ocfVsMarketCap5Yr": "string",',
    '        "debtCondition4Yr": "string",',
    '        "capexSelfFundingAbility": "string"',
    '      },',
    '      "futureVisibility": { "orderBookHealthVsMarketCap": "string" },',
    '      "investmentThesis": {',
    '        "top5ReasonsToOwn": ["string"],',
    '        "top3Risks": ["string"],',
    '        "growthTriggers": "string"',
    '      }',
    '    },',
    '    "financialAnalysis": {',
    '      "metrics": {',
    '        "revenueGrowth": "hyper|good|avg|low",',
    '        "epsGrowth": "hyper|good|avg|low",',
    '        "marginExpansion": "hyper|good|avg|low",',
    '        "freeCashFlow": "hyper|good|avg|low"',
    '      }',
    '    },',
    '    "qualitativeAnalysis": {',
    '      "metrics": [',
    '        { "category": "Industry Tailwind", "verdict": "yes|neutral|bad", "explanation": "string" },',
    '        { "category": "Capital Allocation", "verdict": "yes|neutral|bad", "explanation": "string" },',
    '        { "category": "The Moat", "verdict": "yes|neutral|bad", "explanation": "string" }',
    '      ]',
    '    },',
    '    "valuationAnalysis": {',
    '      "vsIndustry": { "rating": "undervalued|fair|overvalued", "evidence": "string" },',
    '      "vsHistory": { "rating": "undervalued|fair|overvalued", "evidence": "string" }',
    '    },',
    '    "technicalAnalysis": {',
    '      "trend": { "status": "bullish|consolidation|bearish", "explanation": "string" },',
    '      "relativeStrength": { "status": "outperforming|neutral|underperforming" },',
    '      "momentumRSI": { "status": "healthy|overbought|oversold" },',
    '      "volumeAccumulation": { "status": "accumulating|distributing" }',
    '    }',
    '  }',
    '}',
    'If data is uncertain, still choose the closest categorical bucket and explain uncertainty in string fields.',
    'For financialAnalysis.metrics.freeCashFlow, prioritize operating cash flow quality and OCF conversion consistency over strict free cash flow interpretation.',
    `User input to analyze: ${rawTextPayload}`,
  ].join('\n');
}

function extractTicker(rawTextPayload: string): string | null {
  const normalized = rawTextPayload.trim().replace(/\s+/g, ' ');
  const match = normalized.match(/^analyze\s+([A-Za-z0-9._:-]+)/i);
  if (!match || !match[1]) return null;
  return match[1].trim().toUpperCase().replace(/^(NSE:|BSE:)/, '');
}

function buildCacheKey(rawTextPayload: string): string {
  const ticker = extractTicker(rawTextPayload);
  if (ticker) return `TICKER:${ticker}`;
  return `TEXT:${rawTextPayload.trim().replace(/\s+/g, ' ').toUpperCase()}`;
}

export async function POST(request: Request) {
  try {
    const rawPayload = await request.text();
    if (!rawPayload.trim()) {
      return NextResponse.json(
        {
          error: 'Bad Request',
          message: 'Request body is empty.',
        },
        { status: 400 },
      );
    }
    const ticker = extractTicker(rawPayload);
    const cacheKey = buildCacheKey(rawPayload);
    const cached = await getAiQuantamentalCache(cacheKey);
    if (cached) {
      const staleAfterMs = Date.parse(cached.staleAfter);
      const isStale = Number.isNaN(staleAfterMs) ? true : staleAfterMs <= Date.now();
      if (!isStale) {
        const parsedCached = quantamentalScoredResultSchema.safeParse(cached.scored);
        if (parsedCached.success) {
          return NextResponse.json(parsedCached.data, { status: 200 });
        }
      }
    }

    const apiKey = process.env.GEMINI_API_KEY?.trim();
    if (!apiKey) {
      return NextResponse.json(
        {
          error: 'Service Unavailable',
          message: 'GEMINI_API_KEY is not configured on the server.',
        },
        { status: 503 },
      );
    }

    const prompt = buildPrompt(rawPayload);
    const ai = new GoogleGenAI({ apiKey });
    const modelRes = await ai.models.generateContent({ model: MODEL, contents: prompt });
    const llmJsonText = (modelRes.text ?? '').trim();
    if (!llmJsonText) {
      return NextResponse.json(
        {
          error: 'Bad Gateway',
          message: 'Empty response from model.',
        },
        { status: 502 },
      );
    }

    const parsedLlmObject = extractJsonObject(llmJsonText);
    const validatedData = aiAnalysisSchema.parse(parsedLlmObject);
    const scoredResult = calculateQuantamentalScore(validatedData);
    const generatedAt = new Date();
    const staleAfter = new Date(generatedAt.getTime() + AI_QUANTAMENTAL_STALE_MS);

    await upsertAiQuantamentalCache({
      cacheKey,
      ticker,
      payloadText: rawPayload,
      scored: scoredResult,
      model: MODEL,
      generatedAtIso: generatedAt.toISOString(),
      staleAfterIso: staleAfter.toISOString(),
    });

    return NextResponse.json(scoredResult, { status: 200 });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        {
          error: 'Unprocessable Entity',
          message: 'LLM response failed schema validation.',
          issues: error.issues,
        },
        { status: 422 },
      );
    }

    const message =
      error instanceof Error ? error.message : 'Unexpected error occurred while processing data.';
    console.error(`${API_TAG} failed: ${message}`);

    return NextResponse.json(
      {
        error: 'Internal Server Error',
        message,
      },
      { status: 500 },
    );
  }
}
