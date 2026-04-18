import { NextResponse } from 'next/server';
import { getSessionFromCookies } from '@/lib/auth/server-session';
import {
  deleteUserWatchlistItemsForList,
  deleteUserWatchlistList,
  insertUserWatchlistList,
  listUserWatchlistLists,
  updateUserWatchlistListName,
  type UserWatchlistListInput,
} from '@/lib/db/watchlist';
import { DEFAULT_WATCHLIST_LIST_ID } from '@/lib/watchlist-defaults';

function generateListId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export async function POST(request: Request) {
  try {
    const session = await getSessionFromCookies();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = (await request.json()) as { name?: unknown };
    const name = String(payload.name ?? '').trim() || 'Untitled';
    const existing = await listUserWatchlistLists(session.sub);
    const row: UserWatchlistListInput = {
      id: generateListId(),
      name,
      createdAt: Date.now(),
      sortOrder: existing.length,
    };
    await insertUserWatchlistList(session.sub, row);
    return NextResponse.json({
      list: {
        id: row.id,
        name: row.name,
        createdAt: row.createdAt,
        sortOrder: row.sortOrder,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create watchlist';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await getSessionFromCookies();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = (await request.json()) as { id?: unknown; name?: unknown };
    const id = String(payload.id ?? '').trim();
    const name = String(payload.name ?? '').trim();
    if (!id || !name) {
      return NextResponse.json({ error: 'id and name required' }, { status: 400 });
    }

    await updateUserWatchlistListName(session.sub, id, name);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to rename watchlist';
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
      return NextResponse.json({ error: 'id required' }, { status: 400 });
    }
    if (id === DEFAULT_WATCHLIST_LIST_ID) {
      return NextResponse.json({ error: 'Cannot delete the primary list' }, { status: 400 });
    }

    await deleteUserWatchlistItemsForList(session.sub, id);
    await deleteUserWatchlistList(session.sub, id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to delete watchlist';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
