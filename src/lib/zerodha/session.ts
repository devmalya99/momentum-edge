import { NextResponse } from 'next/server';

export const ZERODHA_ACCESS_TOKEN_COOKIE_NAME = 'zerodha_access_token';

export function setZerodhaAccessTokenCookie(response: NextResponse, token: string): void {
  response.cookies.set({
    name: ZERODHA_ACCESS_TOKEN_COOKIE_NAME,
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24,
  });
}

export function clearZerodhaAccessTokenCookie(response: NextResponse): void {
  response.cookies.set({
    name: ZERODHA_ACCESS_TOKEN_COOKIE_NAME,
    value: '',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });
}
