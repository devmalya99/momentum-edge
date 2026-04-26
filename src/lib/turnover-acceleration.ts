import { flattenNseEquityHistoricalChunks } from '@/lib/nse-equity-historical-kline';
import type { EquityHistoricalData } from 'stock-nse-india';

export const TURNOVER_ACCELERATION_REVALIDATE_SECONDS = 72_000; // 20h server revalidate
export const TURNOVER_ACCELERATION_TTL_MS = 24 * 60 * 60 * 1000; // 24h client/store TTL
export const TURNOVER_ACCELERATION_CACHE_VERSION = 'v1';

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
  const last10 = daily.slice(-10);
  const recentRows = last10.slice(-5);
  const previousRows = last10.slice(0, Math.max(0, last10.length - recentRows.length));
  const previousLast5 = previousRows.slice(-5);

  const recentTurnover = recentRows.reduce(
    (sum, row) => sum + (Number.isFinite(row.turnover) ? row.turnover : 0),
    0,
  );
  const previousTurnover = previousLast5.reduce(
    (sum, row) => sum + (Number.isFinite(row.turnover) ? row.turnover : 0),
    0,
  );

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
