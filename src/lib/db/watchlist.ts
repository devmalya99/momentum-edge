import { getNeonSql } from '@/lib/db/ad-ratio';
import { ensureUsersTable } from '@/lib/db/users';

export type UserWatchlistInput = {
  id: string;
  symbol: string;
  companyName: string;
  addedAt: number;
};

export type UserWatchlistRow = {
  id: string;
  symbol: string;
  company_name: string;
  added_at: number;
};

/**
 * Keep this call cheap and deterministic: always CREATE IF NOT EXISTS.
 */
export async function ensureUserWatchlistTable(): Promise<void> {
  await ensureUsersTable();
  const sql = getNeonSql();
  await sql`
    CREATE TABLE IF NOT EXISTS user_watchlist (
      user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      id text NOT NULL,
      symbol text NOT NULL,
      company_name text NOT NULL,
      added_at bigint NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY (user_id, id)
    )
  `;
}

export async function listUserWatchlist(userId: string): Promise<UserWatchlistRow[]> {
  await ensureUserWatchlistTable();
  const sql = getNeonSql();
  const rows = await sql`
    SELECT id, symbol, company_name, added_at
    FROM user_watchlist
    WHERE user_id = ${userId}
    ORDER BY added_at DESC
  `;
  return rows as UserWatchlistRow[];
}

export async function upsertUserWatchlistItem(
  userId: string,
  item: UserWatchlistInput,
): Promise<void> {
  await ensureUserWatchlistTable();
  const sql = getNeonSql();
  await sql`
    INSERT INTO user_watchlist (user_id, id, symbol, company_name, added_at)
    VALUES (${userId}, ${item.id}, ${item.symbol}, ${item.companyName}, ${item.addedAt})
    ON CONFLICT (user_id, id)
    DO UPDATE SET
      symbol = EXCLUDED.symbol,
      company_name = EXCLUDED.company_name,
      added_at = EXCLUDED.added_at
  `;
}

export async function deleteUserWatchlistItem(userId: string, id: string): Promise<void> {
  await ensureUserWatchlistTable();
  const sql = getNeonSql();
  await sql`
    DELETE FROM user_watchlist
    WHERE user_id = ${userId} AND id = ${id}
  `;
}
