import { NextResponse } from 'next/server';
import { getSessionFromCookies } from '@/lib/auth/server-session';
import { buildAppUrl } from '@/lib/app-origin';

export async function GET() {
  const session = await getSessionFromCookies();
  if (!session) {
    return NextResponse.redirect(buildAppUrl('/login'));
  }

  const apiKey = process.env.ZERODHA_API_KEY?.trim();
  if (!apiKey) {
    return NextResponse.redirect(buildAppUrl('/profile?kite=error'));
  }

  const kiteLoginUrl = new URL('https://kite.zerodha.com/connect/login');
  kiteLoginUrl.searchParams.set('v', '3');
  kiteLoginUrl.searchParams.set('api_key', apiKey);

  return NextResponse.redirect(kiteLoginUrl);
}
