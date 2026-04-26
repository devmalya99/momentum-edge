import { NextResponse } from 'next/server';
import { unstable_cache } from 'next/cache';
import { getNseIndiaClient } from '@/lib/nse-india-singleton';
import {
  RELATIVE_TURNOVER_CACHE_VERSION,
  calculateRelativeTurnover,
  RELATIVE_TURNOVER_REVALIDATE_SECONDS,
  type RelativeTurnoverApiResponse,
} from '@/lib/relative-turnover';

export const revalidate = RELATIVE_TURNOVER_REVALIDATE_SECONDS;

const getRelativeTurnoverCached = unstable_cache(
  async (symbol: string): Promise<RelativeTurnoverApiResponse> => {
    const [historicalChunks, tradeInfo] = await Promise.all([
      getNseIndiaClient().getEquityHistoricalData(symbol),
      getNseIndiaClient().getEquityTradeInfo(symbol),
    ]);
    const marketCap = Number(tradeInfo?.marketDeptOrderBook?.tradeInfo?.totalMarketCap);
    const metric = calculateRelativeTurnover(historicalChunks, marketCap);
    return {
      metric: {
        symbol,
        ...metric,
        asOf: new Date().toISOString(),
      },
    };
  },
  [`stocks-relative-turnover-${RELATIVE_TURNOVER_CACHE_VERSION}`],
  { revalidate: RELATIVE_TURNOVER_REVALIDATE_SECONDS },
);

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const symbol = searchParams.get('symbol')?.trim().toUpperCase() ?? '';
  if (!symbol) {
    return NextResponse.json({ error: 'symbol required' }, { status: 400 });
  }
  try {
    const payload = await getRelativeTurnoverCached(symbol);
    return NextResponse.json(payload, {
      headers: {
        'Cache-Control': `public, max-age=${RELATIVE_TURNOVER_REVALIDATE_SECONDS}, s-maxage=${RELATIVE_TURNOVER_REVALIDATE_SECONDS}, stale-while-revalidate=3600`,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Relative turnover fetch failed';
    return NextResponse.json({ error: 'Relative turnover fetch failed', detail: message }, { status: 502 });
  }
}
