import { getNeonSql } from '@/lib/db/ad-ratio';
import { ensureUsersTable } from '@/lib/db/users';
import { ensureStaticItemsTable } from '@/lib/db/static-items';

let userStockTagsSchemaReady = false;

export type UserStockTagRow = {
  ticker: string;
  tagId: string;
};

export async function ensureUserStockTagsTable(): Promise<void> {
  if (userStockTagsSchemaReady) return;
  await ensureUsersTable();
  await ensureStaticItemsTable();
  const sql = getNeonSql();
  await sql`
    CREATE TABLE IF NOT EXISTS user_stock_tags (
      user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      ticker text NOT NULL,
      tag_id text NOT NULL REFERENCES static_items(id) ON DELETE RESTRICT,
      created_at timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY (user_id, ticker, tag_id)
    )
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS user_stock_tags_ticker_idx
    ON user_stock_tags (user_id, ticker)
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS stock_tags (
      ticker text PRIMARY KEY,
      tag_id text NOT NULL REFERENCES static_items(id) ON DELETE RESTRICT,
      updated_by text REFERENCES users(id) ON DELETE SET NULL,
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `;
  userStockTagsSchemaReady = true;
}

export async function listStockTags(tickers: string[]): Promise<UserStockTagRow[]> {
  await ensureUserStockTagsTable();
  const normalizedTickers = Array.from(
    new Set(tickers.map((ticker) => ticker.trim().toUpperCase()).filter(Boolean)),
  );
  if (normalizedTickers.length === 0) return [];
  const sql = getNeonSql();
  const rows = await sql`
    SELECT ticker, tag_id
    FROM stock_tags
    WHERE ticker = ANY(${normalizedTickers}::text[])
  `;
  return (rows as Array<{ ticker: string; tag_id: string }>).map((row) => ({
    ticker: row.ticker,
    tagId: row.tag_id,
  }));
}

export async function replaceStockTag(
  updatedByUserId: string,
  ticker: string,
  tagId: string | null,
): Promise<void> {
  await ensureUserStockTagsTable();
  const sql = getNeonSql();
  const normalizedTicker = ticker.trim().toUpperCase();
  const normalizedTagId = tagId?.trim() ?? '';
  if (!normalizedTagId) {
    await sql`
      DELETE FROM stock_tags
      WHERE ticker = ${normalizedTicker}
    `;
    return;
  }
  await sql`
    INSERT INTO stock_tags (ticker, tag_id, updated_by, updated_at)
    VALUES (${normalizedTicker}, ${normalizedTagId}, ${updatedByUserId}, now())
    ON CONFLICT (ticker) DO UPDATE SET
      tag_id = EXCLUDED.tag_id,
      updated_by = EXCLUDED.updated_by,
      updated_at = now()
  `;
}
