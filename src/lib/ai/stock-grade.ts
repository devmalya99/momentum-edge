import { z } from 'zod';
import {
  businessAnalysisSourceSchema,
  extractGroundingSources,
  extractJsonObject,
  normalizeBusinessTicker,
  sanitizeBusinessAnalysisSources,
} from '@/lib/ai/business-analysis';

export const STOCK_GRADE_MODEL = 'gemini-2.5-flash';
export const STOCK_GRADE_CACHE_TTL_SECONDS = 24 * 60 * 60;

export const STOCK_GRADE_LABELS = [
  'Exploding',
  'Super growth',
  'Turning around',
  'Nothing big yet',
  'In stress',
] as const;

export const stockGradeLabelSchema = z.enum(STOCK_GRADE_LABELS);

export const stockGradeRequestSchema = z.object({
  ticker: z.string().trim().min(1).max(40),
  companyName: z.string().trim().min(1).max(180),
  refresh: z.boolean().optional(),
  /** Read shared DB cache only — never calls Gemini. */
  cacheOnly: z.boolean().optional(),
});

function normalizeStockGradeLabel(raw: unknown): StockGradeLabel | undefined {
  if (typeof raw !== 'string') return undefined;
  const compact = raw.trim().replace(/\s+/g, ' ').toLowerCase();
  const aliases: Record<string, StockGradeLabel> = {
    exploding: 'Exploding',
    'super growth': 'Super growth',
    supergrowth: 'Super growth',
    'turning around': 'Turning around',
    turningaround: 'Turning around',
    'nothing big yet': 'Nothing big yet',
    nothingbigyet: 'Nothing big yet',
    'in stress': 'In stress',
    instress: 'In stress',
  };
  return aliases[compact];
}

function preprocessStockGradeLlm(raw: unknown): unknown {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return raw;
  const obj = { ...(raw as Record<string, unknown>) };
  const gradeRaw = obj.Grade ?? obj.grade;
  const grade = normalizeStockGradeLabel(gradeRaw);
  if (grade) obj.Grade = grade;
  const reasonRaw = obj.reason ?? obj.Reason;
  if (typeof reasonRaw === 'string') obj.reason = reasonRaw.trim();
  return obj;
}

export const stockGradeLlmSchema = z.preprocess(
  preprocessStockGradeLlm,
  z.object({
    Grade: stockGradeLabelSchema,
    reason: z.coerce.string().trim().min(1).max(280),
  }),
);

export const stockGradeResponseSchema = z.object({
  ticker: z.string().trim().min(1).max(40),
  companyName: z.string().trim().min(1).max(180),
  grade: stockGradeLabelSchema,
  reason: z.coerce.string().trim().min(1).max(280),
  sources: z.array(businessAnalysisSourceSchema),
  meta: z.object({
    model: z.string().trim().min(1),
    generatedAt: z.string().trim().min(1),
    cacheExpiresAt: z.string().trim().min(1),
    cacheStatus: z.enum(['hit', 'miss', 'stale-refreshed']),
    webSearchQueries: z.array(z.string()),
  }),
});

export type StockGradeLabel = z.infer<typeof stockGradeLabelSchema>;
export type StockGradeLlmPayload = z.infer<typeof stockGradeLlmSchema>;
export type StockGradeResponse = z.infer<typeof stockGradeResponseSchema>;

export function buildStockGradeSystemInstruction(): string {
  return [
    'Expert Indian equity analyst. Search latest earnings, guidance, order wins, and news (last 3 months).',
    'Pick exactly ONE grade:',
    'Exploding=sharp acceleration; Super growth=strong sustained growth; Turning around=recovery improving;',
    'Nothing big yet=stable/no clear inflection; In stress=decline/distress/headwinds.',
    'JSON only, no markdown: {"Grade":"<exact label>","reason":"<20-30 words citing one recent fact>"}',
  ].join(' ');
}

export function buildStockGradeUserPrompt(input: {
  ticker: string;
  companyName: string;
  referenceDate?: Date;
}): string {
  const today = (input.referenceDate ?? new Date()).toISOString().slice(0, 10);
  return `${today} | ${normalizeBusinessTicker(input.ticker)} (${input.companyName.trim()})`;
}

export function parseStockGradeLlmPayload(raw: unknown): StockGradeLlmPayload {
  return stockGradeLlmSchema.parse(raw);
}

export function extractStockGradeJson(raw: string): StockGradeLlmPayload {
  return parseStockGradeLlmPayload(extractJsonObject(raw));
}

export function stockGradeBadgeClass(grade: StockGradeLabel): string {
  switch (grade) {
    case 'Exploding':
      return 'border-orange-400/35 bg-orange-500/15 text-orange-200';
    case 'Super growth':
      return 'border-emerald-400/35 bg-emerald-500/15 text-emerald-200';
    case 'Turning around':
      return 'border-blue-400/35 bg-blue-500/15 text-blue-200';
    case 'Nothing big yet':
      return 'border-white/15 bg-white/5 text-gray-400';
    case 'In stress':
      return 'border-red-400/35 bg-red-500/15 text-red-200';
  }
}

export { extractGroundingSources, normalizeBusinessTicker, sanitizeBusinessAnalysisSources };
