import { NextResponse } from 'next/server';
import { getSessionFromCookies } from '@/lib/auth/server-session';
import { deleteUserRule, listUserRules, upsertUserRule } from '@/lib/db/rules';
import type { Rule } from '@/db';

function normalizeRule(input: unknown): Rule | null {
  if (!input || typeof input !== 'object') return null;
  const row = input as Record<string, unknown>;
  const id = String(row.id ?? '').trim();
  const name = String(row.name ?? '').trim();
  const enabled = Boolean(row.enabled);

  if (!id || !name) return null;
  return { id, name, maxScore: 1, enabled };
}

export async function GET() {
  try {
    const session = await getSessionFromCookies();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const rows = await listUserRules(session.sub);
    return NextResponse.json({
      rules: rows.map((row) => ({
        id: row.id,
        name: row.name,
        maxScore: 1,
        enabled: Boolean(row.enabled),
      })),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch rules';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await getSessionFromCookies();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const payload = (await request.json()) as { rule?: unknown };
    const rule = normalizeRule(payload.rule);
    if (!rule) {
      return NextResponse.json({ error: 'Invalid rule payload' }, { status: 400 });
    }
    await upsertUserRule(session.sub, rule);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to save rule';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await getSessionFromCookies();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const payload = (await request.json()) as { rule?: unknown };
    const rule = normalizeRule(payload.rule);
    if (!rule) {
      return NextResponse.json({ error: 'Invalid rule payload' }, { status: 400 });
    }
    await upsertUserRule(session.sub, rule);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update rule';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const session = await getSessionFromCookies();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const payload = (await request.json()) as { id?: unknown };
    const id = String(payload.id ?? '').trim();
    if (!id) {
      return NextResponse.json({ error: 'Missing rule id' }, { status: 400 });
    }
    await deleteUserRule(session.sub, id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to delete rule';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
