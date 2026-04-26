import { getNeonSql } from '@/lib/db/ad-ratio';
import { ensureUsersTable } from '@/lib/db/users';

export type UserNetworthAssetRow = {
  id: number;
  name: string;
  value: number;
  updated_at: string;
};

export async function ensureUserNetworthAssetsTable(): Promise<void> {
  await ensureUsersTable();
  const sql = getNeonSql();
  await sql`
    CREATE TABLE IF NOT EXISTS user_networth_assets (
      id bigserial PRIMARY KEY,
      user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name text NOT NULL,
      value double precision NOT NULL DEFAULT 0,
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS user_networth_assets_user_id_idx
    ON user_networth_assets (user_id)
  `;
}

export async function listUserNetworthAssets(userId: string): Promise<UserNetworthAssetRow[]> {
  await ensureUserNetworthAssetsTable();
  const sql = getNeonSql();
  const rows = await sql`
    SELECT
      id,
      name,
      value,
      updated_at::text AS updated_at
    FROM user_networth_assets
    WHERE user_id = ${userId}
    ORDER BY id ASC
  `;
  return rows as UserNetworthAssetRow[];
}

export async function createUserNetworthAsset(
  userId: string,
  input: { name: string; value: number },
): Promise<UserNetworthAssetRow> {
  await ensureUserNetworthAssetsTable();
  const sql = getNeonSql();
  const name = String(input.name || '').trim();
  const value = Number.isFinite(input.value) ? Number(input.value) : 0;
  const rows = await sql`
    INSERT INTO user_networth_assets (user_id, name, value)
    VALUES (${userId}, ${name}, ${value})
    RETURNING id, name, value, updated_at::text AS updated_at
  `;
  return rows[0] as UserNetworthAssetRow;
}

export async function updateUserNetworthAsset(
  userId: string,
  input: { id: number; name: string; value: number },
): Promise<UserNetworthAssetRow | null> {
  await ensureUserNetworthAssetsTable();
  const sql = getNeonSql();
  const name = String(input.name || '').trim();
  const value = Number.isFinite(input.value) ? Number(input.value) : 0;
  const rows = await sql`
    UPDATE user_networth_assets
    SET
      name = ${name},
      value = ${value},
      updated_at = now()
    WHERE id = ${input.id} AND user_id = ${userId}
    RETURNING id, name, value, updated_at::text AS updated_at
  `;
  return (rows[0] as UserNetworthAssetRow | undefined) ?? null;
}

export async function deleteUserNetworthAsset(userId: string, id: number): Promise<boolean> {
  await ensureUserNetworthAssetsTable();
  const sql = getNeonSql();
  const rows = await sql`
    DELETE FROM user_networth_assets
    WHERE id = ${id} AND user_id = ${userId}
    RETURNING id
  `;
  return Array.isArray(rows) && rows.length > 0;
}
