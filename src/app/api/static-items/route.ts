import { NextResponse } from 'next/server';
import { getSessionFromCookies } from '@/lib/auth/server-session';
import { listStaticStockTags } from '@/lib/db/static-items';

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
