import { useQuery } from '@tanstack/react-query';
import type { TradingViewIndiaScreenerResponse } from '@/lib/tradingview-india-screener';

async function fetchMonthlyScanner(): Promise<TradingViewIndiaScreenerResponse> {
  const response = await fetch('/api/tradingview-india-screener', { cache: 'no-store' });
  const payload = (await response.json()) as TradingViewIndiaScreenerResponse & { error?: string };
  if (!response.ok) {
    const msg = typeof payload?.error === 'string' ? payload.error : 'Failed to load monthly scanner.';
    throw new Error(msg);
  }
  return payload;
}

export function useTradingViewMonthlyScannerQuery(enabled: boolean) {
  return useQuery({
    queryKey: ['tradingview-india-monthly-scanner'],
    queryFn: fetchMonthlyScanner,
    enabled,
    staleTime: 60_000,
  });
}
