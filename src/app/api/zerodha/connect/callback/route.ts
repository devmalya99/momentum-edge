import { createHash } from 'crypto';
import { NextResponse } from 'next/server';
import { buildAppUrl } from '@/lib/app-origin';
import { getSessionFromCookies } from '@/lib/auth/server-session';
import { setZerodhaAccessTokenCookie } from '@/lib/zerodha/session';

type KiteSessionTokenResponse = {
  status?: 'success' | 'error';
  message?: string;
  data?: {
    access_token?: string;
  };
};

export async function GET(request: Request) {
  const session = await getSessionFromCookies();
  if (!session) {
    return NextResponse.redirect(buildAppUrl('/login'));
  }

  const callbackUrl = new URL(request.url);
  const requestToken = callbackUrl.searchParams.get('request_token')?.trim();
  const loginStatus = callbackUrl.searchParams.get('status')?.trim();
  if (loginStatus !== 'success' || !requestToken) {
    return NextResponse.redirect(buildAppUrl('/profile?kite=error'));
  }

  const apiKey = process.env.ZERODHA_API_KEY?.trim();
  const apiSecret = process.env.ZERODHA_API_SECRET?.trim();
  if (!apiKey || !apiSecret) {
    return NextResponse.redirect(buildAppUrl('/profile?kite=error'));
  }

  const checksum = createHash('sha256')
    .update(`${apiKey}${requestToken}${apiSecret}`)
    .digest('hex');

  const formBody = new URLSearchParams({
    api_key: apiKey,
    request_token: requestToken,
    checksum,
  });

  const tokenResponse = await fetch('https://api.kite.trade/session/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'X-Kite-Version': '3',
    },
    body: formBody.toString(),
    cache: 'no-store',
  });

  const tokenJson = (await tokenResponse.json().catch(() => null)) as KiteSessionTokenResponse | null;
  const accessToken = tokenJson?.data?.access_token;
  if (!tokenResponse.ok || tokenJson?.status !== 'success' || !accessToken) {
    return NextResponse.redirect(buildAppUrl('/profile?kite=error'));
  }

  const response = NextResponse.redirect(buildAppUrl('/profile?kite=connected'));
  setZerodhaAccessTokenCookie(response, accessToken);
  return response;
}
