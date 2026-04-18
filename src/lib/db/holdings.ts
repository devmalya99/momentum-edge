import { getNeonSql } from '@/lib/db/ad-ratio';
import { ensureUsersTable } from '@/lib/db/users';

export type UserHoldingInput = {
  symbol: string;
  quantity: number;
  averagePrice: number;
  previousClosePrice: number;
  /** Portfolio / trade-type bucket (Kanban column name). */
  tradeType?: string | null;
};

export type UserHoldingRow = {
  symbol: string;
  quantity: number;
  average_price: number;
  previous_close_price: number;
  uploaded_at: string;
  trade_type: string | null;
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
  // Legacy DBs may still have integer/numeric types from earlier schemas.
  await sql`
    ALTER TABLE user_holdings
    ALTER COLUMN quantity TYPE double precision USING quantity::double precision,
    ALTER COLUMN average_price TYPE double precision USING average_price::double precision,
    ALTER COLUMN previous_close_price TYPE double precision USING previous_close_price::double precision
  `;
  await sql`
    ALTER TABLE user_holdings
    ADD COLUMN IF NOT EXISTS trade_type text
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
      uploaded_at::text AS uploaded_at,
      trade_type
    FROM user_holdings
    WHERE user_id = ${userId}
    ORDER BY symbol ASC
  `;
  return rows as UserHoldingRow[];
}

export async function replaceUserHoldings(userId: string, holdings: UserHoldingInput[]): Promise<void> {
  await ensureUserHoldingsTable();
  const sql = getNeonSql();
  const priorRows = await sql`
    SELECT symbol, trade_type
    FROM user_holdings
    WHERE user_id = ${userId}
  `;
  const preservedTypeBySymbol = new Map<string, string | null>();
  for (const row of priorRows as { symbol: string; trade_type: string | null }[]) {
    preservedTypeBySymbol.set(String(row.symbol).trim().toUpperCase(), row.trade_type);
  }

  await sql`DELETE FROM user_holdings WHERE user_id = ${userId}`;
  for (const holding of holdings) {
    const sym = holding.symbol.trim().toUpperCase();
    const tradeType =
      holding.tradeType !== undefined && holding.tradeType !== null && String(holding.tradeType).trim()
        ? String(holding.tradeType).trim()
        : preservedTypeBySymbol.get(sym) ?? null;
    await sql`
      INSERT INTO user_holdings (
        user_id,
        symbol,
        quantity,
        average_price,
        previous_close_price,
        trade_type
      )
      VALUES (
        ${userId},
        ${sym},
        ${holding.quantity},
        ${holding.averagePrice},
        ${holding.previousClosePrice},
        ${tradeType}
      )
    `;
  }
}

/**
 * Updates trade_type for one holding row. Returns whether a row was updated.
 */
export async function updateUserHoldingTradeType(
  userId: string,
  symbol: string,
  tradeType: string | null,
): Promise<boolean> {
  await ensureUserHoldingsTable();
  const sql = getNeonSql();
  const sym = symbol.trim().toUpperCase();
  const updated = await sql`
    UPDATE user_holdings
    SET trade_type = ${tradeType}
    WHERE user_id = ${userId} AND symbol = ${sym}
    RETURNING symbol
  `;
  return Array.isArray(updated) && updated.length > 0;
}
