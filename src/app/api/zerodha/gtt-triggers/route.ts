import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { getSessionFromCookies } from '@/lib/auth/server-session';
import { ZERODHA_ACCESS_TOKEN_COOKIE_NAME } from '@/lib/zerodha/session';

type KiteListResponse = {
  status?: 'success' | 'error';
  message?: string;
  data?: unknown;
};

export async function GET(request: Request) {
  const session = await getSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const apiKey = process.env.ZERODHA_API_KEY?.trim();
  if (!apiKey) {
    return NextResponse.json({ error: 'ZERODHA_API_KEY is missing' }, { status: 500 });
  }

  const cookieStore = await cookies();
  const accessToken = cookieStore.get(ZERODHA_ACCESS_TOKEN_COOKIE_NAME)?.value?.trim();
  if (!accessToken) {
    return NextResponse.json(
      { error: 'Kite is not connected. Please connect from Profile first.' },
      { status: 400 },
    );
  }

  const requestUrl = new URL(request.url);
  const type = requestUrl.searchParams.get('type')?.trim() || 'single';
  const kiteUrl = new URL('https://api.kite.trade/gtt/triggers');
  kiteUrl.searchParams.set('type', type);

  const kiteResponse = await fetch(kiteUrl, {
    method: 'GET',
    headers: {
      'X-Kite-Version': '3',
      Authorization: `token ${apiKey}:${accessToken}`,
    },
    cache: 'no-store',
  });

  const kiteJson = (await kiteResponse.json().catch(() => null)) as KiteListResponse | null;
  if (!kiteResponse.ok || kiteJson?.status !== 'success') {
    return NextResponse.json(
      { error: kiteJson?.message ?? 'Failed to fetch GTT triggers from Kite' },
      { status: kiteResponse.status || 502 },
    );
  }

  return NextResponse.json({
    triggers: Array.isArray(kiteJson.data) ? kiteJson.data : [],
  });
}
