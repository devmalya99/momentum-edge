import { NextResponse } from 'next/server';
import { getSessionFromCookies } from '@/lib/auth/server-session';
import {
  getUserNetworthMaster,
  updateAllocatedTradingCapital,
} from '@/lib/db/user-networth-master';

export async function GET() {
  try {
    const session = await getSessionFromCookies();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const master = await getUserNetworthMaster(session.sub);
    return NextResponse.json({ allocatedTradingCapital: master.allocatedTradingCapital });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Failed to fetch allocated trading capital';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await getSessionFromCookies();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const payload = (await request.json()) as { allocatedTradingCapital?: unknown };
    const raw = Number(payload.allocatedTradingCapital);
    const allocatedTradingCapital = Number.isFinite(raw) && raw > 0 ? raw : 0;
    const master = await updateAllocatedTradingCapital(session.sub, allocatedTradingCapital);
    return NextResponse.json({
      ok: true,
      allocatedTradingCapital: master.allocatedTradingCapital,
      master,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Failed to save allocated trading capital';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
