import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { getSessionFromCookies } from '@/lib/auth/server-session';
import {
  analysedScanItemsSchema,
  analyseScanRequestSchema,
  extractJsonArray,
} from '@/lib/ai/analyse-scan';

const MODEL = 'gemini-3.1-flash-lite-preview';
const API_TAG = '[api/ai/analyse-scan]';

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
  const startedAt = Date.now();
  const session = await getSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!isTrustedSameOriginRequest(request)) {
    return NextResponse.json({ error: 'Request failed verification checks' }, { status: 403 });
  }

  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    console.error(`${API_TAG} GEMINI_API_KEY missing`);
    return NextResponse.json(
      { error: 'GEMINI_API_KEY is not configured on the server.' },
      { status: 503 },
    );
  }

  try {
    const body = analyseScanRequestSchema.parse(await request.json());
    const stockLines = body.stocks
      .map((stock, idx) => `${idx + 1}. ${stock.symbol.trim().toUpperCase()} - ${stock.name.trim()}`)
      .join('\n');
    const prompt = [
      `You are an expert equity research analyst. Categorize the provided list of stocks to reveal money flow.`,
      `Group them into broad, recognizable industries (e.g., "Chemicals", "Capital Goods", "IT Services", "Pharma") using the "industry" field.`,
      `Do NOT create hyper-specific industries.`,
      `Put the hyper-specific theme (e.g., "Fluorine", "CDMO", "Data Center Infra") into the "segment" field.`,
      `Provide any major recent news trigger if you know it from reliable recent context, otherwise return null.`,
      `Return strict JSON only as an array of objects.`,
      `Each object must match this exact structure:`,
      `[{"name":"company name","symbol":"ticker","sector":"macro group","industry":"sub-group","segment":"hyper-specific theme","anyRecentNewsTrigger":null}]`,
      `Rules:`,
      `- Include one output object for every input stock, using the same symbol.`,
      `- Keep segment concise: 2 to 5 words.`,
      `- Do not invent a news trigger. Use null when unsure.`,
      `- No investment advice, buy/sell calls, target prices, or rankings.`,
      `Stocks:`,
      stockLines,
    ].join('\n');

    const ai = new GoogleGenAI({ apiKey });
    const modelRes = await ai.models.generateContent({ model: MODEL, contents: prompt });
    const raw = (modelRes.text ?? '').trim();
    const parsed = extractJsonArray(raw);
    const items = analysedScanItemsSchema.parse(parsed);
    const generatedAt = new Date().toISOString();
    console.info(
      `${API_TAG} generated scanner=${body.scannerName} count=${items.length} elapsedMs=${Date.now() - startedAt}`,
    );
    return NextResponse.json({
      items,
      meta: {
        model: MODEL,
        scannerName: body.scannerName,
        analysedCount: items.length,
        generatedAt,
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Failed to analyse scan';
    console.error(`${API_TAG} failed message=${message}`);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
