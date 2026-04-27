import { flattenNseEquityHistoricalChunks } from '@/lib/nse-equity-historical-kline';
import type { EquityHistoricalData } from 'stock-nse-india';

export const TURNOVER_ACCELERATION_REVALIDATE_SECONDS = 72_000; // 20h server revalidate
export const TURNOVER_ACCELERATION_TTL_MS = 24 * 60 * 60 * 1000; // 24h client/store TTL
export const TURNOVER_ACCELERATION_CACHE_VERSION = 'v3';

export type TurnoverAccelerationMetric = {
  symbol: string;
  recentTurnover: number;
  previousTurnover: number;
  turnoverAccelerationPct: number | null;
  asOf: string;
};

export type TurnoverAccelerationApiResponse = {
  metric: TurnoverAccelerationMetric;
};

export function calculateTurnoverAcceleration(
  historicalData: EquityHistoricalData[],
): Omit<TurnoverAccelerationMetric, 'symbol' | 'asOf'> {
  const daily = flattenNseEquityHistoricalChunks(historicalData);
  const recent3Rows = daily.slice(-3); // includes today's session when available
  const previous13Rows = daily.slice(-16, -3); // 13 sessions immediately before recent 3

  const recentTotalVolume = recent3Rows.reduce((sum, row) => {
    return sum + (Number.isFinite(row.volume) ? row.volume : 0);
  }, 0);
  const previousTotalVolume = previous13Rows.reduce((sum, row) => {
    return sum + (Number.isFinite(row.volume) ? row.volume : 0);
  }, 0);

  const recentTurnover = recent3Rows.length > 0 ? recentTotalVolume / recent3Rows.length : 0;
  const previousTurnover =
    previous13Rows.length > 0 ? previousTotalVolume / previous13Rows.length : 0;

  if (!Number.isFinite(previousTurnover) || previousTurnover <= 0) {
    return {
      recentTurnover,
      previousTurnover,
      turnoverAccelerationPct: null,
    };
  }
  const turnoverAccelerationPct = ((recentTurnover - previousTurnover) / previousTurnover) * 100;
  return {
    recentTurnover,
    previousTurnover,
    turnoverAccelerationPct,
  };
}
