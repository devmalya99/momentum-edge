import { getNeonSql } from '@/lib/db/ad-ratio';

let staticItemsSchemaReady = false;

export type StaticItemRow = {
  id: string;
  label: string;
  sortOrder: number;
};

const DEFAULT_STOCK_TAGS: ReadonlyArray<{ id: string; label: string; sortOrder: number }> = [
  { id: 'favourite', label: 'Favourite', sortOrder: 10 },
  { id: 'interesting', label: 'Interesting', sortOrder: 20 },
  { id: 'investment-grade', label: 'Investment Grade', sortOrder: 30 },
  { id: 'swing-trade', label: 'Swing trade', sortOrder: 40 },
  { id: 'no-momentum', label: 'No momentum', sortOrder: 50 },
  { id: 'no-trend', label: 'No trend', sortOrder: 60 },
  { id: 'too-big-to-move', label: 'Too big to move', sortOrder: 70 },
  { id: '1y-top', label: '1y Top', sortOrder: 80 },
  { id: 'add-on-dip', label: 'Add on dip', sortOrder: 90 },
];

export async function ensureStaticItemsTable(): Promise<void> {
  if (staticItemsSchemaReady) return;
  const sql = getNeonSql();
  await sql`
    CREATE TABLE IF NOT EXISTS static_items (
      id text PRIMARY KEY,
      label text NOT NULL,
      sort_order int NOT NULL DEFAULT 0,
      is_active boolean NOT NULL DEFAULT true,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `;
  for (const item of DEFAULT_STOCK_TAGS) {
    await sql`
      INSERT INTO static_items (id, label, sort_order, is_active, updated_at)
      VALUES (${item.id}, ${item.label}, ${item.sortOrder}, true, now())
      ON CONFLICT (id) DO UPDATE SET
        label = EXCLUDED.label,
        sort_order = EXCLUDED.sort_order,
        is_active = true,
        updated_at = now()
    `;
  }
  staticItemsSchemaReady = true;
}

export async function listStaticStockTags(): Promise<StaticItemRow[]> {
  await ensureStaticItemsTable();
  const sql = getNeonSql();
  const rows = await sql`
    SELECT id, label, sort_order
    FROM static_items
    WHERE is_active = true
    ORDER BY sort_order ASC, label ASC
  `;
  return (rows as Array<{ id: string; label: string; sort_order: number }>).map((row) => ({
    id: row.id,
    label: row.label,
    sortOrder: row.sort_order,
  }));
}
