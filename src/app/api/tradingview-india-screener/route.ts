import { NextResponse } from 'next/server';
import { fetchTradingViewIndiaScreenerStockScan } from '@/lib/tradingview-india-screener';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const screen = new URL(request.url).searchParams.get('screen');
    const data = await fetchTradingViewIndiaScreenerStockScan({
      silent: true,
      screen: screen === 'short-term-pullback' ? 'short-term-pullback' : 'monthly',
    });
    return NextResponse.json(data);
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
