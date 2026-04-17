import { NextRequest, NextResponse } from 'next/server';
import { AUTH_COOKIE_NAME, verifySessionToken } from '@/lib/auth/session';

const PUBLIC_AUTH_PAGES = new Set(['/login', '/signup']);

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get(AUTH_COOKIE_NAME)?.value;
  const session = token ? await verifySessionToken(token) : null;

  const isProtectedAppPath =
    pathname.startsWith('/dashboard') ||
    pathname.startsWith('/entry') ||
    pathname.startsWith('/rules') ||
    pathname.startsWith('/networth') ||
    pathname.startsWith('/analytics') ||
    pathname.startsWith('/market-view') ||
    pathname.startsWith('/52w-scanner') ||
    pathname.startsWith('/watchlist') ||
    pathname.startsWith('/mtf-checker') ||
    pathname.startsWith('/settings') ||
    pathname.startsWith('/stock-charts') ||
    pathname.startsWith('/profile');

  if (isProtectedAppPath && !session) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  if (PUBLIC_AUTH_PAGES.has(pathname) && session) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
