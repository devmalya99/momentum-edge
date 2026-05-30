import type { QuickAiCheckCategory, QuickAiCheckResponse } from '@/lib/ai/quick-ai-check';
import { getNeonSql } from '@/lib/db/ad-ratio';

let schemaReady = false;

type RawCacheRow = {
  cache_key: string;
  ticker: string | null;
  company_name: string;
  payload_json: unknown;
  category: string;
  rating_reasons: unknown;
  model: string;
  generated_at: string;
  stale_after: string;
};

type RawSummaryRow = {
  ticker: string;
  category: string;
  rating_reasons: unknown;
  stale_after: string;
};

export type AiQuickAiCheckCacheRow = {
  cacheKey: string;
  ticker: string | null;
  companyName: string;
  payload: QuickAiCheckResponse;
  category: QuickAiCheckCategory;
  ratingReasons: string[];
  model: string;
  generatedAt: string;
  staleAfter: string;
};

export type AiQuickAiCheckSummaryRow = {
  ticker: string;
  category: QuickAiCheckCategory;
  ratingReasons: string[];
  staleAfter: string;
};

function normalizeTicker(ticker: string | null | undefined): string | null {
  if (!ticker) return null;
  const raw = ticker.trim().toUpperCase();
  if (!raw) return null;
  return raw.replace(/^(NSE:|BSE:)/, '');
}

function parseReasons(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter(Boolean);
}

export async function ensureAiQuickAiCheckCacheTable(): Promise<void> {
  if (schemaReady) return;
  const sql = getNeonSql();
  await sql`
    CREATE TABLE IF NOT EXISTS ai_quick_ai_check_cache (
      cache_key text PRIMARY KEY,
      ticker text,
      company_name text NOT NULL,
      payload_json jsonb NOT NULL,
      category text NOT NULL,
      rating_reasons jsonb NOT NULL DEFAULT '[]'::jsonb,
      model text NOT NULL,
      generated_at timestamptz NOT NULL,
      stale_after timestamptz NOT NULL,
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS ai_quick_ai_check_cache_ticker_idx
    ON ai_quick_ai_check_cache (ticker)
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS ai_quick_ai_check_cache_stale_after_idx
    ON ai_quick_ai_check_cache (stale_after)
  `;
  schemaReady = true;
}

export async function getAiQuickAiCheckCache(
  cacheKey: string,
): Promise<AiQuickAiCheckCacheRow | null> {
  await ensureAiQuickAiCheckCacheTable();
  const sql = getNeonSql();
  const rows = await sql`
    SELECT
      cache_key,
      ticker,
      company_name,
      payload_json,
      category,
      rating_reasons,
      model,
      generated_at::text AS generated_at,
      stale_after::text AS stale_after
    FROM ai_quick_ai_check_cache
    WHERE cache_key = ${cacheKey}
    LIMIT 1
  `;
  if (!rows.length) return null;
  const row = rows[0] as RawCacheRow;
  return {
    cacheKey: row.cache_key,
    ticker: row.ticker,
    companyName: row.company_name,
    payload: row.payload_json as QuickAiCheckResponse,
    category: row.category as QuickAiCheckCategory,
    ratingReasons: parseReasons(row.rating_reasons),
    model: row.model,
    generatedAt: row.generated_at,
    staleAfter: row.stale_after,
  };
}

export async function upsertAiQuickAiCheckCache(input: {
  cacheKey: string;
  ticker: string;
  companyName: string;
  payload: QuickAiCheckResponse;
  category: QuickAiCheckCategory;
  ratingReasons: string[];
  model: string;
  generatedAtIso: string;
  staleAfterIso: string;
}): Promise<void> {
  await ensureAiQuickAiCheckCacheTable();
  const sql = getNeonSql();
  const cacheKey = input.cacheKey.trim();
  const ticker = normalizeTicker(input.ticker);
  const companyName = input.companyName.trim();
  await sql`
    INSERT INTO ai_quick_ai_check_cache (
      cache_key,
      ticker,
      company_name,
      payload_json,
      category,
      rating_reasons,
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
      ${JSON.stringify(input.ratingReasons)}::jsonb,
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
      rating_reasons = EXCLUDED.rating_reasons,
      model = EXCLUDED.model,
      generated_at = EXCLUDED.generated_at,
      stale_after = EXCLUDED.stale_after,
      updated_at = now()
  `;
}

export async function listAiQuickAiCheckSummaries(
  tickers: string[],
): Promise<AiQuickAiCheckSummaryRow[]> {
  await ensureAiQuickAiCheckCacheTable();
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
      rating_reasons,
      stale_after::text AS stale_after
    FROM ai_quick_ai_check_cache
    WHERE ticker = ANY(${normalized}::text[])
      AND ticker IS NOT NULL
  `;

  return (rows as RawSummaryRow[]).map((row) => ({
    ticker: row.ticker,
    category: row.category as QuickAiCheckCategory,
    ratingReasons: parseReasons(row.rating_reasons),
    staleAfter: row.stale_after,
  }));
}
