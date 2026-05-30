import { extractJsonMiddleware, stepCountIs, streamText } from 'ai';
import type { GoogleGenerativeAIProviderMetadata } from '@ai-sdk/google';
import {
  businessAnalysisBasicReportSchema,
  businessAnalysisExtendedReportSchema,
  buildBusinessAnalysisSystemInstruction,
  buildBusinessAnalysisUserPrompt,
  businessAnalysisShortReportSchema,
  BUSINESS_ANALYSIS_MODEL,
  extractGroundingSources,
  extractJsonObject,
  normalizeBusinessTicker,
  sanitizeBusinessAnalysisSources,
  type BusinessAnalysisShortReport,
} from '@/lib/ai/business-analysis';
import { businessAnalysisModel, google } from '@/lib/ai/google-model';
import { businessAnalysisLog } from '@/lib/ai/business-analysis-stream-log';

const LOG_TAG = '[business-analysis-report-generator]';

/** Gemini cannot combine googleSearch tools with responseMimeType application/json. */
const GROUNDING_TOOLS = {
  google_search: google.tools.googleSearch({}),
};

type GenerateBusinessAnalysisReportInput = {
  ticker: string;
  companyName: string;
  detailLevel?: 'basic' | 'extended';
};

export type GeneratedBusinessAnalysisReport = {
  ticker: string;
  companyName: string;
  report: BusinessAnalysisShortReport;
  sources: Array<{ title: string; uri: string }>;
  webSearchQueries: string[];
  model: string;
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

function parseReportFromModelText(text: string, detailLevel: 'basic' | 'extended') {
  const llmObject = extractJsonObject(text);
  const reportPatch =
    detailLevel === 'basic'
      ? businessAnalysisBasicReportSchema.parse(llmObject)
      : businessAnalysisExtendedReportSchema.parse(llmObject);
  return businessAnalysisShortReportSchema.parse(reportPatch);
}

type StreamBusinessAnalysisReportOptions = {
  onFinish?: (event: { text: string; providerMetadata: unknown }) => void | Promise<void>;
};

export function streamBusinessAnalysisReport(
  input: GenerateBusinessAnalysisReportInput,
  options?: StreamBusinessAnalysisReportOptions,
) {
  const ticker = normalizeBusinessTicker(input.ticker);
  const companyName = input.companyName.trim();
  const detailLevel = input.detailLevel ?? 'basic';
  let textDeltaCount = 0;
  let streamedChars = 0;

  businessAnalysisLog.generator('stream-start', { ticker, companyName, detailLevel });

  return streamText({
    model: businessAnalysisModel(),
    system: buildBusinessAnalysisSystemInstruction(detailLevel),
    prompt: buildBusinessAnalysisUserPrompt({ ticker, companyName, detailLevel }),
    tools: GROUNDING_TOOLS,
    stopWhen: stepCountIs(5),
    temperature: 0.1,
    onChunk: ({ chunk }) => {
      if (chunk.type === 'text-delta') {
        textDeltaCount += 1;
        streamedChars += chunk.text.length;
        if (textDeltaCount === 1 || textDeltaCount % 10 === 0) {
          businessAnalysisLog.generator('text-delta', {
            ticker,
            detailLevel,
            deltaIndex: textDeltaCount,
            deltaChars: chunk.text.length,
            streamedChars,
            preview: chunk.text.slice(0, 80),
          });
        }
        return;
      }
      businessAnalysisLog.generator('stream-chunk', {
        ticker,
        detailLevel,
        chunkType: chunk.type,
      });
    },
    onError: ({ error }) => {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`${LOG_TAG} stream error ticker=${ticker} detail=${detailLevel}: ${message}`);
      businessAnalysisLog.generator('stream-error', { ticker, detailLevel, message });
    },
    onFinish: async ({ text, providerMetadata, finishReason }) => {
      businessAnalysisLog.generator('stream-finish', {
        ticker,
        detailLevel,
        finishReason,
        textDeltaCount,
        streamedChars,
        finalTextChars: text.length,
        hasOnFinishHandler: Boolean(options?.onFinish),
      });
      if (!text.trim()) {
        businessAnalysisLog.generator('stream-finish-empty-text', { ticker, detailLevel });
        return;
      }
      if (!options?.onFinish) return;
      await options.onFinish({ text, providerMetadata });
    },
  });
}

export async function generateBusinessAnalysisReport(
  input: GenerateBusinessAnalysisReportInput,
): Promise<GeneratedBusinessAnalysisReport> {
  const ticker = normalizeBusinessTicker(input.ticker);
  const companyName = input.companyName.trim();
  const detailLevel = input.detailLevel ?? 'basic';
  const result = streamBusinessAnalysisReport(input);
  const text = await result.text;

  if (!text.trim()) throw new Error('Model returned empty text');

  const report = parseReportFromModelText(text, detailLevel);
  const providerMetadata = await result.providerMetadata;

  return {
    ticker,
    companyName,
    report,
    sources: extractSourcesFromProviderMetadata(providerMetadata),
    webSearchQueries: extractWebSearchQueries(providerMetadata),
    model: BUSINESS_ANALYSIS_MODEL,
  };
}

export async function buildGeneratedReportFromStreamFinish(input: {
  ticker: string;
  companyName: string;
  detailLevel: 'basic' | 'extended';
  text: string;
  providerMetadata: unknown;
}): Promise<GeneratedBusinessAnalysisReport> {
  if (!input.text.trim()) throw new Error('Model returned empty text');

  return {
    ticker: normalizeBusinessTicker(input.ticker),
    companyName: input.companyName.trim(),
    report: parseReportFromModelText(input.text, input.detailLevel),
    sources: extractSourcesFromProviderMetadata(input.providerMetadata),
    webSearchQueries: extractWebSearchQueries(input.providerMetadata),
    model: BUSINESS_ANALYSIS_MODEL,
  };
}
