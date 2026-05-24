import { useQuery } from '@tanstack/react-query';
import type { TradingViewIndiaScreenerResponse } from '@/lib/tradingview-india-screener';

async function fetchTradingViewIndiaScreener(): Promise<TradingViewIndiaScreenerResponse> {
  const response = await fetch('/api/tradingview-india-screener', { cache: 'no-store' });
  const payload = (await response.json()) as TradingViewIndiaScreenerResponse & { error?: string };
  if (!response.ok) {
    const msg = typeof payload?.error === 'string' ? payload.error : 'Failed to load TradingView screen.';
    throw new Error(msg);
  }
  return payload;
}

export function useTradingViewIndiaScreenerQuery(enabled = true) {
  return useQuery({
    queryKey: ['tradingview-india-screener', 'todays-special'],
    queryFn: fetchTradingViewIndiaScreener,
    enabled,
    staleTime: 60_000,
  });
}
