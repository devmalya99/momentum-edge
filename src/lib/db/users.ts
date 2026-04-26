import { getNeonSql } from '@/lib/db/ad-ratio';

export type UserRow = {
  id: string;
  email: string;
  password_hash: string;
  name: string;
  role: string;
  trading_experience: string | null;
  image_url: string | null;
  created_at: string;
  updated_at: string;
};

let usersSchemaReady = false;

export async function ensureUsersTable(): Promise<void> {
  if (usersSchemaReady) return;
  const sql = getNeonSql();
  await sql`
    CREATE TABLE IF NOT EXISTS users (
      id text PRIMARY KEY,
      email text NOT NULL UNIQUE,
      password_hash text NOT NULL,
      name text NOT NULL,
      role text NOT NULL DEFAULT 'user',
      trading_experience text,
      image_url text,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `;
  await sql`
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'user'
  `;
  usersSchemaReady = true;
}

export async function getUserByEmail(email: string): Promise<UserRow | null> {
  await ensureUsersTable();
  const sql = getNeonSql();
  const rows = await sql`
    SELECT
      id,
      email,
      password_hash,
      name,
      role,
      trading_experience,
      image_url,
      created_at::text AS created_at,
      updated_at::text AS updated_at
    FROM users
    WHERE lower(email) = lower(${email})
    LIMIT 1
  `;

  return (rows[0] as UserRow | undefined) ?? null;
}

export async function getUserById(id: string): Promise<UserRow | null> {
  await ensureUsersTable();
  const sql = getNeonSql();
  const rows = await sql`
    SELECT
      id,
      email,
      password_hash,
      name,
      role,
      trading_experience,
      image_url,
      created_at::text AS created_at,
      updated_at::text AS updated_at
    FROM users
    WHERE id = ${id}
    LIMIT 1
  `;

  return (rows[0] as UserRow | undefined) ?? null;
}

export async function createUser(input: {
  id: string;
  email: string;
  passwordHash: string;
  name: string;
  role?: string;
}): Promise<void> {
  await ensureUsersTable();
  const sql = getNeonSql();
  await sql`
    INSERT INTO users (id, email, password_hash, name, role)
    VALUES (${input.id}, ${input.email}, ${input.passwordHash}, ${input.name}, ${input.role ?? 'user'})
  `;
}

export async function updateUserProfile(
  userId: string,
  updates: {
    name?: string;
    tradingExperience?: string | null;
    imageUrl?: string | null;
    email?: string;
    passwordHash?: string;
  },
): Promise<void> {
  await ensureUsersTable();
  const sql = getNeonSql();
  const hasTradingExperience = updates.tradingExperience !== undefined;
  const hasImageUrl = updates.imageUrl !== undefined;
  await sql`
    UPDATE users
    SET
      name = COALESCE(${updates.name}, name),
      trading_experience = CASE
        WHEN ${hasTradingExperience} THEN ${updates.tradingExperience}
        ELSE trading_experience
      END,
      image_url = CASE
        WHEN ${hasImageUrl} THEN ${updates.imageUrl}
        ELSE image_url
      END,
      email = COALESCE(${updates.email}, email),
      password_hash = COALESCE(${updates.passwordHash}, password_hash),
      updated_at = now()
    WHERE id = ${userId}
  `;
}
