import { getNeonSql } from '@/lib/db/ad-ratio';
import { ensureUsersTable } from '@/lib/db/users';

let technicalChartScoreSchemaReady = false;

export type UserTechnicalChartScoreRow = {
  ticker: string;
  score: number;
  updatedAt: string;
};

export async function ensureUserTechnicalChartScoreTable(): Promise<void> {
  if (technicalChartScoreSchemaReady) return;
  await ensureUsersTable();
  const sql = getNeonSql();
  await sql`
    CREATE TABLE IF NOT EXISTS user_technical_chart_score (
      user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      ticker text NOT NULL,
      score smallint NOT NULL CHECK (score >= 0 AND score <= 10),
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY (user_id, ticker)
    )
  `;
  technicalChartScoreSchemaReady = true;
}

export async function upsertUserTechnicalChartScore(
  userId: string,
  ticker: string,
  score: number,
): Promise<void> {
  await ensureUserTechnicalChartScoreTable();
  const sql = getNeonSql();
  const normalizedTicker = ticker.trim().toUpperCase();
  const normalizedScore = Math.max(0, Math.min(10, Math.round(score)));
  await sql`
    INSERT INTO user_technical_chart_score (
      user_id,
      ticker,
      score,
      updated_at
    )
    VALUES (
      ${userId},
      ${normalizedTicker},
      ${normalizedScore},
      now()
    )
    ON CONFLICT (user_id, ticker) DO UPDATE SET
      score = EXCLUDED.score,
      updated_at = now()
  `;
}

export async function listUserTechnicalChartScores(
  userId: string,
  tickers: string[],
): Promise<UserTechnicalChartScoreRow[]> {
  await ensureUserTechnicalChartScoreTable();
  const normalized = Array.from(
    new Set(tickers.map((ticker) => ticker.trim().toUpperCase()).filter(Boolean)),
  );
  if (normalized.length === 0) return [];
  const sql = getNeonSql();
  const rows = await sql`
    SELECT
      ticker,
      score,
      updated_at::text AS updated_at
    FROM user_technical_chart_score
    WHERE user_id = ${userId} AND ticker = ANY(${normalized}::text[])
  `;
  return (rows as Array<{ ticker: string; score: number; updated_at: string }>).map((row) => ({
    ticker: row.ticker,
    score: row.score,
    updatedAt: row.updated_at,
  }));
}
