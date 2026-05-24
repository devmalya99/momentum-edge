import { GoogleGenAI } from '@google/genai';
import {
  buildBusinessAnalysisSystemInstruction,
  buildBusinessAnalysisUserPrompt,
  BUSINESS_ANALYSIS_MODEL,
  computeCompositeScore,
  extractGroundingSources,
  extractJsonObject,
  normalizeBusinessTicker,
  parseBusinessAnalysisLlmPayload,
  sanitizeBusinessAnalysisSources,
  type BusinessAnalysisLlmPayload,
} from '@/lib/ai/business-analysis';
import {
  extractModelText,
  logGeminiTokenUsage,
  readTokenUsage,
} from '@/lib/ai/business-analysis-gemini-utils';
import { resolveBusinessAnalysisGeminiContextCache } from '@/lib/ai/business-analysis-gemini-cache';
import { fetchTradingViewSymbolNewsForAnalysis } from '@/lib/news/fetch-tradingview-symbol-news';

const LOG_TAG = '[business-analysis-generator]';
const GROUNDING_TOOLS = [{ googleSearch: {} }];

type GenerateBusinessAnalysisInput = {
  ticker: string;
  companyName: string;
  apiKey?: string;
};

export type GeneratedBusinessAnalysis = {
  ticker: string;
  companyName: string;
  llmPayload: BusinessAnalysisLlmPayload;
  compositeScore: number;
  sources: Array<{ title: string; uri: string }>;
  webSearchQueries: string[];
  model: string;
};

export async function generateBusinessAnalysisWithContext(
  input: GenerateBusinessAnalysisInput,
): Promise<GeneratedBusinessAnalysis> {
  const ticker = normalizeBusinessTicker(input.ticker);
  const companyName = input.companyName.trim();
  const apiKey = input.apiKey?.trim() ?? process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured on the server.');
  }

  const tradingViewFeed = await fetchTradingViewSymbolNewsForAnalysis(ticker);
  const tradingViewHeadlines = tradingViewFeed.items.map((item) => {
    const source = item.provider?.name?.trim();
    return source ? `${item.title} (${source})` : item.title;
  });

  const ai = new GoogleGenAI({ apiKey });
  const prompt = buildBusinessAnalysisUserPrompt({
    ticker,
    companyName,
    tradingViewHeadlines,
  });
  const systemInstruction = buildBusinessAnalysisSystemInstruction();
  const cachedContent = await resolveBusinessAnalysisGeminiContextCache(
    ai,
    'business-analysis-grounded',
  );

  const modelRes = await ai.models.generateContent({
    model: BUSINESS_ANALYSIS_MODEL,
    contents: prompt,
    config: cachedContent
      ? { cachedContent, temperature: 0.1, tools: GROUNDING_TOOLS }
      : { systemInstruction, temperature: 0.1, tools: GROUNDING_TOOLS },
  });

  logGeminiTokenUsage({
    logTag: LOG_TAG,
    ticker,
    callLabel: cachedContent ? 'generate-with-grounding-cached' : 'generate-with-grounding',
    model: BUSINESS_ANALYSIS_MODEL,
    usage: readTokenUsage(modelRes),
  });

  const modelText = extractModelText(modelRes);
  if (!modelText) {
    throw new Error('Model returned empty text');
  }

  const groundingMetadata = modelRes.candidates?.[0]?.groundingMetadata;
  const llmObject = extractJsonObject(modelText);
  const llmPayload = parseBusinessAnalysisLlmPayload(llmObject);
  const compositeScore = computeCompositeScore(llmPayload.scorecard);

  const groundingSources = extractGroundingSources(groundingMetadata);
  const tradingViewSources = tradingViewFeed.items
    .filter((item): item is typeof item & { link: string } => typeof item.link === 'string')
    .map((item) => ({
      title: item.title.trim().slice(0, 240),
      uri: item.link,
    }));
  const mergedSources = sanitizeBusinessAnalysisSources([
    ...groundingSources,
    ...tradingViewSources,
  ]);

  return {
    ticker,
    companyName,
    llmPayload,
    compositeScore,
    sources: mergedSources,
    webSearchQueries: groundingMetadata?.webSearchQueries ?? [],
    model: BUSINESS_ANALYSIS_MODEL,
  };
}
