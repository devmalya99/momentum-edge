import type { NseDailyBar } from '@/lib/nse-equity-historical-kline';

export type NseIndexHistoricalResponse = {
  index: string;
  flag: string;
  bars: NseDailyBar[];
};

export async function fetchNseIndexHistorical(
  index: string,
  opts?: { flag?: string },
): Promise<NseIndexHistoricalResponse> {
  const name = index.trim();
  const q = new URLSearchParams({ index: name });
  if (opts?.flag) q.set('flag', opts.flag);
  const res = await fetch(`/api/nse/index-historical?${q.toString()}`, { cache: 'no-store' });
  const payload = (await res.json()) as NseIndexHistoricalResponse & { error?: string; detail?: string };
  if (!res.ok) {
    const msg =
      typeof payload?.error === 'string'
        ? `${payload.error}${typeof payload.detail === 'string' ? `: ${payload.detail}` : ''}`
        : 'Index historical fetch failed';
    throw new Error(msg);
  }
  if (!Array.isArray(payload.bars)) {
    throw new Error('Invalid index historical payload');
  }
  return payload as NseIndexHistoricalResponse;
}
