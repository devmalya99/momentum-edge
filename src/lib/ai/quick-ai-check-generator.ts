import { unstable_cache } from 'next/cache';
import { GoogleGenAI } from '@google/genai';
import {
  QUICK_AI_CHECK_CACHE_TTL_SECONDS,
  QUICK_AI_CHECK_MODEL,
  buildQuickAiCheckSystemInstruction,
  buildQuickAiCheckUserPrompt,
  extractGroundingSources,
  extractQuickAiCheckJson,
  normalizeBusinessTicker,
  quickAiCheckResponseSchema,
  sanitizeBusinessAnalysisSources,
  type QuickAiCheckResponse,
} from '@/lib/ai/quick-ai-check';
import {
  extractModelText,
  logGeminiTokenUsage,
  readTokenUsage,
} from '@/lib/ai/business-analysis-gemini-utils';

const LOG_TAG = '[quick-ai-check-generator]';
const GROUNDING_TOOLS = [{ googleSearch: {} }];

async function generateQuickAiCheckUncached(
  ticker: string,
  companyName: string,
): Promise<QuickAiCheckResponse> {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured on the server.');
  }

  const normalizedTicker = normalizeBusinessTicker(ticker);
  const trimmedCompanyName = companyName.trim();
  const ai = new GoogleGenAI({ apiKey });
  const modelRes = await ai.models.generateContent({
    model: QUICK_AI_CHECK_MODEL,
    contents: buildQuickAiCheckUserPrompt({
      ticker: normalizedTicker,
      companyName: trimmedCompanyName,
    }),
    config: {
      systemInstruction: buildQuickAiCheckSystemInstruction(),
      temperature: 0.1,
      tools: GROUNDING_TOOLS,
    },
  });

  logGeminiTokenUsage({
    logTag: LOG_TAG,
    ticker: normalizedTicker,
    callLabel: 'generate-quick-check',
    model: QUICK_AI_CHECK_MODEL,
    usage: readTokenUsage(modelRes),
  });

  const modelText = extractModelText(modelRes);
  if (!modelText) {
    throw new Error('Model returned empty text');
  }

  const llmPayload = extractQuickAiCheckJson(modelText);
  const groundingMetadata = modelRes.candidates?.[0]?.groundingMetadata;
  const sources = sanitizeBusinessAnalysisSources(extractGroundingSources(groundingMetadata));
  const generatedAt = new Date();
  const cacheExpiresAt = new Date(generatedAt.getTime() + QUICK_AI_CHECK_CACHE_TTL_SECONDS * 1000);

  return quickAiCheckResponseSchema.parse({
    ticker: normalizedTicker,
    companyName: trimmedCompanyName,
    category: llmPayload.category,
    summary: llmPayload.summary,
    ratingReasons: llmPayload.ratingReasons,
    factors: llmPayload.factors,
    sources,
    meta: {
      model: QUICK_AI_CHECK_MODEL,
      generatedAt: generatedAt.toISOString(),
      cacheExpiresAt: cacheExpiresAt.toISOString(),
      cacheStatus: 'miss',
      webSearchQueries: groundingMetadata?.webSearchQueries ?? [],
    },
  });
}

const getCachedQuickAiCheck = unstable_cache(
  generateQuickAiCheckUncached,
  ['quick-ai-check'],
  {
    revalidate: QUICK_AI_CHECK_CACHE_TTL_SECONDS,
    tags: ['quick-ai-check'],
  },
);

export async function generateQuickAiCheck(
  input: { ticker: string; companyName: string },
  options?: { bypassCache?: boolean },
): Promise<QuickAiCheckResponse> {
  const ticker = normalizeBusinessTicker(input.ticker);
  const companyName = input.companyName.trim();
  if (!ticker) {
    throw new Error('Ticker is required');
  }

  if (options?.bypassCache) {
    return generateQuickAiCheckUncached(ticker, companyName);
  }

  const cached = await getCachedQuickAiCheck(ticker, companyName);
  return quickAiCheckResponseSchema.parse({
    ...cached,
    meta: {
      ...cached.meta,
      cacheStatus: 'hit',
    },
  });
}
