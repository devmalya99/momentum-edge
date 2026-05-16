/**
 * Resolves NSE `getGraphChart` `type` parameters.
 * NSE accepts long index names for many benchmarks but requires short keys for others
 * (e.g. NIFTYM150MOMNTM50 vs NIFTY MIDCAP150 MOMENTUM 50).
 */

import type { NseIndia } from 'stock-nse-india';

type IndexNameMap = {
  longToShort: Map<string, string>;
  loadedAt: number;
};

const CACHE_MS = 60 * 60_000;
let cachedMap: IndexNameMap | null = null;

function parseIndexNamesPayload(raw: unknown): Map<string, string> {
  const longToShort = new Map<string, string>();
  const stn = (raw as { stn?: unknown[][] })?.stn;
  if (!Array.isArray(stn)) return longToShort;

  for (const row of stn) {
    if (!Array.isArray(row) || row.length < 1) continue;
    const short = String(row[0] ?? '').trim();
    const long = String(row[1] ?? '').trim() || short;
    if (!short) continue;
    longToShort.set(long, short);
    longToShort.set(short, short);
  }
  return longToShort;
}

async function loadIndexNameMap(client: NseIndia): Promise<Map<string, string>> {
  const now = Date.now();
  if (cachedMap && now - cachedMap.loadedAt < CACHE_MS) {
    return cachedMap.longToShort;
  }
  const raw = await client.getIndexNames();
  const longToShort = parseIndexNamesPayload(raw);
  cachedMap = { longToShort, loadedAt: now };
  return longToShort;
}

/** Ordered unique candidates for `getGraphChart&type=…`. */
export function buildGraphChartTypeCandidates(
  label: string,
  longToShort: Map<string, string>,
  explicitChartType?: string,
): string[] {
  const trimmed = label.trim();
  if (!trimmed) return [];

  const out: string[] = [];
  const add = (value: string | undefined) => {
    const v = value?.trim();
    if (!v) return;
    if (!out.includes(v)) out.push(v);
  };

  add(explicitChartType);
  add(longToShort.get(trimmed));
  add(trimmed);

  return out;
}

function isNotFoundError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const e = error as { response?: { status?: number }; status?: number; message?: string };
  const status = e.response?.status ?? e.status;
  if (status === 404) return true;
  const msg = typeof e.message === 'string' ? e.message : '';
  return msg.includes('404');
}

/**
 * Fetches raw NSE graph chart payload, trying long name then official short key.
 */
export async function fetchIndexGraphChartPayload(
  client: NseIndia,
  indexLabel: string,
  flag: string,
  explicitChartType?: string,
): Promise<{ payload: unknown; chartType: string }> {
  const longToShort = await loadIndexNameMap(client);
  const candidates = buildGraphChartTypeCandidates(indexLabel, longToShort, explicitChartType);

  if (candidates.length === 0) {
    throw new Error('Index label is required for graph chart fetch');
  }

  let lastError: unknown;
  for (const chartType of candidates) {
    const path =
      `/api/NextApi/apiClient?functionName=getGraphChart` +
      `&type=${encodeURIComponent(chartType)}&flag=${encodeURIComponent(flag)}`;
    try {
      const payload = await client.getDataByEndpoint(path);
      const gd =
        (payload as { data?: { grapthData?: unknown[]; graphData?: unknown[] } })?.data
          ?.grapthData ??
        (payload as { data?: { graphData?: unknown[] } })?.data?.graphData;
      if (Array.isArray(gd) && gd.length > 0) {
        return { payload, chartType };
      }
      lastError = new Error(`No graph data for index type ${chartType}`);
    } catch (error) {
      lastError = error;
      if (!isNotFoundError(error)) {
        throw error;
      }
    }
  }

  const detail =
    lastError instanceof Error ? lastError.message : 'Unknown NSE graph chart error';
  throw new Error(
    `NSE does not recognize index chart type for "${indexLabel}". Tried: ${candidates.join(', ')}. ${detail}`,
  );
}
