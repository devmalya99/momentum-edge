import { neon, type NeonQueryFunction } from '@neondatabase/serverless';

let sqlSingleton: NeonQueryFunction<false, false> | null = null;

export function getNeonSql(): NeonQueryFunction<false, false> {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) {
    throw new Error('DATABASE_URL is not set');
  }
  if (!sqlSingleton) {
    sqlSingleton = neon(url);
  }
  return sqlSingleton;
}

let schemaReady = false;

/** Creates `ad_ratio_daily` on first use (Neon SQL editor is not required). */
export async function ensureAdRatioDailyTable(): Promise<void> {
  if (schemaReady) return;
  const sql = getNeonSql();
  await sql`
    CREATE TABLE IF NOT EXISTS ad_ratio_daily (
      trade_date date PRIMARY KEY,
      advances integer NOT NULL,
      declines integer NOT NULL,
      unchange integer,
      total integer,
      ad_ratio double precision,
      nse_timestamp timestamptz,
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `;
  schemaReady = true;
}

export type AdRatioDailyInsert = {
  trade_date: string;
  advances: number;
  declines: number;
  unchange: number | null;
  total: number | null;
  ad_ratio: number | null;
  nse_timestamp: string | null;
};

export async function upsertAdRatioDaily(row: AdRatioDailyInsert): Promise<void> {
  const sql = getNeonSql();
  await sql`
    INSERT INTO ad_ratio_daily (trade_date, advances, declines, unchange, total, ad_ratio, nse_timestamp)
    VALUES (
      ${row.trade_date}::date,
      ${row.advances},
      ${row.declines},
      ${row.unchange},
      ${row.total},
      ${row.ad_ratio},
      ${row.nse_timestamp}
    )
    ON CONFLICT (trade_date) DO UPDATE SET
      advances = EXCLUDED.advances,
      declines = EXCLUDED.declines,
      unchange = EXCLUDED.unchange,
      total = EXCLUDED.total,
      ad_ratio = EXCLUDED.ad_ratio,
      nse_timestamp = EXCLUDED.nse_timestamp,
      updated_at = now()
  `;
}

export type AdRatioDailyRow = {
  trade_date: string;
  ad_ratio: number | null;
  advances: number;
  declines: number;
};

export async function getAdRatioDailyByDate(tradeDate: string): Promise<AdRatioDailyRow | null> {
  await ensureAdRatioDailyTable();
  const sql = getNeonSql();
  const rows = await sql`
    SELECT
      trade_date::text AS trade_date,
      ad_ratio,
      advances,
      declines
    FROM ad_ratio_daily
    WHERE trade_date = ${tradeDate}::date
    LIMIT 1
  `;

  if (!rows.length) return null;
  return rows[0] as AdRatioDailyRow;
}

/** Inclusive date bounds as `YYYY-MM-DD`. */
export async function listAdRatioDailyBetween(
  startInclusive: string,
  endInclusive: string,
): Promise<AdRatioDailyRow[]> {
  await ensureAdRatioDailyTable();
  const sql = getNeonSql();
  const rows = await sql`
    SELECT
      trade_date::text AS trade_date,
      ad_ratio,
      advances,
      declines
    FROM ad_ratio_daily
    WHERE trade_date >= ${startInclusive}::date
      AND trade_date <= ${endInclusive}::date
    ORDER BY trade_date ASC
  `;
  return rows as AdRatioDailyRow[];
}
