import { NextResponse } from 'next/server';
import { getSessionFromCookies } from '@/lib/auth/server-session';
import { listAthScannerGlobal, replaceAthScannerGlobal } from '@/lib/db/ath-scanner-global';
import type { AthScannerParsedRow } from '@/lib/screener-ath-xlsx';

const MAX_ROWS = 2000;

function normalizeRows(input: unknown): AthScannerParsedRow[] | null {
  if (!Array.isArray(input)) return null;
  const out: AthScannerParsedRow[] = [];
  for (const raw of input) {
    if (!raw || typeof raw !== 'object') return null;
    const o = raw as Record<string, unknown>;
    const ticker = String(o.ticker ?? '').trim().toUpperCase();
    const tvSymbol = String(o.tvSymbol ?? '').trim();
    const companyName = String(o.companyName ?? '').trim();
    const screenerUrl = String(o.screenerUrl ?? '').trim();
    if (!ticker || !tvSymbol || !companyName || !screenerUrl) return null;
    if (ticker.length > 40 || tvSymbol.length > 64 || companyName.length > 512 || screenerUrl.length > 2048) {
      return null;
    }
    out.push({ ticker, tvSymbol, companyName, screenerUrl });
  }
  if (out.length > MAX_ROWS) return null;
  return out;
}

export async function GET() {
  const session = await getSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const url = process.env.DATABASE_URL?.trim();
  if (!url) {
    return NextResponse.json({
      rows: [],
      sourceFileName: null,
      updatedAt: null,
      unavailable: true as const,
    });
  }

  try {
    const snapshot = await listAthScannerGlobal();
    return NextResponse.json({ ...snapshot, unavailable: false as const });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Failed to load ATH scanner data';
    return NextResponse.json({ error: message, rows: [], sourceFileName: null, updatedAt: null }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const session = await getSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const url = process.env.DATABASE_URL?.trim();
  if (!url) {
    return NextResponse.json({ error: 'Database is not configured' }, { status: 503 });
  }

  try {
    const body = (await request.json()) as { sourceFileName?: unknown; rows?: unknown };
    const sourceFileName = String(body.sourceFileName ?? '').trim();
    const rows = normalizeRows(body.rows);
    if (!rows || rows.length === 0) {
      return NextResponse.json({ error: 'Invalid or empty rows' }, { status: 400 });
    }

    await replaceAthScannerGlobal(rows, sourceFileName || 'upload.xlsx');
    return NextResponse.json({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Failed to save ATH scanner data';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
