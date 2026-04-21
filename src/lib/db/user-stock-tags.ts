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
  userStockTagsSchemaReady = true;
}

export async function listUserStockTags(userId: string, tickers: string[]): Promise<UserStockTagRow[]> {
  await ensureUserStockTagsTable();
  const normalizedTickers = Array.from(
    new Set(tickers.map((ticker) => ticker.trim().toUpperCase()).filter(Boolean)),
  );
  if (normalizedTickers.length === 0) return [];
  const sql = getNeonSql();
  const rows = await sql`
    SELECT ticker, tag_id
    FROM user_stock_tags
    WHERE user_id = ${userId}
      AND ticker = ANY(${normalizedTickers}::text[])
  `;
  return (rows as Array<{ ticker: string; tag_id: string }>).map((row) => ({
    ticker: row.ticker,
    tagId: row.tag_id,
  }));
}

export async function replaceUserStockTags(userId: string, ticker: string, tagIds: string[]): Promise<void> {
  await ensureUserStockTagsTable();
  const sql = getNeonSql();
  const normalizedTicker = ticker.trim().toUpperCase();
  const normalizedTagIds = Array.from(new Set(tagIds.map((id) => id.trim()).filter(Boolean)));
  await sql`
    DELETE FROM user_stock_tags
    WHERE user_id = ${userId} AND ticker = ${normalizedTicker}
  `;
  for (const tagId of normalizedTagIds) {
    await sql`
      INSERT INTO user_stock_tags (user_id, ticker, tag_id)
      VALUES (${userId}, ${normalizedTicker}, ${tagId})
      ON CONFLICT (user_id, ticker, tag_id) DO NOTHING
    `;
  }
}
