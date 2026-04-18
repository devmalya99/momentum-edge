import type { EquityHistoricalData } from 'stock-nse-india';

export type NseEquityHistoricalResponse = {
  symbol: string;
  range: { start: string; end: string };
  data: EquityHistoricalData[];
};

/**
 * Fetches daily historical candles (chunked by the upstream library). Prefer passing
 * `from` / `to` when you need a fixed window; otherwise the API defaults to ~120 days.
 */
export async function fetchNseEquityHistorical(
  symbol: string,
  opts?: { from?: string; to?: string },
): Promise<NseEquityHistoricalResponse> {
  const sym = symbol.trim().toUpperCase();
  const q = new URLSearchParams({ symbol: sym });
  if (opts?.from) q.set('from', opts.from);
  if (opts?.to) q.set('to', opts.to);
  const res = await fetch(`/api/nse/equity-historical?${q.toString()}`, { cache: 'no-store' });
  const payload = (await res.json()) as NseEquityHistoricalResponse & { error?: string; detail?: string };
  if (!res.ok) {
    const msg =
      typeof payload?.error === 'string'
        ? `${payload.error}${typeof payload.detail === 'string' ? `: ${payload.detail}` : ''}`
        : 'Historical fetch failed';
    throw new Error(msg);
  }
  if (!Array.isArray(payload.data)) {
    throw new Error('Invalid historical payload');
  }
  return payload as NseEquityHistoricalResponse;
}
