import { getNeonSql } from '@/lib/db/ad-ratio';
import type { AthScannerParsedRow } from '@/lib/screener-ath-xlsx';

let schemaReady = false;

export async function ensureAthScannerGlobalTable(): Promise<void> {
  if (schemaReady) return;
  const sql = getNeonSql();
  await sql`
    CREATE TABLE IF NOT EXISTS ath_scanner_global (
      id serial PRIMARY KEY,
      sort_order integer NOT NULL,
      ticker text NOT NULL,
      company_name text NOT NULL,
      screener_url text NOT NULL,
      tv_symbol text NOT NULL,
      source_file_name text NOT NULL,
      uploaded_at timestamptz NOT NULL DEFAULT now()
    )
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS ath_scanner_global_sort_idx ON ath_scanner_global (sort_order)
  `;
  schemaReady = true;
}

export type AthScannerGlobalSnapshot = {
  rows: AthScannerParsedRow[];
  sourceFileName: string | null;
  updatedAt: string | null;
};

export async function listAthScannerGlobal(): Promise<AthScannerGlobalSnapshot> {
  await ensureAthScannerGlobalTable();
  const sql = getNeonSql();
  const rows = await sql`
    SELECT
      sort_order,
      ticker,
      company_name,
      screener_url,
      tv_symbol,
      source_file_name,
      uploaded_at::text AS uploaded_at
    FROM ath_scanner_global
    ORDER BY sort_order ASC
  `;
  type DbRow = {
    sort_order: number;
    ticker: string;
    company_name: string;
    screener_url: string;
    tv_symbol: string;
    source_file_name: string;
    uploaded_at: string;
  };
  const list = rows as DbRow[];
  if (list.length === 0) {
    return { rows: [], sourceFileName: null, updatedAt: null };
  }
  const first = list[0];
  const seenTickers = new Set<string>();
  const deduped: AthScannerParsedRow[] = [];
  for (const r of list) {
    const t = r.ticker.trim().toUpperCase();
    if (seenTickers.has(t)) continue;
    seenTickers.add(t);
    deduped.push({
      ticker: t,
      tvSymbol: r.tv_symbol,
      companyName: r.company_name,
      screenerUrl: r.screener_url,
    });
  }
  return {
    rows: deduped,
    sourceFileName: first.source_file_name,
    updatedAt: first.uploaded_at,
  };
}

export async function replaceAthScannerGlobal(
  rows: AthScannerParsedRow[],
  sourceFileName: string,
): Promise<void> {
  await ensureAthScannerGlobalTable();
  const sql = getNeonSql();
  const safeName = sourceFileName.trim().slice(0, 512) || 'upload.xlsx';
  const uploadedAt = new Date().toISOString();

  await sql`DELETE FROM ath_scanner_global`;

  const seen = new Set<string>();
  const uniqueRows: AthScannerParsedRow[] = [];
  for (const r of rows) {
    const t = r.ticker.trim().toUpperCase();
    if (!t || seen.has(t)) continue;
    seen.add(t);
    uniqueRows.push(r);
  }

  for (let i = 0; i < uniqueRows.length; i += 1) {
    const r = uniqueRows[i];
    await sql`
      INSERT INTO ath_scanner_global (
        sort_order,
        ticker,
        company_name,
        screener_url,
        tv_symbol,
        source_file_name,
        uploaded_at
      )
      VALUES (
        ${i},
        ${r.ticker.trim().toUpperCase()},
        ${r.companyName.trim().slice(0, 512)},
        ${r.screenerUrl.trim().slice(0, 2048)},
        ${r.tvSymbol.trim().slice(0, 64)},
        ${safeName},
        ${uploadedAt}::timestamptz
      )
    `;
  }
}
