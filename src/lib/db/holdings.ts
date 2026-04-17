import { getNeonSql } from '@/lib/db/ad-ratio';
import { ensureUsersTable } from '@/lib/db/users';

export type UserHoldingInput = {
  symbol: string;
  quantity: number;
  averagePrice: number;
  previousClosePrice: number;
};

export type UserHoldingRow = {
  symbol: string;
  quantity: number;
  average_price: number;
  previous_close_price: number;
  uploaded_at: string;
};

/**
 * Always runs CREATE IF NOT EXISTS (cheap on Postgres). Avoids a stale in-memory
 * "schema ready" flag if the table was dropped in Neon or never created on first deploy.
 */
export async function ensureUserHoldingsTable(): Promise<void> {
  await ensureUsersTable();
  const sql = getNeonSql();
  await sql`
    CREATE TABLE IF NOT EXISTS user_holdings (
      user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      symbol text NOT NULL,
      quantity double precision NOT NULL,
      average_price double precision NOT NULL,
      previous_close_price double precision NOT NULL,
      uploaded_at timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY (user_id, symbol)
    )
  `;
}

export async function listUserHoldings(userId: string): Promise<UserHoldingRow[]> {
  await ensureUserHoldingsTable();
  const sql = getNeonSql();
  const rows = await sql`
    SELECT
      symbol,
      quantity,
      average_price,
      previous_close_price,
      uploaded_at::text AS uploaded_at
    FROM user_holdings
    WHERE user_id = ${userId}
    ORDER BY symbol ASC
  `;
  return rows as UserHoldingRow[];
}

export async function replaceUserHoldings(userId: string, holdings: UserHoldingInput[]): Promise<void> {
  await ensureUserHoldingsTable();
  const sql = getNeonSql();
  await sql`DELETE FROM user_holdings WHERE user_id = ${userId}`;
  for (const holding of holdings) {
    await sql`
      INSERT INTO user_holdings (
        user_id,
        symbol,
        quantity,
        average_price,
        previous_close_price
      )
      VALUES (
        ${userId},
        ${holding.symbol},
        ${holding.quantity},
        ${holding.averagePrice},
        ${holding.previousClosePrice}
      )
    `;
  }
}
