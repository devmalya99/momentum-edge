import { NextResponse } from 'next/server';
import { nseFetchJson } from '@/lib/nse-fetch';

export const dynamic = 'force-dynamic';

const NSE_52W_HIGH_URL = 'https://www.nseindia.com/api/live-analysis-data-52weekhighstock';

export type Nse52wScannerRow = {
  symbol: string;
  series?: string;
  comapnyName?: string;
  new52WHL?: number;
  prev52WHL?: number;
  prevHLDate?: string;
  ltp?: number;
  prevClose?: number | string;
  change?: number;
  pChange?: number;
};

export type Nse52wScannerResponse = {
  high?: number;
  data?: Nse52wScannerRow[];
  timestamp?: string;
};

export async function GET() {
  try {
    const result = await nseFetchJson<Nse52wScannerResponse>(NSE_52W_HIGH_URL);
    if (!result.ok) {
      return NextResponse.json(
        {
          error: `NSE responded with ${result.status}`,
          detail: result.detail,
        },
        { status: result.status >= 500 ? 502 : 400 },
      );
    }

    return NextResponse.json(result.data);
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
