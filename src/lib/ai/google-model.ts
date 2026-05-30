import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { extractJsonMiddleware, wrapLanguageModel } from 'ai';
import { BUSINESS_ANALYSIS_MODEL } from '@/lib/ai/business-analysis';

function resolveGeminiApiKey(): string {
  const apiKey =
    process.env.GEMINI_API_KEY?.trim() ?? process.env.GOOGLE_GENERATIVE_AI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured on the server.');
  }
  return apiKey;
}

const googleProvider = createGoogleGenerativeAI({
  apiKey: resolveGeminiApiKey(),
});

export const google = googleProvider;

export function businessAnalysisModel() {
  return wrapLanguageModel({
    model: googleProvider(BUSINESS_ANALYSIS_MODEL),
    middleware: extractJsonMiddleware(),
  });
}
