import { getNeonSql } from '@/lib/db/ad-ratio';
import { ensureUsersTable } from '@/lib/db/users';

export type UserRuleInput = {
  id: string;
  name: string;
  enabled: boolean;
};

export type UserRuleRow = {
  id: string;
  name: string;
  enabled: boolean;
  created_at: number;
};

export async function ensureUserRulesTable(): Promise<void> {
  await ensureUsersTable();
  const sql = getNeonSql();
  await sql`
    CREATE TABLE IF NOT EXISTS user_trade_rules (
      user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      id text NOT NULL,
      name text NOT NULL,
      category text NOT NULL,
      enabled boolean NOT NULL DEFAULT true,
      created_at bigint NOT NULL,
      PRIMARY KEY (user_id, id)
    )
  `;
}

export async function listUserRules(userId: string): Promise<UserRuleRow[]> {
  await ensureUserRulesTable();
  const sql = getNeonSql();
  const rows = await sql`
    SELECT id, name, enabled, created_at
    FROM user_trade_rules
    WHERE user_id = ${userId}
    ORDER BY created_at ASC
  `;
  return rows as UserRuleRow[];
}

export async function upsertUserRule(userId: string, rule: UserRuleInput): Promise<void> {
  await ensureUserRulesTable();
  const sql = getNeonSql();
  await sql`
    INSERT INTO user_trade_rules (
      user_id,
      id,
      name,
      category,
      enabled,
      created_at
    )
    VALUES (
      ${userId},
      ${rule.id},
      ${rule.name},
      ${'General'},
      ${rule.enabled},
      ${Date.now()}
    )
    ON CONFLICT (user_id, id)
    DO UPDATE SET
      name = EXCLUDED.name,
      enabled = EXCLUDED.enabled
  `;
}

export async function deleteUserRule(userId: string, id: string): Promise<void> {
  await ensureUserRulesTable();
  const sql = getNeonSql();
  await sql`
    DELETE FROM user_trade_rules
    WHERE user_id = ${userId} AND id = ${id}
  `;
}
