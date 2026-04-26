/**
 * One-time backfill: April 2026 NSE advance/decline sessions into Neon `ad_ratio_daily`.
 *
 * Run: npx tsx scripts/seed-april-2026-ad-ratio.ts
 * Requires DATABASE_URL (e.g. from .env.local).
 */

import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { ensureAdRatioDailyTable, upsertAdRatioDaily } from '../src/lib/db/ad-ratio';

function loadDatabaseUrlFromEnvLocal(): void {
  const envPath = resolve(process.cwd(), '.env.local');
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (key === 'DATABASE_URL' && val) process.env.DATABASE_URL = val;
  }
}

/** Manual breadth table (NSE India); unchange not recorded — stored as 0. */
const ROWS: { trade_date: string; advances: number; declines: number }[] = [
  { trade_date: '2026-04-01', advances: 4264, declines: 656 },
  { trade_date: '2026-04-02', advances: 3041, declines: 1795 },
  { trade_date: '2026-04-06', advances: 3709, declines: 1329 },
  { trade_date: '2026-04-07', advances: 3094, declines: 1741 },
  { trade_date: '2026-04-08', advances: 4254, declines: 697 },
  { trade_date: '2026-04-09', advances: 2517, declines: 2324 },
  { trade_date: '2026-04-10', advances: 3777, declines: 1117 },
];

async function main(): Promise<void> {
  loadDatabaseUrlFromEnvLocal();
  if (!process.env.DATABASE_URL?.trim()) {
    console.error('DATABASE_URL is not set. Add it to .env.local or the environment.');
    process.exit(1);
  }

  await ensureAdRatioDailyTable();

  for (const row of ROWS) {
    const { advances, declines } = row;
    const ad_ratio = declines > 0 ? advances / declines : null;
    const total = advances + declines;
    await upsertAdRatioDaily({
      trade_date: row.trade_date,
      advances,
      declines,
      unchange: 0,
      total,
      ad_ratio,
      nse_timestamp: `${row.trade_date}T09:15:00+05:30`,
    });
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
