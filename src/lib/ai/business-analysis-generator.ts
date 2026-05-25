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

function logGroundingAudit(ticker: string, response: unknown): void {
  if (!response || typeof response !== 'object' || !('candidates' in response)) return;
  const candidates = Array.isArray(response.candidates) ? response.candidates : [];
  const groundingMetadata = candidates[0]?.groundingMetadata;
  const webSearchQueries = groundingMetadata?.webSearchQueries ?? [];
  const groundingChunks = groundingMetadata?.groundingChunks ?? [];
  const usage = readTokenUsage(response);

  console.info(
    `${LOG_TAG} grounding-audit ticker=${ticker} searches=${webSearchQueries.length} ` +
      `sources=${groundingChunks.length} toolInput=${usage?.toolUsePromptTokens ?? 0}`,
  );
}

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

  // Gemini forbids tools on generateContent when cachedContent is set, and
  // googleSearch baked into the cache returns empty text in practice — so we
  // always run one uncached grounded call (highlights still use context cache).
  const modelRes = await ai.models.generateContent({
    model: BUSINESS_ANALYSIS_MODEL,
    contents: prompt,
    config: {
      systemInstruction: buildBusinessAnalysisSystemInstruction(),
      temperature: 0.1,
      tools: GROUNDING_TOOLS,
    },
  });

  logGeminiTokenUsage({
    logTag: LOG_TAG,
    ticker,
    callLabel: 'generate-with-grounding',
    model: BUSINESS_ANALYSIS_MODEL,
    usage: readTokenUsage(modelRes),
  });
  logGroundingAudit(ticker, modelRes);

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
