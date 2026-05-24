import { unstable_cache } from 'next/cache';
import { GoogleGenAI } from '@google/genai';
import {
  buildStockNewsSearchSystemInstruction,
  buildStockNewsSearchUserPrompt,
  extractGroundingSources,
  parseStockNewsSearchMarkdown,
  STOCK_NEWS_SEARCH_CACHE_TTL_SECONDS,
  STOCK_NEWS_SEARCH_MODEL,
  type StockNewsSearchResult,
} from '@/lib/ai/stock-news-search';

async function fetchStockNewsSearchUncached(
  normalizedQuery: string,
): Promise<StockNewsSearchResult> {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured on the server.');
  }

  const ai = new GoogleGenAI({ apiKey });
  const modelRes = await ai.models.generateContent({
    model: STOCK_NEWS_SEARCH_MODEL,
    contents: buildStockNewsSearchUserPrompt(normalizedQuery),
    config: {
      systemInstruction: buildStockNewsSearchSystemInstruction(),
      temperature: 0.0,
      tools: [{ googleSearch: {} }],
    },
  });

  const markdown = (modelRes.text ?? '').trim();
  if (!markdown) {
    throw new Error('Empty response from model');
  }

  const sections = parseStockNewsSearchMarkdown(markdown);
  const groundingMetadata = modelRes.candidates?.[0]?.groundingMetadata;
  const sources = extractGroundingSources(groundingMetadata);
  const generatedAt = new Date();
  const cacheExpiresAt = new Date(
    generatedAt.getTime() + STOCK_NEWS_SEARCH_CACHE_TTL_SECONDS * 1000,
  );

  return {
    query: normalizedQuery,
    markdown,
    sections,
    sources,
    meta: {
      model: STOCK_NEWS_SEARCH_MODEL,
      generatedAt: generatedAt.toISOString(),
      cacheExpiresAt: cacheExpiresAt.toISOString(),
      webSearchQueries: groundingMetadata?.webSearchQueries ?? [],
    },
  };
}

const getStockNewsSearchCached = unstable_cache(
  fetchStockNewsSearchUncached,
  ['stock-news-search'],
  { revalidate: STOCK_NEWS_SEARCH_CACHE_TTL_SECONDS, tags: ['stock-news-search'] },
);

/** Gemini + Google Search lookup, cached 12h per normalized ticker/company key. */
export async function fetchCachedStockNewsSearch(
  normalizedQuery: string,
  options?: { bypassCache?: boolean },
): Promise<StockNewsSearchResult> {
  if (options?.bypassCache) {
    return fetchStockNewsSearchUncached(normalizedQuery);
  }
  return getStockNewsSearchCached(normalizedQuery);
}
