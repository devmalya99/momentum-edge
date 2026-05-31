import type { StockGradeLabel, StockGradeResponse } from '@/lib/ai/stock-grade';
import { getNeonSql } from '@/lib/db/ad-ratio';

let schemaReady = false;

type RawCacheRow = {
  cache_key: string;
  ticker: string | null;
  company_name: string;
  payload_json: unknown;
  grade: string;
  model: string;
  generated_at: string;
  stale_after: string;
};

export type AiStockGradeCacheRow = {
  cacheKey: string;
  ticker: string | null;
  companyName: string;
  payload: StockGradeResponse;
  grade: StockGradeLabel;
  model: string;
  generatedAt: string;
  staleAfter: string;
};

function normalizeTicker(ticker: string | null | undefined): string | null {
  if (!ticker) return null;
  const raw = ticker.trim().toUpperCase();
  if (!raw) return null;
  return raw.replace(/^(NSE:|BSE:)/, '');
}

export async function ensureAiStockGradeCacheTable(): Promise<void> {
  if (schemaReady) return;
  const sql = getNeonSql();
  await sql`
    CREATE TABLE IF NOT EXISTS ai_stock_grade_cache (
      cache_key text PRIMARY KEY,
      ticker text,
      company_name text NOT NULL,
      payload_json jsonb NOT NULL,
      grade text NOT NULL,
      model text NOT NULL,
      generated_at timestamptz NOT NULL,
      stale_after timestamptz NOT NULL,
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS ai_stock_grade_cache_ticker_idx
    ON ai_stock_grade_cache (ticker)
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS ai_stock_grade_cache_stale_after_idx
    ON ai_stock_grade_cache (stale_after)
  `;
  schemaReady = true;
}

export async function getAiStockGradeCache(cacheKey: string): Promise<AiStockGradeCacheRow | null> {
  await ensureAiStockGradeCacheTable();
  const sql = getNeonSql();
  const rows = await sql`
    SELECT
      cache_key,
      ticker,
      company_name,
      payload_json,
      grade,
      model,
      generated_at::text AS generated_at,
      stale_after::text AS stale_after
    FROM ai_stock_grade_cache
    WHERE cache_key = ${cacheKey}
    LIMIT 1
  `;
  if (!rows.length) return null;
  const row = rows[0] as RawCacheRow;
  return {
    cacheKey: row.cache_key,
    ticker: row.ticker,
    companyName: row.company_name,
    payload: row.payload_json as StockGradeResponse,
    grade: row.grade as StockGradeLabel,
    model: row.model,
    generatedAt: row.generated_at,
    staleAfter: row.stale_after,
  };
}

export async function upsertAiStockGradeCache(input: {
  cacheKey: string;
  ticker: string;
  companyName: string;
  payload: StockGradeResponse;
  grade: StockGradeLabel;
  model: string;
  generatedAtIso: string;
  staleAfterIso: string;
}): Promise<void> {
  await ensureAiStockGradeCacheTable();
  const sql = getNeonSql();
  const cacheKey = input.cacheKey.trim();
  const ticker = normalizeTicker(input.ticker);
  const companyName = input.companyName.trim();
  await sql`
    INSERT INTO ai_stock_grade_cache (
      cache_key,
      ticker,
      company_name,
      payload_json,
      grade,
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
      ${input.grade},
      ${input.model.trim().slice(0, 64)},
      ${input.generatedAtIso}::timestamptz,
      ${input.staleAfterIso}::timestamptz,
      now()
    )
    ON CONFLICT (cache_key) DO UPDATE SET
      ticker = EXCLUDED.ticker,
      company_name = EXCLUDED.company_name,
      payload_json = EXCLUDED.payload_json,
      grade = EXCLUDED.grade,
      model = EXCLUDED.model,
      generated_at = EXCLUDED.generated_at,
      stale_after = EXCLUDED.stale_after,
      updated_at = now()
  `;
}
