import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { getSessionFromCookies } from '@/lib/auth/server-session';
import {
  extractJsonArray,
  stockTriggerApiResponseSchema,
  stockTriggerRequestSchema,
} from '@/lib/ai/analyse-scan';

const MODEL = 'gemini-3.1-flash-lite-preview';
const API_TAG = '[api/ai/stock-trigger]';

function isTrustedSameOriginRequest(request: Request): boolean {
  const origin = request.headers.get('origin');
  const host = request.headers.get('host');
  const secFetchSite = request.headers.get('sec-fetch-site');
  const xrw = request.headers.get('x-requested-with');
  if (!origin || !host) return false;
  let originHost = '';
  try {
    originHost = new URL(origin).host;
  } catch {
    return false;
  }
  const sameHost = originHost === host;
  const trustedFetchSite =
    secFetchSite === null || secFetchSite === 'same-origin' || secFetchSite === 'same-site';
  const hasAjaxMarker = xrw?.toLowerCase() === 'xmlhttprequest';
  return sameHost && trustedFetchSite && hasAjaxMarker;
}

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
      { error: 'GEMINI_API_KEY is not configured on the server.' },
      { status: 503 },
    );
  }

  try {
    const body = stockTriggerRequestSchema.parse(await request.json());
    const prompt = [
      `You are an equity catalyst analyst.`,
      `Stock: ${body.symbol} (${body.name}).`,
      `Theme segment: ${body.segment}.`,
      `Give exactly 2 concise bullet points that explain recent possible momentum drivers: growth triggers, sector tailwinds, policy/earnings/order-book/news flow.`,
      `If unsure, provide conservative generic drivers and mention uncertainty briefly.`,
      `Return strict JSON array only, like: ["point one", "point two"]`,
      `No investment advice, no targets, no disclaimer text.`,
    ].join('\n');

    const ai = new GoogleGenAI({ apiKey });
    const modelRes = await ai.models.generateContent({ model: MODEL, contents: prompt });
    const raw = (modelRes.text ?? '').trim();
    const parsed = extractJsonArray(raw);
    const bullets = stockTriggerApiResponseSchema.shape.bullets.parse(parsed);
    const response = {
      bullets,
      meta: {
        model: MODEL,
        generatedAt: new Date().toISOString(),
      },
    };
    return NextResponse.json(stockTriggerApiResponseSchema.parse(response));
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Failed to analyse stock triggers';
    console.error(`${API_TAG} failed message=${message}`);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
