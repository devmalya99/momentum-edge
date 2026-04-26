import { getNeonSql } from '@/lib/db/ad-ratio';

let staticItemsSchemaReady = false;

export type StaticItemRow = {
  id: string;
  label: string;
  sortOrder: number;
};

export const DEFAULT_STOCK_TAG_IDS = {
  NO_TREND: 'no-trend',
  SHORT_TREND: 'short-trend',
  LONG_TREND: 'long-trend',
  BASE_BUILDING: 'base-building',
} as const;

const SYSTEM_STOCK_TAG_ID_SET = new Set<string>(Object.values(DEFAULT_STOCK_TAG_IDS));

const DEFAULT_STOCK_TAGS: ReadonlyArray<{ id: string; label: string; sortOrder: number }> = [
  { id: DEFAULT_STOCK_TAG_IDS.NO_TREND, label: 'No trend', sortOrder: 10 },
  { id: DEFAULT_STOCK_TAG_IDS.SHORT_TREND, label: 'Short trend', sortOrder: 20 },
  { id: DEFAULT_STOCK_TAG_IDS.LONG_TREND, label: 'Long trend', sortOrder: 30 },
  { id: DEFAULT_STOCK_TAG_IDS.BASE_BUILDING, label: 'Base Building', sortOrder: 40 },
];

const RETIRED_SYSTEM_STOCK_TAG_IDS: ReadonlyArray<string> = [
  'story-play',
  'cleanest-chart',
  'interesting',
  'mamoth',
  'messy',
  'unsure',
  'wait-for-dip',
  'investment-grade',
  'new-born',
  'dead-sector',
  'favourite',
  'swing-trade',
  'no-momentum',
  'too-big-to-move',
  '1y-top',
  'add-on-dip',
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
  if (RETIRED_SYSTEM_STOCK_TAG_IDS.length > 0) {
    await sql`
      UPDATE static_items
      SET is_active = false, updated_at = now()
      WHERE id = ANY(${RETIRED_SYSTEM_STOCK_TAG_IDS}::text[])
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

function slugifyTagLabel(label: string): string {
  return label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
}

export function isSystemStockTagId(tagId: string): boolean {
  return SYSTEM_STOCK_TAG_ID_SET.has(tagId.trim().toLowerCase());
}

export async function createCustomStaticStockTag(label: string): Promise<StaticItemRow> {
  await ensureStaticItemsTable();
  const sql = getNeonSql();
  const trimmedLabel = label.trim().replace(/\s+/g, ' ');
  if (!trimmedLabel) throw new Error('Tag label is required');

  const baseId = slugifyTagLabel(trimmedLabel);
  if (!baseId) throw new Error('Tag label is invalid');

  for (let attempt = 0; attempt < 100; attempt += 1) {
    const candidateId = attempt === 0 ? baseId : `${baseId}-${attempt + 1}`;
    if (isSystemStockTagId(candidateId)) continue;
    const rows = await sql`
      WITH next_sort AS (
        SELECT COALESCE(MAX(sort_order), 0) + 10 AS next_order
        FROM static_items
      )
      INSERT INTO static_items (id, label, sort_order, is_active, updated_at)
      SELECT ${candidateId}, ${trimmedLabel}, next_order, true, now()
      FROM next_sort
      ON CONFLICT (id) DO NOTHING
      RETURNING id, label, sort_order
    `;
    const created = (rows as Array<{ id: string; label: string; sort_order: number }>)[0];
    if (created) {
      return { id: created.id, label: created.label, sortOrder: created.sort_order };
    }
  }

  throw new Error('Unable to create a unique tag id');
}

export async function deactivateCustomStaticStockTag(tagId: string): Promise<boolean> {
  await ensureStaticItemsTable();
  const sql = getNeonSql();
  const normalizedTagId = tagId.trim().toLowerCase();
  if (!normalizedTagId) throw new Error('Tag id is required');
  if (isSystemStockTagId(normalizedTagId)) {
    throw new Error('System tags cannot be deleted');
  }

  const rows = await sql`
    UPDATE static_items
    SET is_active = false, updated_at = now()
    WHERE id = ${normalizedTagId}
      AND is_active = true
    RETURNING id
  `;
  return (rows as Array<{ id: string }>).length > 0;
}
