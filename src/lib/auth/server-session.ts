import { cookies } from 'next/headers';
import { AUTH_COOKIE_NAME, verifySessionToken } from '@/lib/auth/session';

export async function getSessionFromCookies() {
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_COOKIE_NAME)?.value;
  if (!token) return null;
  return verifySessionToken(token);
}
