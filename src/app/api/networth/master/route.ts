import { NextResponse } from 'next/server';
import { getSessionFromCookies } from '@/lib/auth/server-session';
import { getUserNetworthMaster } from '@/lib/db/user-networth-master';

export async function GET() {
  try {
    const session = await getSessionFromCookies();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const master = await getUserNetworthMaster(session.sub);
    return NextResponse.json({ master });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch networth master';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
