import { NextResponse } from 'next/server';
import { getSessionFromCookies } from '@/lib/auth/server-session';
import { getUserNetworthMaster, updateRealInvestFromBank } from '@/lib/db/user-networth-master';

export async function GET() {
  try {
    const session = await getSessionFromCookies();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const master = await getUserNetworthMaster(session.sub);
    return NextResponse.json({ realInvestFromBank: master.realInvestFromBank });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await getSessionFromCookies();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const payload = (await request.json()) as { realInvestFromBank?: unknown };
    if (payload.realInvestFromBank === undefined) {
      return NextResponse.json({ error: 'realInvestFromBank is required' }, { status: 400 });
    }
    const raw = Number(payload.realInvestFromBank);
    if (!Number.isFinite(raw) || raw < 0) {
      return NextResponse.json(
        { error: 'realInvestFromBank must be a finite number ≥ 0' },
        { status: 400 },
      );
    }
    const master = await updateRealInvestFromBank(session.sub, raw);
    return NextResponse.json({ ok: true, realInvestFromBank: master.realInvestFromBank, master });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to save';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
