import type { BusinessAnalysisResponse } from '@/lib/ai/business-analysis';
import { getNeonSql } from '@/lib/db/ad-ratio';

let schemaReady = false;

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
  model: string;
  generated_at: string;
  stale_after: string;
};

export type AiBusinessAnalysisCacheRow = {
  cacheKey: string;
  ticker: string | null;
  companyName: string;
  payload: BusinessAnalysisResponse;
  model: string;
  generatedAt: string;
  staleAfter: string;
};

export async function ensureAiBusinessAnalysisCacheTable(): Promise<void> {
  if (schemaReady) return;
  const sql = getNeonSql();
  await sql`
    CREATE TABLE IF NOT EXISTS ai_business_analysis_cache (
      cache_key text PRIMARY KEY,
      ticker text,
      company_name text NOT NULL,
      payload_json jsonb NOT NULL,
      category text NOT NULL DEFAULT 'N/A',
      composite_score integer NOT NULL DEFAULT 0,
      direction text NOT NULL DEFAULT 'flat',
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
      'N/A',
      0,
      'flat',
      '[]'::jsonb,
      ${input.model.trim().slice(0, 64)},
      ${input.generatedAtIso}::timestamptz,
      ${input.staleAfterIso}::timestamptz,
      now()
    )
    ON CONFLICT (cache_key) DO UPDATE SET
      ticker = EXCLUDED.ticker,
      company_name = EXCLUDED.company_name,
      payload_json = EXCLUDED.payload_json,
      model = EXCLUDED.model,
      generated_at = EXCLUDED.generated_at,
      stale_after = EXCLUDED.stale_after,
      updated_at = now()
  `;
}
