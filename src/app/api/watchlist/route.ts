import { NextResponse } from 'next/server';
import { getSessionFromCookies } from '@/lib/auth/server-session';
import {
  deleteUserWatchlistItem,
  listUserWatchlist,
  upsertUserWatchlistItem,
  type UserWatchlistInput,
} from '@/lib/db/watchlist';

function normalizeWatchlistItem(input: unknown): UserWatchlistInput | null {
  if (!input || typeof input !== 'object') return null;
  const row = input as Record<string, unknown>;
  const id = String(row.id ?? '').trim();
  const symbol = String(row.symbol ?? '').trim().toUpperCase();
  const companyName = String(row.companyName ?? '').trim();
  const addedAt = Number(row.addedAt);

  if (!id || !symbol || !companyName) return null;
  if (!Number.isFinite(addedAt) || addedAt <= 0) return null;

  return { id, symbol, companyName, addedAt };
}

export async function GET() {
  try {
    const session = await getSessionFromCookies();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const watchlist = await listUserWatchlist(session.sub);
    return NextResponse.json({ watchlist });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch watchlist';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await getSessionFromCookies();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = (await request.json()) as { item?: unknown };
    const item = normalizeWatchlistItem(payload.item);
    if (!item) {
      return NextResponse.json({ error: 'Invalid watchlist payload' }, { status: 400 });
    }

    await upsertUserWatchlistItem(session.sub, item);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to save watchlist item';
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
      return NextResponse.json({ error: 'Watchlist id is required' }, { status: 400 });
    }

    await deleteUserWatchlistItem(session.sub, id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to delete watchlist item';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
