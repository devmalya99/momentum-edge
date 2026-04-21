import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSessionFromCookies } from '@/lib/auth/server-session';
import { listStaticStockTags } from '@/lib/db/static-items';
import { listUserStockTags, replaceUserStockTags } from '@/lib/db/user-stock-tags';

const stockTagsRequestSchema = z.object({
  tickers: z.array(z.string().trim().min(1).max(32)).max(300),
});

const upsertStockTagsSchema = z.object({
  ticker: z.string().trim().min(1).max(32),
  tagIds: z.array(z.string().trim().min(1).max(64)).max(30),
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
    const rows = await listUserStockTags(session.sub, body.tickers);
    const byTicker = new Map<string, string[]>();
    for (const row of rows) {
      const key = row.ticker.trim().toUpperCase();
      byTicker.set(key, [...(byTicker.get(key) ?? []), row.tagId]);
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
    const body = upsertStockTagsSchema.parse(await request.json());
    const staticItems = await listStaticStockTags();
    const allowed = new Set(staticItems.map((item) => item.id));
    const filtered = body.tagIds.filter((id) => allowed.has(id));
    await replaceUserStockTags(session.sub, body.ticker, filtered);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Failed to save stock tags' }, { status: 500 });
  }
}
