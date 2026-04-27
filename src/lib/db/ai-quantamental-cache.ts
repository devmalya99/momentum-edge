import type { QuantamentalScoredResult } from '@/lib/validations/stock-schema';
import { getNeonSql } from '@/lib/db/ad-ratio';

let schemaReady = false;

export const AI_QUANTAMENTAL_STALE_MS = 7 * 24 * 60 * 60 * 1000;

function normalizeTicker(ticker: string | null | undefined): string | null {
  if (!ticker) return null;
  const raw = ticker.trim().toUpperCase();
  if (!raw) return null;
  return raw.replace(/^(NSE:|BSE:)/, '');
}

type RawCacheRow = {
  cache_key: string;
  ticker: string | null;
  payload_text: string;
  scored_json: unknown;
  total_score: number;
  model: string;
  generated_at: string;
  stale_after: string;
};

export type AiQuantamentalCacheRow = {
  cacheKey: string;
  ticker: string | null;
  payloadText: string;
  scored: QuantamentalScoredResult;
  totalScore: number;
  model: string;
  generatedAt: string;
  staleAfter: string;
};

export async function ensureAiQuantamentalCacheTable(): Promise<void> {
  if (schemaReady) return;
  const sql = getNeonSql();
  await sql`
    CREATE TABLE IF NOT EXISTS ai_quantamental_cache (
      cache_key text PRIMARY KEY,
      ticker text,
      payload_text text NOT NULL,
      scored_json jsonb NOT NULL,
      total_score integer NOT NULL,
      model text NOT NULL,
      generated_at timestamptz NOT NULL,
      stale_after timestamptz NOT NULL,
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `;
  await sql`
    ALTER TABLE ai_quantamental_cache
    ADD COLUMN IF NOT EXISTS ticker text
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS ai_quantamental_cache_stale_after_idx
    ON ai_quantamental_cache (stale_after)
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS ai_quantamental_cache_ticker_idx
    ON ai_quantamental_cache (ticker)
  `;
  schemaReady = true;
}

export async function getAiQuantamentalCache(cacheKey: string): Promise<AiQuantamentalCacheRow | null> {
  await ensureAiQuantamentalCacheTable();
  const sql = getNeonSql();
  const rows = await sql`
    SELECT
      cache_key,
      ticker,
      payload_text,
      scored_json,
      total_score,
      model,
      generated_at::text AS generated_at,
      stale_after::text AS stale_after
    FROM ai_quantamental_cache
    WHERE cache_key = ${cacheKey}
    LIMIT 1
  `;
  if (!rows.length) return null;
  const row = rows[0] as RawCacheRow;
  return {
    cacheKey: row.cache_key,
    ticker: row.ticker,
    payloadText: row.payload_text,
    scored: row.scored_json as QuantamentalScoredResult,
    totalScore: row.total_score,
    model: row.model,
    generatedAt: row.generated_at,
    staleAfter: row.stale_after,
  };
}

export async function upsertAiQuantamentalCache(input: {
  cacheKey: string;
  ticker: string | null;
  payloadText: string;
  scored: QuantamentalScoredResult;
  model: string;
  generatedAtIso: string;
  staleAfterIso: string;
}): Promise<void> {
  await ensureAiQuantamentalCacheTable();
  const sql = getNeonSql();
  const cacheKey = input.cacheKey.trim();
  const ticker = normalizeTicker(input.ticker);
  const payloadText = input.payloadText.trim();
  await sql`
    INSERT INTO ai_quantamental_cache (
      cache_key,
      ticker,
      payload_text,
      scored_json,
      total_score,
      model,
      generated_at,
      stale_after,
      updated_at
    )
    VALUES (
      ${cacheKey},
      ${ticker},
      ${payloadText},
      ${JSON.stringify(input.scored)}::jsonb,
      ${Math.round(input.scored.scores.total)},
      ${input.model.trim().slice(0, 64)},
      ${input.generatedAtIso}::timestamptz,
      ${input.staleAfterIso}::timestamptz,
      now()
    )
    ON CONFLICT (cache_key) DO UPDATE SET
      ticker = EXCLUDED.ticker,
      payload_text = EXCLUDED.payload_text,
      scored_json = EXCLUDED.scored_json,
      total_score = EXCLUDED.total_score,
      model = EXCLUDED.model,
      generated_at = EXCLUDED.generated_at,
      stale_after = EXCLUDED.stale_after,
      updated_at = now()
  `;
}

export type AiQuantamentalScoreRow = {
  ticker: string;
  totalScore: number;
  staleAfter: string;
};

type RawScoreRow = {
  ticker: string;
  total_score: number;
  stale_after: string;
};

export async function listAiQuantamentalScores(tickers: string[]): Promise<AiQuantamentalScoreRow[]> {
  await ensureAiQuantamentalCacheTable();
  const normalized = Array.from(
    new Set(
      tickers
        .map((ticker) => normalizeTicker(ticker))
        .filter((ticker): ticker is string => Boolean(ticker && ticker.length > 0)),
    ),
  );
  if (normalized.length === 0) return [];
  const sql = getNeonSql();
  const rows = await sql`
    SELECT
      ticker,
      total_score,
      stale_after::text AS stale_after
    FROM ai_quantamental_cache
    WHERE ticker = ANY(${normalized}::text[])
      AND ticker IS NOT NULL
  `;
  return (rows as RawScoreRow[]).map((row) => ({
    ticker: row.ticker,
    totalScore: row.total_score,
    staleAfter: row.stale_after,
  }));
}
