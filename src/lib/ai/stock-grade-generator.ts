import { generateText, stepCountIs } from 'ai';
import type { GoogleGenerativeAIProviderMetadata } from '@ai-sdk/google';
import {
  STOCK_GRADE_CACHE_TTL_SECONDS,
  STOCK_GRADE_MODEL,
  buildStockGradeSystemInstruction,
  buildStockGradeUserPrompt,
  extractGroundingSources,
  extractStockGradeJson,
  normalizeBusinessTicker,
  stockGradeResponseSchema,
  sanitizeBusinessAnalysisSources,
  type StockGradeResponse,
} from '@/lib/ai/stock-grade';
import { google, stockGradeModel } from '@/lib/ai/google-model';

const LOG_TAG = '[stock-grade-generator]';

/** Gemini cannot combine googleSearch tools with responseMimeType application/json. */
const GROUNDING_TOOLS = {
  google_search: google.tools.googleSearch({}),
};

function extractWebSearchQueries(providerMetadata: unknown): string[] {
  const metadata = providerMetadata as GoogleGenerativeAIProviderMetadata | undefined;
  const queries = metadata?.groundingMetadata?.webSearchQueries;
  return Array.isArray(queries) ? queries.filter((q): q is string => typeof q === 'string') : [];
}

function extractSourcesFromProviderMetadata(providerMetadata: unknown) {
  const metadata = providerMetadata as GoogleGenerativeAIProviderMetadata | undefined;
  const groundingMetadata = metadata?.groundingMetadata;
  return sanitizeBusinessAnalysisSources(
    extractGroundingSources(
      groundingMetadata == null
        ? undefined
        : (groundingMetadata as Parameters<typeof extractGroundingSources>[0]),
    ),
  );
}

export async function generateStockGrade(input: {
  ticker: string;
  companyName: string;
}): Promise<StockGradeResponse> {
  const normalizedTicker = normalizeBusinessTicker(input.ticker);
  const trimmedCompanyName = input.companyName.trim();

  const result = await generateText({
    model: stockGradeModel(),
    system: buildStockGradeSystemInstruction(),
    prompt: buildStockGradeUserPrompt({
      ticker: normalizedTicker,
      companyName: trimmedCompanyName,
    }),
    tools: GROUNDING_TOOLS,
    stopWhen: stepCountIs(3),
    temperature: 0.1,
  });

  const text = result.text.trim();
  if (!text) {
    throw new Error('Model returned empty text');
  }

  const usage = result.usage;
  console.info(
    `${LOG_TAG} token-usage ticker=${normalizedTicker} model=${STOCK_GRADE_MODEL} ` +
      `prompt=${usage?.inputTokens ?? 0} output=${usage?.outputTokens ?? 0} total=${usage?.totalTokens ?? 0}`,
  );

  const llmPayload = extractStockGradeJson(text);
  const generatedAt = new Date();
  const cacheExpiresAt = new Date(generatedAt.getTime() + STOCK_GRADE_CACHE_TTL_SECONDS * 1000);

  return stockGradeResponseSchema.parse({
    ticker: normalizedTicker,
    companyName: trimmedCompanyName,
    grade: llmPayload.Grade,
    reason: llmPayload.reason,
    sources: extractSourcesFromProviderMetadata(result.providerMetadata),
    meta: {
      model: STOCK_GRADE_MODEL,
      generatedAt: generatedAt.toISOString(),
      cacheExpiresAt: cacheExpiresAt.toISOString(),
      cacheStatus: 'miss',
      webSearchQueries: extractWebSearchQueries(result.providerMetadata),
    },
  });
}
