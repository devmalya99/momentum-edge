import { NextResponse } from 'next/server';
import { getNeonSql } from '@/lib/db/ad-ratio';
import { ensureUsersTable, normalizeUserMembership } from '@/lib/db/users';
import { PREMIUM_REQUIRED_CODE } from '@/lib/membership/constants';
import type { UserMembership } from '@/lib/membership/types';

export async function getUserMembership(userId: string): Promise<UserMembership> {
  await ensureUsersTable();
  const sql = getNeonSql();
  const rows = await sql`
    SELECT membership, plan
    FROM users
    WHERE id = ${userId}
    LIMIT 1
  `;
  const row = rows[0] as { membership?: string; plan?: string } | undefined;
  if (!row) return 'basic';
  return normalizeUserMembership(row.membership ?? row.plan);
}

export function isPremiumMembership(membership: UserMembership): boolean {
  return membership === 'premium';
}

export async function requirePremiumMembership(
  userId: string,
): Promise<NextResponse | null> {
  const membership = await getUserMembership(userId);
  if (isPremiumMembership(membership)) return null;
  return NextResponse.json(
    {
      error: 'Premium membership required',
      code: PREMIUM_REQUIRED_CODE,
      membership: 'basic',
    },
    { status: 403 },
  );
}

export async function setUserMembershipPremium(userId: string): Promise<void> {
  await ensureUsersTable();
  const sql = getNeonSql();
  await sql`
    UPDATE users
    SET membership = 'premium', updated_at = now()
    WHERE id = ${userId}
  `;
}
