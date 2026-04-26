import { flattenNseEquityHistoricalChunks } from '@/lib/nse-equity-historical-kline';
import type { EquityHistoricalData } from 'stock-nse-india';

export const RELATIVE_TURNOVER_TTL_MS = 24 * 60 * 60 * 1000;
export const RELATIVE_TURNOVER_REVALIDATE_SECONDS = 86_400;
export const RELATIVE_TURNOVER_CACHE_VERSION = 'v2';

export type RelativeTurnoverMetric = {
  symbol: string;
  /** 30-day total turnover in INR */
  turnover30d: number;
  /** 30-day total turnover converted to Crore INR */
  turnover30dCr: number;
  /** Market cap in Crore INR */
  marketCap: number;
  relativeTurnoverPct: number;
  asOf: string;
};

export type RelativeTurnoverApiResponse = {
  metric: RelativeTurnoverMetric;
};

export function calculateRelativeTurnover(
  historicalData: EquityHistoricalData[],
  marketCap: number,
): Omit<RelativeTurnoverMetric, 'symbol' | 'asOf'> {
  if (!Number.isFinite(marketCap) || marketCap <= 0) {
    throw new Error('Invalid market cap');
  }
  const daily = flattenNseEquityHistoricalChunks(historicalData);
  const last30 = daily.slice(-30);
  const turnover30d = last30.reduce((sum, row) => sum + (Number.isFinite(row.turnover) ? row.turnover : 0), 0);
  // NSE historical traded value is in INR, while totalMarketCap is in Crore INR.
  const turnover30dCr = turnover30d / 10_000_000;
  const relativeTurnoverPct = (turnover30dCr / marketCap) * 100;
  return { turnover30d, turnover30dCr, marketCap, relativeTurnoverPct };
}
