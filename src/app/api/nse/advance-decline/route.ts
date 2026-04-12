import { NextResponse } from 'next/server';
import { nseFetchJson } from '@/lib/nse-fetch';

const NSE_ADVANCE_URL = 'https://www.nseindia.com/api/live-analysis-advance';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const result = await nseFetchJson(NSE_ADVANCE_URL);
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
