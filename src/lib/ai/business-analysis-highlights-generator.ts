import { GoogleGenAI } from '@google/genai';
import {
  buildBusinessAnalysisHighlightsSystemInstruction,
  buildBusinessAnalysisHighlightsUserPrompt,
  BUSINESS_ANALYSIS_MODEL,
  extractJsonObject,
  normalizeBusinessTicker,
  parseBusinessAnalysisHighlightsPayload,
  type BusinessAnalysisHighlightsLlmPayload,
  type BusinessScorecard,
} from '@/lib/ai/business-analysis';
import {
  extractModelText,
  logGeminiTokenUsage,
  readTokenUsage,
} from '@/lib/ai/business-analysis-gemini-utils';
import { resolveBusinessAnalysisGeminiContextCache } from '@/lib/ai/business-analysis-gemini-cache';

const LOG_TAG = '[business-analysis-highlights-generator]';

type GenerateBusinessAnalysisHighlightsInput = {
  ticker: string;
  companyName: string;
  category?: string;
  compositeScore?: number;
  ratingReasons?: string[];
  scorecard?: BusinessScorecard;
  apiKey?: string;
};

export type GeneratedBusinessAnalysisHighlights = {
  ticker: string;
  companyName: string;
  llmPayload: BusinessAnalysisHighlightsLlmPayload;
  model: string;
};

export async function generateBusinessAnalysisHighlights(
  input: GenerateBusinessAnalysisHighlightsInput,
): Promise<GeneratedBusinessAnalysisHighlights> {
  const ticker = normalizeBusinessTicker(input.ticker);
  const companyName = input.companyName.trim();
  const apiKey = input.apiKey?.trim() ?? process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured on the server.');
  }

  const ai = new GoogleGenAI({ apiKey });
  const prompt = buildBusinessAnalysisHighlightsUserPrompt({
    ticker,
    companyName,
    category: input.category,
    compositeScore: input.compositeScore,
    ratingReasons: input.ratingReasons,
    scorecard: input.scorecard,
  });
  const systemInstruction = buildBusinessAnalysisHighlightsSystemInstruction();
  const cachedContent = await resolveBusinessAnalysisGeminiContextCache(
    ai,
    'business-analysis-highlights',
  );

  const modelRes = await ai.models.generateContent({
    model: BUSINESS_ANALYSIS_MODEL,
    contents: prompt,
    config: cachedContent
      ? { cachedContent, temperature: 0.1 }
      : { systemInstruction, temperature: 0.1 },
  });

  logGeminiTokenUsage({
    logTag: LOG_TAG,
    ticker,
    callLabel: cachedContent ? 'generate-highlights-cached' : 'generate-highlights',
    model: BUSINESS_ANALYSIS_MODEL,
    usage: readTokenUsage(modelRes),
  });

  const modelText = extractModelText(modelRes);
  if (!modelText) {
    throw new Error('Model returned empty text');
  }

  const llmObject = extractJsonObject(modelText);
  const llmPayload = parseBusinessAnalysisHighlightsPayload(llmObject);

  return {
    ticker,
    companyName,
    llmPayload,
    model: BUSINESS_ANALYSIS_MODEL,
  };
}
