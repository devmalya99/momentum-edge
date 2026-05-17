import type { NseIntradayMinute } from '@/lib/nse-equity-intraday-kline';

export type NseEquityIntradayResponse = {
  symbol: string;
  name: string;
  closePrice: number | null;
  minutes: NseIntradayMinute[];
};

export async function fetchNseEquityIntraday(symbol: string): Promise<NseEquityIntradayResponse> {
  const sym = symbol.trim().toUpperCase();
  const res = await fetch(`/api/nse/equity-intraday?symbol=${encodeURIComponent(sym)}`, {
    cache: 'no-store',
  });
  const payload = (await res.json()) as NseEquityIntradayResponse & { error?: string; detail?: string };
  if (!res.ok) {
    const msg =
      typeof payload?.error === 'string'
        ? `${payload.error}${typeof payload.detail === 'string' ? `: ${payload.detail}` : ''}`
        : 'Intraday fetch failed';
    throw new Error(msg);
  }
  if (!Array.isArray(payload.minutes)) {
    throw new Error('Invalid intraday payload');
  }
  return payload as NseEquityIntradayResponse;
}
