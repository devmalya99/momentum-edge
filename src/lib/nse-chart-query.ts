import type { QueryClient } from '@tanstack/react-query';
import { fetchNseEquityIntraday } from '@/lib/nse-equity-intraday-client';
import { fetchNseEquityHistorical } from '@/lib/nse-equity-historical-client';
import { fetchNseIndexHistorical } from '@/lib/nse-index-historical-client';
import type { NseEquityIntradayResponse } from '@/lib/nse-equity-intraday-client';

export const NSE_CHART_STALE_MS = 5 * 60_000;

function ymd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function defaultNseChartHistoryRange(): { from: string; to: string } {
  const end = new Date();
  const start = new Date(end.getTime());
  start.setFullYear(start.getFullYear() - 3);
  return { from: ymd(start), to: ymd(end) };
}

export type NseChartSeriesKind = 'equity' | 'index';

export type NseChartHistoricalData =
  | { seriesKind: 'index'; bars: Awaited<ReturnType<typeof fetchNseIndexHistorical>>['bars'] }
  | { seriesKind: 'equity'; pack: Awaited<ReturnType<typeof fetchNseEquityHistorical>> };

export function nseChartHistoricalQueryKey(
  symbol: string,
  seriesKind: NseChartSeriesKind,
  range: { from: string; to: string } = defaultNseChartHistoryRange(),
) {
  const nse = symbol.trim().toUpperCase();
  if (seriesKind === 'index') return ['nse-index-historical', nse] as const;
  return ['nse-equity-historical', nse, range.from, range.to] as const;
}

export async function fetchNseChartHistorical(
  symbol: string,
  seriesKind: NseChartSeriesKind,
  range: { from: string; to: string } = defaultNseChartHistoryRange(),
): Promise<NseChartHistoricalData> {
  const nse = symbol.trim().toUpperCase();
  if (seriesKind === 'index') {
    const { bars } = await fetchNseIndexHistorical(nse, { flag: '5Y' });
    return { seriesKind: 'index', bars };
  }
  const pack = await fetchNseEquityHistorical(nse, { from: range.from, to: range.to });
  return { seriesKind: 'equity', pack };
}

export function nseChartHistoricalQueryOptions(
  symbol: string,
  seriesKind: NseChartSeriesKind,
  range: { from: string; to: string } = defaultNseChartHistoryRange(),
) {
  const nse = symbol.trim().toUpperCase();
  return {
    queryKey: nseChartHistoricalQueryKey(nse, seriesKind, range),
    queryFn: () => fetchNseChartHistorical(nse, seriesKind, range),
    enabled: nse.length > 0,
    staleTime: NSE_CHART_STALE_MS,
  } as const;
}

export async function prefetchNseChartHistorical(
  queryClient: QueryClient,
  symbol: string,
  seriesKind: NseChartSeriesKind,
) {
  const nse = symbol.trim().toUpperCase();
  if (!nse) return;
  const range = defaultNseChartHistoryRange();
  await queryClient.prefetchQuery({
    ...nseChartHistoricalQueryOptions(nse, seriesKind, range),
  });
}

export function nseEquityIntradayQueryKey(symbol: string) {
  return ['nse-equity-intraday', symbol.trim().toUpperCase()] as const;
}

export function nseEquityIntradayQueryOptions(symbol: string) {
  const nse = symbol.trim().toUpperCase();
  return {
    queryKey: nseEquityIntradayQueryKey(nse),
    queryFn: (): Promise<NseEquityIntradayResponse> => fetchNseEquityIntraday(nse),
    enabled: nse.length > 0,
    staleTime: 60_000,
    refetchInterval: 60_000,
  } as const;
}

export async function prefetchNseEquityIntraday(queryClient: QueryClient, symbol: string) {
  const nse = symbol.trim().toUpperCase();
  if (!nse) return;
  await queryClient.prefetchQuery({ ...nseEquityIntradayQueryOptions(nse) });
}
