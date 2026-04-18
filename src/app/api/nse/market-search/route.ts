import { NextResponse } from 'next/server';
import { nseFetchJson } from '@/lib/nse-fetch';
import { getNseIndiaClient } from '@/lib/nse-india-singleton';
import type { NseEquitySearchHit } from '@/app/api/nse/equity-search/route';

export const dynamic = 'force-dynamic';

const NSE_SEARCH_BASE = 'https://www.nseindia.com/api/NextApi/globalSearch/equity';

type NseSearchPayload = {
  data?: NseEquitySearchHit[];
};

export type NseIndexSearchHit = {
  indexName: string;
  /** Same as indexName for NSE broad indices */
  label: string;
};

function indexLabelFromEntry(x: unknown): string {
  if (typeof x === 'string') return x.trim();
  if (x && typeof x === 'object') {
    const o = x as Record<string, unknown>;
    const v = o.indexName ?? o.index ?? o.name ?? o.symbol ?? o.key;
    if (typeof v === 'string') return v.trim();
  }
  return '';
}

/**
 * NSE `/api/index-names` returns `{ stn: [ [shortKey, longName], ... ] }`.
 * Prefer `longName` for `getEquityStockIndices` / charts when present.
 */
function indexNamesFromNseStnPayload(raw: unknown): string[] {
  if (!raw || typeof raw !== 'object') return [];
  const stn = (raw as Record<string, unknown>).stn;
  if (!Array.isArray(stn)) return [];

  const out: string[] = [];
  const seen = new Set<string>();
  for (const row of stn) {
    if (!Array.isArray(row) || row.length < 1) continue;
    const shortKey = typeof row[0] === 'string' ? row[0].trim() : '';
    const longName = typeof row[1] === 'string' ? row[1].trim() : '';
    const primary = longName || shortKey;
    if (!primary || seen.has(primary)) continue;
    seen.add(primary);
    out.push(primary);
  }
  return out;
}

function normalizeIndexNameList(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw.map(indexLabelFromEntry).filter(Boolean);
  }
  if (raw && typeof raw === 'object') {
    const o = raw as Record<string, unknown>;
    const fromStn = indexNamesFromNseStnPayload(raw);
    if (fromStn.length > 0) return fromStn;

    const keys = ['indexNames', 'data', 'indices', 'names'] as const;
    for (const k of keys) {
      const v = o[k];
      if (Array.isArray(v)) return normalizeIndexNameList(v);
    }
  }
  return [];
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q')?.trim().toLowerCase() ?? '';
  if (q.length < 2) {
    return NextResponse.json({ equities: [] as NseEquitySearchHit[], indices: [] as NseIndexSearchHit[] });
  }

  const equityUrl = `${NSE_SEARCH_BASE}?symbol=${encodeURIComponent(q)}`;
  const equityResult = await nseFetchJson<NseSearchPayload>(equityUrl);

  let equities: NseEquitySearchHit[] = [];
  if (equityResult.ok && Array.isArray(equityResult.data.data)) {
    equities = equityResult.data.data;
  }

  let indices: NseIndexSearchHit[] = [];
  try {
    const rawNames = await getNseIndiaClient().getIndexNames();
    const names = normalizeIndexNameList(rawNames);
    indices = names
      .filter((name) => name.toLowerCase().includes(q))
      .slice(0, 40)
      .map((indexName) => ({ indexName, label: indexName }));
  } catch {
    indices = [];
  }

  if (!equityResult.ok && equities.length === 0 && indices.length === 0) {
    return NextResponse.json(
      { error: `NSE ${equityResult.status}`, detail: equityResult.detail, equities: [], indices: [] },
      { status: equityResult.status >= 500 ? 502 : 400 },
    );
  }

  return NextResponse.json({ equities, indices });
}
