import { NextResponse } from 'next/server';
import { getNseIndiaClient } from '@/lib/nse-india-singleton';
import { parseNseEquityIntradayGraph } from '@/lib/nse-equity-intraday-kline';

export const dynamic = 'force-dynamic';

type IntradayPayload = {
  identifier?: string;
  name?: string;
  grapthData?: unknown;
  graphData?: unknown;
  closePrice?: unknown;
};

/**
 * Today's NSE minute prices for an equity (via `getEquityIntradayData`).
 * Client aggregates to 1H candles.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const symbol = searchParams.get('symbol')?.trim().toUpperCase() ?? '';
  if (symbol.length < 1) {
    return NextResponse.json({ error: 'symbol required' }, { status: 400 });
  }

  try {
    const raw = (await getNseIndiaClient().getEquityIntradayData(symbol)) as IntradayPayload;
    const graph = raw.grapthData ?? raw.graphData;
    const minutes = parseNseEquityIntradayGraph(graph);
    return NextResponse.json({
      symbol,
      name: typeof raw.name === 'string' ? raw.name : symbol,
      closePrice: typeof raw.closePrice === 'number' ? raw.closePrice : null,
      minutes,
    });
  } catch (error) {
    console.error('[GET /api/nse/equity-intraday]', error);
    const message = error instanceof Error ? error.message : 'Intraday fetch failed';
    return NextResponse.json({ error: 'Intraday fetch failed', detail: message }, { status: 502 });
  }
}
