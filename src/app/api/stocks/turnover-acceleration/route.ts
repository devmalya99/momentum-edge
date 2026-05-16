import { NextResponse } from 'next/server';
import { unstable_cache } from 'next/cache';
import { getNseIndiaClient } from '@/lib/nse-india-singleton';
import {
  calculateTurnoverAcceleration,
  TURNOVER_ACCELERATION_CACHE_VERSION,
  TURNOVER_ACCELERATION_REVALIDATE_SECONDS,
  type TurnoverAccelerationApiResponse,
} from '@/lib/turnover-acceleration';

export const revalidate = 72000;

const getTurnoverAccelerationCached = unstable_cache(
  async (symbol: string): Promise<TurnoverAccelerationApiResponse> => {
    const historicalChunks = await getNseIndiaClient().getEquityHistoricalData(symbol);
    const metric = calculateTurnoverAcceleration(historicalChunks);
    return {
      metric: {
        symbol,
        ...metric,
        asOf: new Date().toISOString(),
      },
    };
  },
  [`stocks-turnover-acceleration-${TURNOVER_ACCELERATION_CACHE_VERSION}`],
  { revalidate: TURNOVER_ACCELERATION_REVALIDATE_SECONDS },
);

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const symbol = searchParams.get('symbol')?.trim().toUpperCase() ?? '';
  if (!symbol) {
    return NextResponse.json({ error: 'symbol required' }, { status: 400 });
  }
  try {
    const payload = await getTurnoverAccelerationCached(symbol);
    return NextResponse.json(payload, {
      headers: {
        'Cache-Control': `public, max-age=${TURNOVER_ACCELERATION_REVALIDATE_SECONDS}, s-maxage=${TURNOVER_ACCELERATION_REVALIDATE_SECONDS}, stale-while-revalidate=3600`,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Turnover acceleration fetch failed';
    return NextResponse.json(
      { error: 'Turnover acceleration fetch failed', detail: message },
      { status: 502 },
    );
  }
}
