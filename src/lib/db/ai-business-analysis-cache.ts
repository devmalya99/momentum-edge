import type { BusinessAnalysisResponse, BusinessDirection, BusinessMomentumCategory } from '@/lib/ai/business-analysis';
import { getNeonSql } from '@/lib/db/ad-ratio';

let schemaReady = false;

export const AI_BUSINESS_ANALYSIS_STALE_MS = 12 * 60 * 60 * 1000;

function normalizeTicker(ticker: string | null | undefined): string | null {
  if (!ticker) return null;
  const raw = ticker.trim().toUpperCase();
  if (!raw) return null;
  return raw.replace(/^(NSE:|BSE:)/, '');
}

type RawCacheRow = {
  cache_key: string;
  ticker: string | null;
  company_name: string;
  payload_json: unknown;
  category: string;
  composite_score: number;
  direction: string;
  rating_reasons: unknown;
  previous_category: string | null;
  previous_composite_score: number | null;
  model: string;
  generated_at: string;
  stale_after: string;
};

type RawSummaryRow = {
  ticker: string;
  category: string;
  composite_score: number;
  direction: string;
  previous_category: string | null;
  previous_composite_score: number | null;
  rating_reasons: unknown;
  stale_after: string;
};

export type AiBusinessAnalysisCacheRow = {
  cacheKey: string;
  ticker: string | null;
  companyName: string;
  payload: BusinessAnalysisResponse;
  category: BusinessMomentumCategory;
  compositeScore: number;
  direction: BusinessDirection;
  ratingReasons: string[];
  previousCategory: BusinessMomentumCategory | null;
  previousCompositeScore: number | null;
  model: string;
  generatedAt: string;
  staleAfter: string;
};

export type AiBusinessAnalysisSummaryRow = {
  ticker: string;
  category: BusinessMomentumCategory;
  compositeScore: number;
  direction: BusinessDirection;
  previousCategory: BusinessMomentumCategory | null;
  previousCompositeScore: number | null;
  ratingReasons: string[];
  staleAfter: string;
};

function parseReasons(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((item): item is string => typeof item === 'string').map((item) => item.trim()).filter(Boolean);
}

export async function ensureAiBusinessAnalysisCacheTable(): Promise<void> {
  if (schemaReady) return;
  const sql = getNeonSql();
  await sql`
    CREATE TABLE IF NOT EXISTS ai_business_analysis_cache (
      cache_key text PRIMARY KEY,
      ticker text,
      company_name text NOT NULL,
      payload_json jsonb NOT NULL,
      category text NOT NULL,
      composite_score integer NOT NULL,
      direction text NOT NULL,
      rating_reasons jsonb NOT NULL DEFAULT '[]'::jsonb,
      previous_category text,
      previous_composite_score integer,
      model text NOT NULL,
      generated_at timestamptz NOT NULL,
      stale_after timestamptz NOT NULL,
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `;
  await sql`
    ALTER TABLE ai_business_analysis_cache
    ADD COLUMN IF NOT EXISTS previous_category text
  `;
  await sql`
    ALTER TABLE ai_business_analysis_cache
    ADD COLUMN IF NOT EXISTS previous_composite_score integer
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS ai_business_analysis_cache_ticker_idx
    ON ai_business_analysis_cache (ticker)
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS ai_business_analysis_cache_stale_after_idx
    ON ai_business_analysis_cache (stale_after)
  `;
  schemaReady = true;
}

export async function getAiBusinessAnalysisCache(
  cacheKey: string,
): Promise<AiBusinessAnalysisCacheRow | null> {
  await ensureAiBusinessAnalysisCacheTable();
  const sql = getNeonSql();
  const rows = await sql`
    SELECT
      cache_key,
      ticker,
      company_name,
      payload_json,
      category,
      composite_score,
      direction,
      rating_reasons,
      previous_category,
      previous_composite_score,
      model,
      generated_at::text AS generated_at,
      stale_after::text AS stale_after
    FROM ai_business_analysis_cache
    WHERE cache_key = ${cacheKey}
    LIMIT 1
  `;
  if (!rows.length) return null;
  const row = rows[0] as RawCacheRow;
  return {
    cacheKey: row.cache_key,
    ticker: row.ticker,
    companyName: row.company_name,
    payload: row.payload_json as BusinessAnalysisResponse,
    category: row.category as BusinessMomentumCategory,
    compositeScore: row.composite_score,
    direction: row.direction as BusinessDirection,
    ratingReasons: parseReasons(row.rating_reasons),
    previousCategory: row.previous_category as BusinessMomentumCategory | null,
    previousCompositeScore: row.previous_composite_score,
    model: row.model,
    generatedAt: row.generated_at,
    staleAfter: row.stale_after,
  };
}

export async function upsertAiBusinessAnalysisCache(input: {
  cacheKey: string;
  ticker: string;
  companyName: string;
  payload: BusinessAnalysisResponse;
  category: BusinessMomentumCategory;
  compositeScore: number;
  direction: BusinessDirection;
  ratingReasons: string[];
  previousCategory: BusinessMomentumCategory | null;
  previousCompositeScore: number | null;
  model: string;
  generatedAtIso: string;
  staleAfterIso: string;
}): Promise<void> {
  await ensureAiBusinessAnalysisCacheTable();
  const sql = getNeonSql();
  const cacheKey = input.cacheKey.trim();
  const ticker = normalizeTicker(input.ticker);
  const companyName = input.companyName.trim();
  await sql`
    INSERT INTO ai_business_analysis_cache (
      cache_key,
      ticker,
      company_name,
      payload_json,
      category,
      composite_score,
      direction,
      rating_reasons,
      previous_category,
      previous_composite_score,
      model,
      generated_at,
      stale_after,
      updated_at
    )
    VALUES (
      ${cacheKey},
      ${ticker},
      ${companyName},
      ${JSON.stringify(input.payload)}::jsonb,
      ${input.category},
      ${Math.max(0, Math.min(100, Math.round(input.compositeScore)))},
      ${input.direction},
      ${JSON.stringify(input.ratingReasons)}::jsonb,
      ${input.previousCategory},
      ${input.previousCompositeScore},
      ${input.model.trim().slice(0, 64)},
      ${input.generatedAtIso}::timestamptz,
      ${input.staleAfterIso}::timestamptz,
      now()
    )
    ON CONFLICT (cache_key) DO UPDATE SET
      ticker = EXCLUDED.ticker,
      company_name = EXCLUDED.company_name,
      payload_json = EXCLUDED.payload_json,
      category = EXCLUDED.category,
      composite_score = EXCLUDED.composite_score,
      direction = EXCLUDED.direction,
      rating_reasons = EXCLUDED.rating_reasons,
      previous_category = EXCLUDED.previous_category,
      previous_composite_score = EXCLUDED.previous_composite_score,
      model = EXCLUDED.model,
      generated_at = EXCLUDED.generated_at,
      stale_after = EXCLUDED.stale_after,
      updated_at = now()
  `;
}

export async function listAiBusinessAnalysisSummaries(
  tickers: string[],
): Promise<AiBusinessAnalysisSummaryRow[]> {
  await ensureAiBusinessAnalysisCacheTable();
  const normalizedSet = new Set<string>();
  for (const ticker of tickers) {
    const key = normalizeTicker(ticker);
    if (key) normalizedSet.add(key);
  }
  const normalized = [...normalizedSet];
  if (normalized.length === 0) return [];

  const sql = getNeonSql();
  const rows = await sql`
    SELECT
      ticker,
      category,
      composite_score,
      direction,
      previous_category,
      previous_composite_score,
      rating_reasons,
      stale_after::text AS stale_after
    FROM ai_business_analysis_cache
    WHERE ticker = ANY(${normalized}::text[])
      AND ticker IS NOT NULL
  `;

  return (rows as RawSummaryRow[]).map((row) => ({
    ticker: row.ticker,
    category: row.category as BusinessMomentumCategory,
    compositeScore: row.composite_score,
    direction: row.direction as BusinessDirection,
    previousCategory: row.previous_category as BusinessMomentumCategory | null,
    previousCompositeScore: row.previous_composite_score,
    ratingReasons: parseReasons(row.rating_reasons),
    staleAfter: row.stale_after,
  }));
}
