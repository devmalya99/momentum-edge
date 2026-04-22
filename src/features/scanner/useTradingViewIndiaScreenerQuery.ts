import { useQuery } from '@tanstack/react-query';
import type {
  TradingViewIndiaScreenerResponse,
  TradingViewIndiaScreenerScreen,
} from '@/lib/tradingview-india-screener';

async function fetchTradingViewIndiaScreener(
  screen: TradingViewIndiaScreenerScreen,
): Promise<TradingViewIndiaScreenerResponse> {
  const qs =
    screen === 'monthly' ? '' : `?screen=${encodeURIComponent(screen)}`;
  const response = await fetch(`/api/tradingview-india-screener${qs}`, { cache: 'no-store' });
  const payload = (await response.json()) as TradingViewIndiaScreenerResponse & { error?: string };
  if (!response.ok) {
    const msg = typeof payload?.error === 'string' ? payload.error : 'Failed to load TradingView screen.';
    throw new Error(msg);
  }
  return payload;
}

export function useTradingViewIndiaScreenerQuery(
  screen: TradingViewIndiaScreenerScreen,
  enabled: boolean,
) {
  return useQuery({
    queryKey: ['tradingview-india-screener', screen],
    queryFn: () => fetchTradingViewIndiaScreener(screen),
    enabled,
    staleTime: 60_000,
  });
}
