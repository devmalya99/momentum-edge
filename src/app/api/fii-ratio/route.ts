import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const UPSTREAM = 'https://api.vrdnation.org/service/fii-ratio';

export type FiiRatioRow = {
  date: string;
  indexLong: number;
  indexShort: number;
  fiiLong: number;
  fiiShort: number;
};

function isFiiRow(x: unknown): x is FiiRatioRow {
  if (!x || typeof x !== 'object') return false;
  const o = x as Record<string, unknown>;
  return (
    typeof o.date === 'string' &&
    typeof o.indexLong === 'number' &&
    typeof o.indexShort === 'number' &&
    typeof o.fiiLong === 'number' &&
    typeof o.fiiShort === 'number'
  );
}

export async function GET() {
  try {
    const res = await fetch(UPSTREAM, {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'MomentumEdge/1.0',
      },
      cache: 'no-store',
    });

    const raw = await res.text();

    if (!res.ok) {
      return NextResponse.json(
        { error: `VRDNation ${res.status}`, detail: raw.slice(0, 200), data: [] as FiiRatioRow[] },
        { status: 502 },
      );
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw) as unknown;
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON from upstream', data: [] as FiiRatioRow[] },
        { status: 502 },
      );
    }

    if (!Array.isArray(parsed)) {
      return NextResponse.json(
        { error: 'Expected array from upstream', data: [] as FiiRatioRow[] },
        { status: 502 },
      );
    }

    const data = parsed.filter(isFiiRow);
    return NextResponse.json({ data });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ error: message, data: [] as FiiRatioRow[] }, { status: 502 });
  }
}
