import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSessionFromCookies } from '@/lib/auth/server-session';
import {
  createCustomStaticStockTag,
  deactivateCustomStaticStockTag,
  listStaticStockTags,
} from '@/lib/db/static-items';
import { getUserById } from '@/lib/db/users';

const createStaticTagSchema = z.object({
  label: z.string().trim().min(1).max(40),
});

const deleteStaticTagSchema = z.object({
  id: z.string().trim().min(1).max(64),
});

function isTrustedSameOriginRequest(request: Request): boolean {
  const origin = request.headers.get('origin');
  const host = request.headers.get('host');
  const secFetchSite = request.headers.get('sec-fetch-site');
  const xrw = request.headers.get('x-requested-with');
  if (!origin || !host) return false;
  let originHost = '';
  try {
    originHost = new URL(origin).host;
  } catch {
    return false;
  }
  const sameHost = originHost === host;
  const trustedFetchSite =
    secFetchSite === null || secFetchSite === 'same-origin' || secFetchSite === 'same-site';
  const hasAjaxMarker = xrw?.toLowerCase() === 'xmlhttprequest';
  return sameHost && trustedFetchSite && hasAjaxMarker;
}

export async function GET() {
  try {
    const session = await getSessionFromCookies();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!process.env.DATABASE_URL?.trim()) {
      return NextResponse.json({ error: 'Database is not configured' }, { status: 503 });
    }
    const items = await listStaticStockTags();
    return NextResponse.json({ items });
  } catch {
    return NextResponse.json({ error: 'Failed to load static items' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await getSessionFromCookies();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!isTrustedSameOriginRequest(request)) {
      return NextResponse.json({ error: 'Request failed verification checks' }, { status: 403 });
    }
    if (!process.env.DATABASE_URL?.trim()) {
      return NextResponse.json({ error: 'Database is not configured' }, { status: 503 });
    }
    const user = await getUserById(session.sub);
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    if (user.role !== 'admin') {
      return NextResponse.json({ error: 'Only admins can manage tags' }, { status: 403 });
    }
    const body = createStaticTagSchema.parse(await request.json());
    const item = await createCustomStaticStockTag(body.label);
    return NextResponse.json({ item });
  } catch {
    return NextResponse.json({ error: 'Failed to create static item' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const session = await getSessionFromCookies();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!isTrustedSameOriginRequest(request)) {
      return NextResponse.json({ error: 'Request failed verification checks' }, { status: 403 });
    }
    if (!process.env.DATABASE_URL?.trim()) {
      return NextResponse.json({ error: 'Database is not configured' }, { status: 503 });
    }
    const user = await getUserById(session.sub);
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    if (user.role !== 'admin') {
      return NextResponse.json({ error: 'Only admins can manage tags' }, { status: 403 });
    }
    const body = deleteStaticTagSchema.parse(await request.json());
    const deleted = await deactivateCustomStaticStockTag(body.id);
    if (!deleted) {
      return NextResponse.json({ error: 'Tag not found' }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to delete static item';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
