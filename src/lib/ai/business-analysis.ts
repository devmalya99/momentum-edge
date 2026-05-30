import { z } from 'zod';

export const BUSINESS_ANALYSIS_MODEL = 'gemini-2.5-flash';
export const BUSINESS_ANALYSIS_CACHE_TTL_SECONDS = 12 * 60 * 60;

export const businessAnalysisRequestSchema = z.object({
  ticker: z.string().trim().min(1).max(40),
  companyName: z.string().trim().min(1).max(180),
  refresh: z.boolean().optional(),
  detailLevel: z.enum(['basic', 'extended']).optional(),
});

function coerceStringList(raw: unknown, maxItems: number): string[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, maxItems);
}

function trimWords(text: string, maxWords: number): string {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length <= maxWords) return text.trim();
  return words.slice(0, maxWords).join(' ');
}

function normalizeShortReport(raw: unknown): unknown {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return raw;
  const obj = { ...(raw as Record<string, unknown>) };
  const maybeReport =
    obj.report && typeof obj.report === 'object' && !Array.isArray(obj.report)
      ? (obj.report as Record<string, unknown>)
      : obj;
  return {
    story: trimWords(typeof maybeReport.story === 'string' ? maybeReport.story : '', 4),
    tailwinds: coerceStringList(maybeReport.tailwinds, 5).map((item) => trimWords(item, 4)),
    business_exposure: coerceStringList(maybeReport.business_exposure, 8).map((item) =>
      trimWords(item, 4),
    ),
    business_strength: coerceStringList(maybeReport.business_strength, 5),
    recent_transformations: coerceStringList(maybeReport.recent_transformations, 8),
    proof: coerceStringList(maybeReport.proof, 10),
  };
}

export const businessAnalysisShortReportSchema = z.preprocess(
  normalizeShortReport,
  z.object({
    story: z.coerce.string().trim().max(80).default(''),
    tailwinds: z.array(z.string().trim().min(1).max(80)).max(5).default([]),
    business_exposure: z.array(z.string().trim().min(1).max(80)).max(8).default([]),
    business_strength: z.array(z.string().trim().min(1).max(120)).max(5).default([]),
    recent_transformations: z.array(z.string().trim().min(1).max(140)).max(8).default([]),
    proof: z.array(z.string().trim().min(1).max(140)).max(10).default([]),
  }),
);

export const businessAnalysisBasicReportSchema = z.preprocess(
  normalizeShortReport,
  z.object({
    story: z.coerce.string().trim().max(80).default(''),
    tailwinds: z.array(z.string().trim().min(1).max(80)).max(5).default([]),
    business_exposure: z.array(z.string().trim().min(1).max(80)).max(8).default([]),
  }),
);

export const businessAnalysisExtendedReportSchema = z.preprocess(
  normalizeShortReport,
  z.object({
    business_strength: z.array(z.string().trim().min(1).max(120)).max(5).default([]),
    recent_transformations: z.array(z.string().trim().min(1).max(140)).max(8).default([]),
    proof: z.array(z.string().trim().min(1).max(140)).max(10).default([]),
  }),
);

/** Plain schemas for Vercel AI SDK streaming (no preprocess). */
export const businessAnalysisBasicStreamSchema = z.object({
  story: z.string(),
  tailwinds: z.array(z.string()),
  business_exposure: z.array(z.string()),
});

export const businessAnalysisExtendedStreamSchema = z.object({
  business_strength: z.array(z.string()),
  recent_transformations: z.array(z.string()),
  proof: z.array(z.string()),
});

export const businessAnalysisSourceSchema = z.object({
  title: z.coerce.string().trim().min(1),
  uri: z.coerce.string().trim().min(1),
});

export const businessAnalysisResponseSchema = z.object({
  ticker: z.string().trim().min(1).max(40),
  companyName: z.string().trim().min(1).max(180),
  report: businessAnalysisShortReportSchema,
  sources: z.array(businessAnalysisSourceSchema),
  meta: z.object({
    model: z.string().trim().min(1),
    generatedAt: z.string().trim().min(1),
    cacheExpiresAt: z.string().trim().min(1),
    cacheStatus: z.enum(['hit', 'miss', 'stale-refreshed']),
    webSearchQueries: z.array(z.string()),
    extendedFetched: z.boolean().default(false),
  }),
});

type GroundingChunkLike = {
  web?: {
    title?: string;
    uri?: string;
  };
};

type GroundingMetadataLike = {
  groundingChunks?: GroundingChunkLike[];
  webSearchQueries?: string[];
};

export type BusinessAnalysisShortReport = z.infer<typeof businessAnalysisShortReportSchema>;
export type BusinessAnalysisResponse = z.infer<typeof businessAnalysisResponseSchema>;

export function normalizeBusinessTicker(ticker: string): string {
  return ticker.trim().toUpperCase().replace(/^(NSE:|BSE:)/, '');
}

export function buildBusinessAnalysisSystemInstruction(detailLevel: 'basic' | 'extended' = 'basic'): string {
  if (detailLevel === 'extended') {
    return [
      'You are a momentum stock research extractor.',
      'Return valid JSON only.',
      'This is an EXTENDED follow-up call. Do NOT repeat story, tailwinds, or business_exposure.',
      'Return exactly this structure:',
      '{',
      '  "business_strength": [],',
      '  "recent_transformations": [],',
      '  "proof": []',
      '}',
      'Field rules:',
      '- business_strength: max 5 unique competitive advantages; if none, return ["No Unique Proposition"].',
      '- recent_transformations: only high-impact last 3-month developments; max 8.',
      '- proof: evidence momentum is visible operationally/financially; max 10.',
      'No filler and no investment advice.',
    ].join('\n');
  }
  return [
    'You are a momentum stock research extractor.',
    'Your goal is to identify why a stock may attract future investor attention and capital.',
    'Search recent news, company updates, earnings, investor presentations, exchange announcements, industry developments and sector trends.',
    'Focus only on information that can explain why traders and investors are paying attention to the stock.',
    'Do not provide investment advice.',
    'Do not recommend buying or selling.',
    'Do not discuss target prices.',
    'Do not discuss stop losses.',
    'Do not discuss valuation.',
    'Do not discuss technical analysis.',
    'Do not generate filler content.',
    'Do not repeat information across sections.',
    'Prioritize information from the last 2-3 months.',
    'Prioritize transformational developments over routine business activity.',
    'Prioritize facts over opinions.',
    'If no meaningful information exists for a section, return an empty array.',
    'Keep outputs short and highly information dense.',
    'Think like a trader scanning 100 stocks in one session.',
    'Return valid JSON only.',
    'Return exactly this structure:',
    '{',
    '  "story": "",',
    '  "tailwinds": [],',
    '  "business_exposure": [],',
    '  "business_strength": [],',
    '  "recent_transformations": [],',
    '  "proof": []',
    '}',
    'Field rules:',
    '- story: Single most important business or sector narrative. Max 4 words.',
    '- tailwinds: Strongest external growth forces. Max 5 items, max 4 words each.',
    '- business_exposure: Most important revenue, high-growth, or strategic areas only; do not list every segment. Max 8 items.',
    '- business_strength: Unique competitive positioning only (IP, moat, leadership, manufacturing/distribution/regulatory edge). Max 5 items. If no real edge, return ["No Unique Proposition"].',
    '- recent_transformations: Only high-impact developments from last 3 months; ignore routine updates. Max 8 items.',
    '- proof: Evidence momentum is visible in operations or financials. Max 10 items.',
  ].join('\n');
}

export function buildBusinessAnalysisUserPrompt(input: {
  ticker: string;
  companyName: string;
  referenceDate?: Date;
  detailLevel?: 'basic' | 'extended';
}): string {
  const today = (input.referenceDate ?? new Date()).toISOString().slice(0, 10);
  if (input.detailLevel === 'extended') {
    return [
      `Reference date: ${today}.`,
      `Target: ${input.ticker} (${input.companyName}).`,
      'Return exactly this JSON structure:',
      '{',
      '  "business_strength": [],',
      '  "recent_transformations": [],',
      '  "proof": []',
      '}',
    ].join('\n');
  }
  return [
    `Reference date: ${today}.`,
    `Target: ${input.ticker} (${input.companyName}).`,
    'Return exactly this JSON structure:',
    '{',
    '  "story": "",',
    '  "tailwinds": [],',
    '  "business_exposure": [],',
    '}',
  ].join('\n');
}

export function extractGroundingSources(
  groundingMetadata: GroundingMetadataLike | undefined,
): Array<{ title: string; uri: string }> {
  const chunks = groundingMetadata?.groundingChunks ?? [];
  const seen = new Set<string>();
  const sources: Array<{ title: string; uri: string }> = [];
  for (const chunk of chunks) {
    const uri = chunk.web?.uri?.trim();
    if (!uri || seen.has(uri)) continue;
    seen.add(uri);
    sources.push({ title: chunk.web?.title?.trim() || uri, uri });
  }
  return sources;
}

export function sanitizeBusinessAnalysisSources(
  sources: Array<{ title: string; uri: string }>,
): Array<{ title: string; uri: string }> {
  const seen = new Set<string>();
  const out: Array<{ title: string; uri: string }> = [];
  for (const source of sources) {
    const uri = source.uri?.trim();
    if (!uri || seen.has(uri)) continue;
    try {
      const parsed = new URL(uri);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') continue;
    } catch {
      continue;
    }
    seen.add(uri);
    out.push({ title: source.title?.trim().slice(0, 240) || uri, uri });
  }
  return out;
}

export function extractJsonObject(raw: string): unknown {
  const trimmed = raw.trim();
  if (!trimmed) throw new Error('Model returned empty text');
  const firstBrace = trimmed.indexOf('{');
  const lastBrace = trimmed.lastIndexOf('}');
  if (firstBrace < 0 || lastBrace <= firstBrace) {
    throw new Error('Model response did not contain a JSON object');
  }
  return JSON.parse(trimmed.slice(firstBrace, lastBrace + 1));
}
