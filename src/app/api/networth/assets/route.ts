import { NextResponse } from 'next/server';
import { getSessionFromCookies } from '@/lib/auth/server-session';
import {
  createUserNetworthAsset,
  deleteUserNetworthAsset,
  listUserNetworthAssets,
  updateUserNetworthAsset,
} from '@/lib/db/user-networth-assets';

export async function GET() {
  try {
    const session = await getSessionFromCookies();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const assets = await listUserNetworthAssets(session.sub);
    return NextResponse.json({ assets });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load assets';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await getSessionFromCookies();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const payload = (await request.json()) as { name?: unknown; value?: unknown };
    const name = String(payload.name ?? '').trim();
    const value = Number(payload.value);
    if (!name) return NextResponse.json({ error: 'name is required' }, { status: 400 });
    if (!Number.isFinite(value)) {
      return NextResponse.json({ error: 'value must be finite' }, { status: 400 });
    }
    const asset = await createUserNetworthAsset(session.sub, { name, value });
    return NextResponse.json({ ok: true, asset });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create asset';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await getSessionFromCookies();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const payload = (await request.json()) as { id?: unknown; name?: unknown; value?: unknown };
    const id = Number(payload.id);
    const name = String(payload.name ?? '').trim();
    const value = Number(payload.value);
    if (!Number.isInteger(id) || id <= 0) {
      return NextResponse.json({ error: 'id must be a positive integer' }, { status: 400 });
    }
    if (!name) return NextResponse.json({ error: 'name is required' }, { status: 400 });
    if (!Number.isFinite(value)) {
      return NextResponse.json({ error: 'value must be finite' }, { status: 400 });
    }
    const asset = await updateUserNetworthAsset(session.sub, { id, name, value });
    if (!asset) return NextResponse.json({ error: 'Asset not found' }, { status: 404 });
    return NextResponse.json({ ok: true, asset });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update asset';
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
    const id = Number(payload.id);
    if (!Number.isInteger(id) || id <= 0) {
      return NextResponse.json({ error: 'id must be a positive integer' }, { status: 400 });
    }
    const deleted = await deleteUserNetworthAsset(session.sub, id);
    if (!deleted) return NextResponse.json({ error: 'Asset not found' }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to delete asset';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
