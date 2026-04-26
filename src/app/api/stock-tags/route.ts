import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSessionFromCookies } from '@/lib/auth/server-session';
import { listStaticStockTags } from '@/lib/db/static-items';
import { getUserById } from '@/lib/db/users';
import { listStockTags, replaceStockTag } from '@/lib/db/user-stock-tags';

const stockTagsRequestSchema = z.object({
  tickers: z.array(z.string().trim().min(1).max(32)).max(300),
});

const upsertStockTagsSchema = z.object({
  ticker: z.string().trim().min(1).max(32),
  tagId: z.string().trim().min(1).max(64).nullable(),
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
    const body = stockTagsRequestSchema.parse(await request.json());
    const rows = await listStockTags(body.tickers);
    const byTicker = new Map<string, string[]>();
    for (const row of rows) {
      const key = row.ticker.trim().toUpperCase();
      byTicker.set(key, [row.tagId]);
    }
    return NextResponse.json({
      tags: [...byTicker.entries()].map(([ticker, tagIds]) => ({ ticker, tagIds })),
    });
  } catch {
    return NextResponse.json({ error: 'Failed to load stock tags' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
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
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });
    if (user.role !== 'admin') {
      return NextResponse.json({ error: 'Only admins can edit stock tags' }, { status: 403 });
    }
    const body = upsertStockTagsSchema.parse(await request.json());
    const staticItems = await listStaticStockTags();
    const allowed = new Set(staticItems.map((item) => item.id));
    const normalizedTagId = body.tagId?.trim() ?? null;
    if (normalizedTagId && !allowed.has(normalizedTagId)) {
      return NextResponse.json({ error: 'Invalid stock tag id' }, { status: 400 });
    }
    await replaceStockTag(session.sub, body.ticker, normalizedTagId);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Failed to save stock tags' }, { status: 500 });
  }
}
