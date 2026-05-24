import type { GoogleGenAI } from '@google/genai';
import {
  buildBusinessAnalysisCachedReferenceContent,
  buildBusinessAnalysisHighlightsCachedReferenceContent,
  buildBusinessAnalysisHighlightsSystemInstruction,
  buildBusinessAnalysisSystemInstruction,
  BUSINESS_ANALYSIS_GEMINI_CONTEXT_CACHE_TTL_SECONDS,
  BUSINESS_ANALYSIS_MODEL,
} from '@/lib/ai/business-analysis';

const LOG_TAG = '[business-analysis-gemini-cache]';
const CACHE_VERSION = 'v3';

export type BusinessAnalysisGeminiCacheKind =
  | 'business-analysis-grounded'
  | 'business-analysis-highlights';

type CacheEntry = {
  name: string;
  expiresAtMs: number;
};

const memoryRegistry = new Map<string, CacheEntry>();
const inflightCreates = new Map<string, Promise<string | null>>();

function buildDisplayName(kind: BusinessAnalysisGeminiCacheKind): string {
  return `momentum-edge/${kind}/${CACHE_VERSION}`;
}

function buildMemoryKey(kind: BusinessAnalysisGeminiCacheKind): string {
  return buildDisplayName(kind);
}

function isEntryValid(entry: CacheEntry | undefined): entry is CacheEntry {
  return Boolean(entry && entry.expiresAtMs > Date.now() + 60_000);
}

async function findExistingCacheByDisplayName(
  ai: GoogleGenAI,
  displayName: string,
): Promise<CacheEntry | null> {
  try {
    const pager = await ai.caches.list({ config: { pageSize: 100 } });
    let page = pager.page;
    while (true) {
      for (const cache of page) {
        if (cache.displayName !== displayName || !cache.name) continue;
        const expiresAtMs = cache.expireTime ? Date.parse(cache.expireTime) : 0;
        if (expiresAtMs > Date.now() + 60_000) {
          return { name: cache.name, expiresAtMs };
        }
      }
      if (!pager.hasNextPage()) break;
      page = await pager.nextPage();
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`${LOG_TAG} list failed displayName=${displayName}: ${message}`);
  }
  return null;
}

async function createContextCache(
  ai: GoogleGenAI,
  kind: BusinessAnalysisGeminiCacheKind,
): Promise<string | null> {
  const displayName = buildDisplayName(kind);
  const ttl = `${BUSINESS_ANALYSIS_GEMINI_CONTEXT_CACHE_TTL_SECONDS}s`;

  const cache =
    kind === 'business-analysis-grounded'
      ? await ai.caches.create({
          model: BUSINESS_ANALYSIS_MODEL,
          config: {
            displayName,
            ttl,
            systemInstruction: buildBusinessAnalysisSystemInstruction(),
            contents: [
              {
                role: 'user',
                parts: [{ text: buildBusinessAnalysisCachedReferenceContent() }],
              },
            ],
          },
        })
      : await ai.caches.create({
          model: BUSINESS_ANALYSIS_MODEL,
          config: {
            displayName,
            ttl,
            systemInstruction: buildBusinessAnalysisHighlightsSystemInstruction(),
            contents: [
              {
                role: 'user',
                parts: [{ text: buildBusinessAnalysisHighlightsCachedReferenceContent() }],
              },
            ],
          },
        });

  if (!cache.name) {
    console.warn(`${LOG_TAG} create returned no name kind=${kind}`);
    return null;
  }

  const expiresAtMs = cache.expireTime
    ? Date.parse(cache.expireTime)
    : Date.now() + BUSINESS_ANALYSIS_GEMINI_CONTEXT_CACHE_TTL_SECONDS * 1000;

  memoryRegistry.set(buildMemoryKey(kind), { name: cache.name, expiresAtMs });

  const cachedTokens = cache.usageMetadata?.totalTokenCount ?? 0;
  console.info(
    `${LOG_TAG} created kind=${kind} name=${cache.name} cachedTokens=${cachedTokens} ttl=${ttl}`,
  );

  return cache.name;
}

async function resolveContextCacheName(
  ai: GoogleGenAI,
  kind: BusinessAnalysisGeminiCacheKind,
): Promise<string | null> {
  const memoryKey = buildMemoryKey(kind);
  const cached = memoryRegistry.get(memoryKey);
  if (isEntryValid(cached)) {
    return cached.name;
  }

  const inflight = inflightCreates.get(memoryKey);
  if (inflight) {
    return inflight;
  }

  const createPromise = (async () => {
    const existing = await findExistingCacheByDisplayName(ai, buildDisplayName(kind));
    if (existing) {
      memoryRegistry.set(memoryKey, existing);
      console.info(`${LOG_TAG} reused kind=${kind} name=${existing.name}`);
      return existing.name;
    }

    try {
      return await createContextCache(ai, kind);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn(`${LOG_TAG} create failed kind=${kind}: ${message}`);
      return null;
    } finally {
      inflightCreates.delete(memoryKey);
    }
  })();

  inflightCreates.set(memoryKey, createPromise);
  return createPromise;
}

export async function resolveBusinessAnalysisGeminiContextCache(
  ai: GoogleGenAI,
  kind: BusinessAnalysisGeminiCacheKind,
): Promise<string | null> {
  return resolveContextCacheName(ai, kind);
}
