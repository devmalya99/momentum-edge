import { NextResponse } from 'next/server';
import { getNseIndiaClient } from '@/lib/nse-india-singleton';
import { fetchIndexGraphChartPayload } from '@/lib/nse-index-graph-chart';
import { indexGraphChartPayloadToDailyBars } from '@/lib/nse-index-graph-bars';

export const dynamic = 'force-dynamic';

const FLAGS = new Set(['1D', '5D', '1M', '3M', '6M', '1Y', '3Y', '5Y', 'MAX']);

/**
 * Daily-ish index points via NSE `getGraphChart` (close-only series → OHLC equal in client).
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const index = searchParams.get('index')?.trim() ?? '';
  const flagRaw = searchParams.get('flag')?.trim().toUpperCase() ?? '5Y';
  const flag = FLAGS.has(flagRaw) ? flagRaw : '5Y';

  if (index.length < 2) {
    return NextResponse.json({ error: 'index required' }, { status: 400 });
  }

  try {
    const client = getNseIndiaClient();
    const { payload: raw } = await fetchIndexGraphChartPayload(client, index, flag);
    const bars = indexGraphChartPayloadToDailyBars(raw);
    return NextResponse.json({ index, flag, bars });
  } catch (error) {
    console.error('[GET /api/nse/index-historical]', error);
    const message = error instanceof Error ? error.message : 'Index historical fetch failed';
    return NextResponse.json({ error: 'Index historical fetch failed', detail: message }, { status: 502 });
  }
}
