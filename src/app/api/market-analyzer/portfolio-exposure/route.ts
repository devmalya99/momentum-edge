import { ZodError } from 'zod';
import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { getSessionFromCookies } from '@/lib/auth/server-session';
import { buildPortfolioExposurePrompt } from '@/lib/ai/market-analyzer-macro-prompt';
import { extractJsonObject } from '@/lib/ai/stock-overview';
import { isTrustedSameOriginRequest } from '@/lib/market-analyzer/api-guard';
import {
  compressedMacroPayloadSchema,
  portfolioExposureRequestSchema,
  portfolioExposureResultSchema,
} from '@/types/marketAnalyzer';

const MODEL = 'gemini-3.1-flash-lite-preview';
const API_TAG = '[api/market-analyzer/portfolio-exposure]';

export async function POST(request: Request) {
  const session = await getSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!isTrustedSameOriginRequest(request)) {
    return NextResponse.json({ error: 'Request failed verification checks' }, { status: 403 });
  }

  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    return NextResponse.json(
      { error: 'Service Unavailable', message: 'GEMINI_API_KEY is not configured on the server.' },
      { status: 503 },
    );
  }

  try {
    const body = portfolioExposureRequestSchema.parse(await request.json());
    const payload = compressedMacroPayloadSchema.parse(body.payload);

    const prompt = buildPortfolioExposurePrompt(payload);
    const ai = new GoogleGenAI({ apiKey });
    const modelRes = await ai.models.generateContent({ model: MODEL, contents: prompt });
    const llmText = (modelRes.text ?? '').trim();

    if (!llmText) {
      return NextResponse.json(
        { error: 'Bad Gateway', message: 'Empty response from model.' },
        { status: 502 },
      );
    }

    const parsed = extractJsonObject(llmText);
    const result = portfolioExposureResultSchema.parse(parsed);

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        {
          error: 'Unprocessable Entity',
          message: 'Request or LLM response failed schema validation.',
          issues: error.issues,
        },
        { status: 422 },
      );
    }

    const message =
      error instanceof Error ? error.message : 'Unexpected error during portfolio exposure analysis.';
    console.error(`${API_TAG} failed:`, error);

    return NextResponse.json(
      { error: 'Internal Server Error', message },
      { status: 500 },
    );
  }
}
