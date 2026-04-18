import { getNeonSql } from '@/lib/db/ad-ratio';
import { ensureUsersTable } from '@/lib/db/users';
import { DEFAULT_WATCHLIST_LIST_ID } from '@/lib/watchlist-defaults';

export type WatchlistKind = 'equity' | 'index';

export type UserWatchlistInput = {
  id: string;
  listId: string;
  kind: WatchlistKind;
  symbol: string;
  companyName: string;
  addedAt: number;
};

export type UserWatchlistRow = {
  id: string;
  list_id: string;
  kind: WatchlistKind;
  symbol: string;
  company_name: string;
  added_at: number;
};

export type UserWatchlistListInput = {
  id: string;
  name: string;
  createdAt: number;
  sortOrder: number;
};

export type UserWatchlistListRow = {
  id: string;
  name: string;
  created_at: number;
  sort_order: number;
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

  await sql`
    ALTER TABLE user_watchlist
    ADD COLUMN IF NOT EXISTS list_id text NOT NULL DEFAULT 'default'
  `;
  await sql`
    ALTER TABLE user_watchlist
    ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'equity'
  `;
}

export async function ensureUserWatchlistListTable(): Promise<void> {
  await ensureUsersTable();
  const sql = getNeonSql();
  await sql`
    CREATE TABLE IF NOT EXISTS user_watchlist_list (
      user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      id text NOT NULL,
      name text NOT NULL,
      sort_order int NOT NULL DEFAULT 0,
      created_at bigint NOT NULL,
      PRIMARY KEY (user_id, id)
    )
  `;
}

export async function listUserWatchlistLists(userId: string): Promise<UserWatchlistListRow[]> {
  await ensureUserWatchlistListTable();
  const sql = getNeonSql();
  const rows = await sql`
    SELECT id, name, sort_order, created_at
    FROM user_watchlist_list
    WHERE user_id = ${userId}
    ORDER BY sort_order ASC, created_at ASC
  `;
  return rows as UserWatchlistListRow[];
}

export async function insertUserWatchlistList(userId: string, row: UserWatchlistListInput): Promise<void> {
  await ensureUserWatchlistListTable();
  const sql = getNeonSql();
  await sql`
    INSERT INTO user_watchlist_list (user_id, id, name, sort_order, created_at)
    VALUES (${userId}, ${row.id}, ${row.name}, ${row.sortOrder}, ${row.createdAt})
    ON CONFLICT (user_id, id) DO UPDATE SET
      name = EXCLUDED.name,
      sort_order = EXCLUDED.sort_order
  `;
}

export async function updateUserWatchlistListName(
  userId: string,
  listId: string,
  name: string,
): Promise<void> {
  await ensureUserWatchlistListTable();
  const sql = getNeonSql();
  await sql`
    UPDATE user_watchlist_list
    SET name = ${name}
    WHERE user_id = ${userId} AND id = ${listId}
  `;
}

export async function deleteUserWatchlistItemsForList(userId: string, listId: string): Promise<void> {
  await ensureUserWatchlistTable();
  const sql = getNeonSql();
  await sql`
    DELETE FROM user_watchlist
    WHERE user_id = ${userId} AND list_id = ${listId}
  `;
}

export async function deleteUserWatchlistList(userId: string, listId: string): Promise<void> {
  await ensureUserWatchlistListTable();
  const sql = getNeonSql();
  await sql`
    DELETE FROM user_watchlist_list
    WHERE user_id = ${userId} AND id = ${listId}
  `;
}

export async function seedDefaultWatchlistListIfEmpty(userId: string): Promise<void> {
  await ensureUserWatchlistListTable();
  const rows = await listUserWatchlistLists(userId);
  if (rows.length > 0) return;
  await insertUserWatchlistList(userId, {
    id: DEFAULT_WATCHLIST_LIST_ID,
    name: 'Main',
    createdAt: Date.now(),
    sortOrder: 0,
  });
}

export async function listUserWatchlist(userId: string): Promise<UserWatchlistRow[]> {
  await ensureUserWatchlistTable();
  const sql = getNeonSql();
  const rows = await sql`
    SELECT id, list_id, kind, symbol, company_name, added_at
    FROM user_watchlist
    WHERE user_id = ${userId}
    ORDER BY added_at DESC
  `;
  return rows as UserWatchlistRow[];
}

export async function upsertUserWatchlistItem(userId: string, item: UserWatchlistInput): Promise<void> {
  await ensureUserWatchlistTable();
  const sql = getNeonSql();
  await sql`
    INSERT INTO user_watchlist (user_id, id, list_id, kind, symbol, company_name, added_at)
    VALUES (${userId}, ${item.id}, ${item.listId}, ${item.kind}, ${item.symbol}, ${item.companyName}, ${item.addedAt})
    ON CONFLICT (user_id, id)
    DO UPDATE SET
      list_id = EXCLUDED.list_id,
      kind = EXCLUDED.kind,
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
