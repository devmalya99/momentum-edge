import { getNeonSql } from '@/lib/db/ad-ratio';
import type { StockOverviewAnalysis } from '@/lib/ai/stock-overview';

let schemaReady = false;

export async function ensureAiStockOverviewCacheTable(): Promise<void> {
  if (schemaReady) return;
  const sql = getNeonSql();
  await sql`
    CREATE TABLE IF NOT EXISTS ai_stock_overview_cache (
      ticker text PRIMARY KEY,
      company_name text NOT NULL,
      analysis_json jsonb NOT NULL,
      objective_score integer NOT NULL,
      model text NOT NULL,
      generated_at timestamptz NOT NULL,
      stale_after timestamptz NOT NULL,
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS ai_stock_overview_cache_stale_after_idx
    ON ai_stock_overview_cache (stale_after)
  `;
  schemaReady = true;
}

export type AiStockOverviewCacheRow = {
  ticker: string;
  companyName: string;
  analysis: StockOverviewAnalysis;
  objectiveScore: number;
  model: string;
  generatedAt: string;
  staleAfter: string;
};

type RawDbRow = {
  ticker: string;
  company_name: string;
  analysis_json: unknown;
  objective_score: number;
  model: string;
  generated_at: string;
  stale_after: string;
};

export async function getAiStockOverviewCache(
  ticker: string,
): Promise<AiStockOverviewCacheRow | null> {
  await ensureAiStockOverviewCacheTable();
  const sql = getNeonSql();
  const t = ticker.trim().toUpperCase();
  const rows = await sql`
    SELECT
      ticker,
      company_name,
      analysis_json,
      objective_score,
      model,
      generated_at::text AS generated_at,
      stale_after::text AS stale_after
    FROM ai_stock_overview_cache
    WHERE ticker = ${t}
    LIMIT 1
  `;
  if (!rows.length) return null;
  const row = rows[0] as RawDbRow;
  return {
    ticker: row.ticker,
    companyName: row.company_name,
    analysis: row.analysis_json as StockOverviewAnalysis,
    objectiveScore: row.objective_score,
    model: row.model,
    generatedAt: row.generated_at,
    staleAfter: row.stale_after,
  };
}

export async function upsertAiStockOverviewCache(input: {
  ticker: string;
  companyName: string;
  analysis: StockOverviewAnalysis;
  model: string;
  generatedAtIso: string;
  staleAfterIso: string;
}): Promise<void> {
  await ensureAiStockOverviewCacheTable();
  const sql = getNeonSql();
  const ticker = input.ticker.trim().toUpperCase();
  const companyName = input.companyName.trim().slice(0, 256) || ticker;
  await sql`
    INSERT INTO ai_stock_overview_cache (
      ticker,
      company_name,
      analysis_json,
      objective_score,
      model,
      generated_at,
      stale_after,
      updated_at
    )
    VALUES (
      ${ticker},
      ${companyName},
      ${JSON.stringify(input.analysis)}::jsonb,
      ${Math.round(input.analysis.score.objectiveScore)},
      ${input.model.trim().slice(0, 64)},
      ${input.generatedAtIso}::timestamptz,
      ${input.staleAfterIso}::timestamptz,
      now()
    )
    ON CONFLICT (ticker) DO UPDATE SET
      company_name = EXCLUDED.company_name,
      analysis_json = EXCLUDED.analysis_json,
      objective_score = EXCLUDED.objective_score,
      model = EXCLUDED.model,
      generated_at = EXCLUDED.generated_at,
      stale_after = EXCLUDED.stale_after,
      updated_at = now()
  `;
}
