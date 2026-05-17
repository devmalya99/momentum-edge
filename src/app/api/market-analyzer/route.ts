import { ZodError } from 'zod';
import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { getSessionFromCookies } from '@/lib/auth/server-session';
import { requirePremiumMembership } from '@/lib/membership/server';
import { buildIndexAnalyzerPrompt } from '@/lib/ai/market-analyzer-index-prompt';
import { extractJsonObject } from '@/lib/ai/stock-overview';
import { isTrustedSameOriginRequest } from '@/lib/market-analyzer/api-guard';
import {
  compressedPayloadSchema,
  indexAnalyzerResultSchema,
  marketAnalyzerRequestSchema,
} from '@/types/marketAnalyzer';

const MODEL = 'gemini-3.1-flash-lite-preview';
const API_TAG = '[api/market-analyzer]';

export async function POST(request: Request) {
  const session = await getSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const premiumGate = await requirePremiumMembership(session.sub);
  if (premiumGate) return premiumGate;
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
    const body = marketAnalyzerRequestSchema.parse(await request.json());
    const payload = compressedPayloadSchema.parse(body.payload);

    const prompt = buildIndexAnalyzerPrompt(payload);
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
    const result = indexAnalyzerResultSchema.parse(parsed);

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
      error instanceof Error ? error.message : 'Unexpected error during market analysis.';
    console.error(`${API_TAG} failed:`, error);

    return NextResponse.json(
      { error: 'Internal Server Error', message },
      { status: 500 },
    );
  }
}
