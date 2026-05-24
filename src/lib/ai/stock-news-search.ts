import { z } from 'zod';

export const STOCK_NEWS_SEARCH_MODEL = 'gemini-2.5-flash';
export const STOCK_NEWS_SEARCH_CACHE_TTL_SECONDS = 12 * 60 * 60;

export const stockNewsSearchRequestSchema = z.object({
  query: z.string().trim().min(1, 'Stock name or ticker is required').max(120),
  refresh: z.boolean().optional(),
});

export const stockNewsSearchSectionSchema = z.object({
  latestNews: z.string().min(1),
  upcomingEvents: z.string().min(1),
});

export type StockNewsSearchSections = z.infer<typeof stockNewsSearchSectionSchema>;

export type StockNewsSearchSource = {
  title: string;
  uri: string;
};

export type StockNewsSearchResult = {
  query: string;
  markdown: string;
  sections: StockNewsSearchSections;
  sources: StockNewsSearchSource[];
  meta: {
    model: string;
    generatedAt: string;
    cacheExpiresAt: string;
    webSearchQueries: string[];
  };
};

const LATEST_NEWS_HEADING = '## Latest News & Updates';
const UPCOMING_EVENTS_HEADING = '## Upcoming Events';
const NEWS_LOOKBACK_DAYS = 60;

export function normalizeStockNewsQuery(query: string): string {
  return query.trim().toUpperCase();
}

export function getStockNewsSearchDateWindow(referenceDate = new Date()) {
  const end = new Date(referenceDate);
  const start = new Date(end);
  start.setDate(start.getDate() - NEWS_LOOKBACK_DAYS);

  return {
    startDate: start.toISOString().slice(0, 10),
    endDate: end.toISOString().slice(0, 10),
    lookbackDays: NEWS_LOOKBACK_DAYS,
  };
}

export function buildStockNewsSearchSystemInstruction(referenceDate = new Date()): string {
  const { startDate, endDate, lookbackDays } = getStockNewsSearchDateWindow(referenceDate);

  return [
    'You are an equity research assistant focused on Indian and global listed equities.',
    'Use Google Search to find credible news and confirmed upcoming corporate events.',
    'Only include facts supported by search results. Do not invent dates, earnings calls, AGMs, or corporate actions.',
    'If information is unavailable, say so explicitly in that section instead of guessing.',
    'Do not provide buy/sell recommendations, price targets, or investment advice.',
    `For "${LATEST_NEWS_HEADING}", include ALL materially important news published between ${startDate} and ${endDate} (last ${lookbackDays} days / ~2 months).`,
    'Exclude any news older than this window.',
    'Prioritize: earnings/results, guidance, management changes, M&A, regulatory actions, large orders/contracts, product launches, analyst actions, index inclusion/exclusion, and major sector/policy impacts.',
    'Sort bullets newest-first. Every bullet must include an explicit date (YYYY-MM-DD or Month DD, YYYY).',
    `For "${UPCOMING_EVENTS_HEADING}", list confirmed upcoming events still ahead of ${endDate} (earnings, AGMs, board meetings, dividends, splits, buybacks, investor/analyst days).`,
    'Every upcoming-event bullet must include a date or "Date TBD" if not yet announced.',
    'Format the entire response as Markdown with exactly these two top-level sections in order:',
    LATEST_NEWS_HEADING,
    '- Bullet list of all important news within the 2-month window.',
    UPCOMING_EVENTS_HEADING,
    '- Bullet list of upcoming corporate events.',
    'Do not add any other top-level headings.',
  ].join('\n');
}

export function buildStockNewsSearchUserPrompt(query: string, referenceDate = new Date()): string {
  const { startDate, endDate, lookbackDays } = getStockNewsSearchDateWindow(referenceDate);

  return [
    `Research "${query}" and compile a complete digest of important developments.`,
    `Latest news window: ${startDate} through ${endDate} (last ${lookbackDays} days).`,
    'Prefer NSE/BSE listed context when the query looks like an Indian ticker or company.',
    'Run multiple targeted searches if needed to capture all major news in the window — do not stop at only the top 3 headlines.',
    'Include source dates on every bullet. Use concise but complete bullet points under each required section.',
  ].join('\n');
}

export function parseStockNewsSearchMarkdown(markdown: string): StockNewsSearchSections {
  const normalized = markdown.trim();
  const latestIdx = normalized.indexOf(LATEST_NEWS_HEADING);
  const eventsIdx = normalized.indexOf(UPCOMING_EVENTS_HEADING);

  if (latestIdx === -1 || eventsIdx === -1 || eventsIdx <= latestIdx) {
    throw new Error('Model response missing required Markdown sections');
  }

  const latestNews = normalized
    .slice(latestIdx + LATEST_NEWS_HEADING.length, eventsIdx)
    .trim();
  const upcomingEvents = normalized.slice(eventsIdx + UPCOMING_EVENTS_HEADING.length).trim();

  if (!latestNews || !upcomingEvents) {
    throw new Error('Model response sections are empty');
  }

  return stockNewsSearchSectionSchema.parse({ latestNews, upcomingEvents });
}

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

export function extractGroundingSources(
  groundingMetadata: GroundingMetadataLike | undefined,
): StockNewsSearchSource[] {
  const chunks = groundingMetadata?.groundingChunks ?? [];
  const seen = new Set<string>();
  const sources: StockNewsSearchSource[] = [];

  for (const chunk of chunks) {
    const uri = chunk.web?.uri?.trim();
    if (!uri || seen.has(uri)) continue;
    seen.add(uri);
    sources.push({
      title: chunk.web?.title?.trim() || uri,
      uri,
    });
  }

  return sources;
}
