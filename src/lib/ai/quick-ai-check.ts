import { z } from 'zod';
import {
  businessAnalysisSourceSchema,
  extractGroundingSources,
  extractJsonObject,
  normalizeBusinessTicker,
  sanitizeBusinessAnalysisSources,
} from '@/lib/ai/business-analysis';

export const QUICK_AI_CHECK_MODEL = 'gemini-2.5-flash';
export const QUICK_AI_CHECK_CACHE_TTL_SECONDS = 12 * 60 * 60;

export const QUICK_AI_CHECK_FACTORS = [
  'Revenue growth',
  'Profit growth',
  'Margin profile',
  'Top line vs bottom line',
  'Debt',
  'Order book',
  'Business transformation',
  'Company size',
  'Growth potential',
  'Expansion aggressiveness',
] as const;

export const quickAiCheckCategorySchema = z.enum([
  'Hyper Explosive',
  'Super Growth',
  'Steady Growth',
  'Mature Growth',
  'No Growth',
  'In Decline',
]);

export const quickAiCheckVerdictSchema = z.enum(['Strong', 'Mixed', 'Weak', 'Unclear']);
export const quickAiCheckFactorNameSchema = z.enum(QUICK_AI_CHECK_FACTORS);

export const quickAiCheckRequestSchema = z.object({
  ticker: z.string().trim().min(1).max(40),
  companyName: z.string().trim().min(1).max(180),
  refresh: z.boolean().optional(),
});

export const quickAiCheckSummariesRequestSchema = z.object({
  tickers: z.array(z.string().trim().min(1).max(40)).min(1).max(1000),
});

const lenientText = z.coerce.string().trim().min(1);

function coerceStringList(raw: unknown, maxItems: number): string[] {
  if (Array.isArray(raw)) {
    return raw
      .filter((item): item is string => typeof item === 'string')
      .map((item) => item.trim())
      .filter(Boolean)
      .slice(0, maxItems);
  }
  if (typeof raw === 'string' && raw.trim()) {
    return [raw.trim()];
  }
  return [];
}

function normalizeQuickAiCheckCategory(raw: unknown): QuickAiCheckCategory | undefined {
  if (typeof raw !== 'string') return undefined;
  const compact = raw.trim().replace(/\s+/g, '').toUpperCase();
  const aliases: Record<string, QuickAiCheckCategory> = {
    HYPEREXPLOSIVE: 'Hyper Explosive',
    SUPERGROWTH: 'Super Growth',
    STEADYGROWTH: 'Steady Growth',
    MATUREGROWTH: 'Mature Growth',
    NOGROWTH: 'No Growth',
    INDECLINE: 'In Decline',
  };
  return aliases[compact];
}

const quickAiCheckCategoryValueSchema = z.preprocess(
  (raw) => normalizeQuickAiCheckCategory(raw) ?? raw,
  quickAiCheckCategorySchema,
);

function normalizeQuickAiCheckFactorName(raw: unknown): QuickAiCheckFactorName | undefined {
  if (typeof raw !== 'string') return undefined;
  const compact = raw.trim().replace(/[^a-z0-9]/gi, '').toLowerCase();
  const aliases: Record<string, QuickAiCheckFactorName> = {
    revenuegrowth: 'Revenue growth',
    profitgrowth: 'Profit growth',
    marginprofile: 'Margin profile',
    margins: 'Margin profile',
    toplinevsbottomline: 'Top line vs bottom line',
    toplinebottomline: 'Top line vs bottom line',
    toplinevsprofitability: 'Top line vs bottom line',
    debt: 'Debt',
    orderbook: 'Order book',
    demandvisibility: 'Order book',
    businesstransformation: 'Business transformation',
    transformation: 'Business transformation',
    companysize: 'Company size',
    size: 'Company size',
    growthpotential: 'Growth potential',
    runway: 'Growth potential',
    expansionaggressiveness: 'Expansion aggressiveness',
    aggressiveexpansion: 'Expansion aggressiveness',
    expansion: 'Expansion aggressiveness',
  };
  return aliases[compact];
}

function normalizeQuickAiCheckVerdict(raw: unknown): QuickAiCheckVerdict {
  if (typeof raw !== 'string') return 'Unclear';
  const compact = raw.trim().replace(/\s+/g, '').toLowerCase();
  if (['strong', 'positive', 'good', 'healthy', 'high'].includes(compact)) return 'Strong';
  if (['weak', 'poor', 'negative', 'low', 'stretched'].includes(compact)) return 'Weak';
  if (['mixed', 'balanced', 'moderate', 'average', 'neutral'].includes(compact)) return 'Mixed';
  return 'Unclear';
}

function normalizeQuickAiCheckFactors(raw: unknown): QuickAiCheckFactor[] {
  const byName = new Map<QuickAiCheckFactorName, QuickAiCheckFactor>();
  if (Array.isArray(raw)) {
    for (const item of raw) {
      if (!item || typeof item !== 'object' || Array.isArray(item)) continue;
      const record = item as Record<string, unknown>;
      const name = normalizeQuickAiCheckFactorName(record.name);
      if (!name || byName.has(name)) continue;
      const note =
        typeof record.note === 'string'
          ? record.note.trim().slice(0, 180)
          : typeof record.reason === 'string'
            ? record.reason.trim().slice(0, 180)
            : '';
      byName.set(name, {
        name,
        verdict: normalizeQuickAiCheckVerdict(record.verdict),
        note,
      });
    }
  }

  return QUICK_AI_CHECK_FACTORS.map((name) => byName.get(name) ?? { name, verdict: 'Unclear', note: '' });
}

function preprocessQuickAiCheckLlm(raw: unknown): unknown {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return raw;
  const obj = { ...(raw as Record<string, unknown>) };
  const category = normalizeQuickAiCheckCategory(obj.category);
  if (category) obj.category = category;
  obj.summary = typeof obj.summary === 'string' ? obj.summary.trim() : obj.summary;
  obj.ratingReasons = coerceStringList(obj.ratingReasons, 6);
  obj.factors = normalizeQuickAiCheckFactors(obj.factors);
  return obj;
}

export const quickAiCheckFactorSchema = z.object({
  name: quickAiCheckFactorNameSchema,
  verdict: quickAiCheckVerdictSchema,
  note: z.coerce.string().trim().max(180),
});

export const quickAiCheckLlmSchema = z.preprocess(
  preprocessQuickAiCheckLlm,
  z.object({
    category: quickAiCheckCategoryValueSchema,
    summary: lenientText,
    ratingReasons: z.array(z.string().trim().min(1).max(120)).min(2).max(6),
    factors: z.array(quickAiCheckFactorSchema).length(QUICK_AI_CHECK_FACTORS.length),
  }),
);

export const quickAiCheckResponseSchema = z.object({
  ticker: z.string().trim().min(1).max(40),
  companyName: z.string().trim().min(1).max(180),
  category: quickAiCheckCategoryValueSchema,
  summary: lenientText,
  ratingReasons: z.array(z.string().trim().min(1).max(120)),
  factors: z.array(quickAiCheckFactorSchema).length(QUICK_AI_CHECK_FACTORS.length),
  sources: z.array(businessAnalysisSourceSchema),
  meta: z.object({
    model: z.string().trim().min(1),
    generatedAt: z.string().trim().min(1),
    cacheExpiresAt: z.string().trim().min(1),
    cacheStatus: z.enum(['hit', 'miss', 'stale-refreshed']),
    webSearchQueries: z.array(z.string()),
  }),
});

export const quickAiCheckSummarySchema = z.object({
  ticker: z.string().trim().min(1).max(40),
  category: quickAiCheckCategoryValueSchema,
  ratingReasons: z.array(z.string().trim().min(1).max(120)),
  isStale: z.boolean(),
});

export const quickAiCheckSummariesResponseSchema = z.object({
  summaries: z.array(quickAiCheckSummarySchema),
});

export type QuickAiCheckCategory = z.infer<typeof quickAiCheckCategorySchema>;
export type QuickAiCheckVerdict = z.infer<typeof quickAiCheckVerdictSchema>;
export type QuickAiCheckFactorName = z.infer<typeof quickAiCheckFactorNameSchema>;
export type QuickAiCheckFactor = z.infer<typeof quickAiCheckFactorSchema>;
export type QuickAiCheckLlmPayload = z.infer<typeof quickAiCheckLlmSchema>;
export type QuickAiCheckResponse = z.infer<typeof quickAiCheckResponseSchema>;
export type QuickAiCheckSummary = z.infer<typeof quickAiCheckSummarySchema>;

export function quickAiCheckCategoryBadgeLabel(category: QuickAiCheckCategory): string {
  return category;
}

export function buildQuickAiCheckSystemInstruction(): string {
  return [
    'Role: Indian equity research analyst. Evaluate business fundamentals/trajectory, not stock price.',
    'Output: Strict JSON only. No markdown, no code fences.',
    'Rules:',
    '- Ground facts via Google Search.',
    '- Be concise. Use "Unclear" if data is missing. No valuation/target prices.',
    '- Category: Hyper Explosive | Super Growth | Steady Growth | Mature Growth | No Growth | In Decline',
    '- Factor verdicts: Strong | Mixed | Weak | Unclear',
    `- Factors (strict order): ${QUICK_AI_CHECK_FACTORS.join(', ')}`,
    'Schema:',
    '{',
    '  "category": "Hyper Explosive|Super Growth|Steady Growth|Mature Growth|No Growth|In Decline",',
    '  "summary": "3-4 concise sentences",',
    '  "ratingReasons": ["2-5 short tags"],',
    '  "factors": [',
    '    { "name": "Exact Factor", "verdict": "Strong|Mixed|Weak|Unclear", "note": "<120 chars" }',
    '  ]',
    '}',
  ].join('\n');
}

export function buildQuickAiCheckUserPrompt(input: {
  ticker: string;
  companyName: string;
  referenceDate?: Date;
}): string {
  const today = (input.referenceDate ?? new Date()).toISOString().slice(0, 10);
  return [
    `Date: ${today}`,
    `Target: ${normalizeBusinessTicker(input.ticker)} (${input.companyName.trim()})`,
    'Sources: Latest filings, investor commentary, credible reporting.',
    'Specific Factor Context:',
    '- Top line vs bottom line: Does revenue growth translate to profit?',
    '- Company size: View as resilience context, not an automatic positive.',
    '- Expansion aggressiveness: Disciplined vs overextended.',
    'Return exact JSON.',
  ].join('\n');
}

export function parseQuickAiCheckLlmPayload(raw: unknown): QuickAiCheckLlmPayload {
  return quickAiCheckLlmSchema.parse(raw);
}

export function extractQuickAiCheckJson(raw: string): QuickAiCheckLlmPayload {
  return parseQuickAiCheckLlmPayload(extractJsonObject(raw));
}

export { extractGroundingSources, normalizeBusinessTicker, sanitizeBusinessAnalysisSources };
