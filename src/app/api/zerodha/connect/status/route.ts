import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { getSessionFromCookies } from '@/lib/auth/server-session';
import { ZERODHA_ACCESS_TOKEN_COOKIE_NAME } from '@/lib/zerodha/session';

export async function GET() {
  const session = await getSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const cookieStore = await cookies();
  const accessToken = cookieStore.get(ZERODHA_ACCESS_TOKEN_COOKIE_NAME)?.value?.trim();

  return NextResponse.json({
    connected: Boolean(accessToken),
  });
}
