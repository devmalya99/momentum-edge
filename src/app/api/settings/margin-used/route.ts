import { NextResponse } from 'next/server';
import { getSessionFromCookies } from '@/lib/auth/server-session';
import {
  getUserNetworthMaster,
  updateMarginAmountAndRecomputeFromHoldings,
} from '@/lib/db/user-networth-master';

export async function GET() {
  try {
    const session = await getSessionFromCookies();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const master = await getUserNetworthMaster(session.sub);
    const brokerMarginUsed = master.marginAmount;
    return NextResponse.json({ brokerMarginUsed });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch margin settings';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await getSessionFromCookies();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const payload = (await request.json()) as { brokerMarginUsed?: unknown };
    const rawValue = Number(payload.brokerMarginUsed);
    const brokerMarginUsed = Number.isFinite(rawValue) && rawValue > 0 ? rawValue : 0;
    const master = await updateMarginAmountAndRecomputeFromHoldings(session.sub, brokerMarginUsed);
    return NextResponse.json({
      ok: true,
      brokerMarginUsed: master.marginAmount,
      master,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to save margin settings';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
