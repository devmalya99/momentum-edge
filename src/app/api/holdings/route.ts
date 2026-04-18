import { NextResponse } from 'next/server';
import { getSessionFromCookies } from '@/lib/auth/server-session';
import {
  listUserHoldings,
  replaceUserHoldings,
  updateUserHoldingTradeType,
  type UserHoldingInput,
} from '@/lib/db/holdings';
import { updateComputedFromHoldings } from '@/lib/db/user-networth-master';

function normalizeHoldings(input: unknown): UserHoldingInput[] | null {
  if (!Array.isArray(input)) return null;
  const out: UserHoldingInput[] = [];
  for (const item of input) {
    if (!item || typeof item !== 'object') return null;
    const row = item as Record<string, unknown>;
    const symbol = String(row.symbol ?? '').trim().toUpperCase();
    const quantity = Number(row.quantity);
    const averagePrice = Number(row.averagePrice ?? row.average_price);
    const previousClosePrice = Number(row.previousClosePrice ?? row.previous_close_price);
    if (!symbol) return null;
    if (!Number.isFinite(quantity) || quantity <= 0) return null;
    if (!Number.isFinite(averagePrice) || averagePrice <= 0) return null;
    if (!Number.isFinite(previousClosePrice) || previousClosePrice <= 0) return null;
    const ttRaw = row.tradeType ?? row.trade_type;
    const entry: UserHoldingInput = { symbol, quantity, averagePrice, previousClosePrice };
    if (ttRaw != null && String(ttRaw).trim()) {
      entry.tradeType = String(ttRaw).trim();
    }
    out.push(entry);
  }
  return out;
}

export async function GET() {
  try {
    const session = await getSessionFromCookies();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const holdings = await listUserHoldings(session.sub);
    return NextResponse.json({ holdings });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch holdings';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await getSessionFromCookies();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = (await request.json()) as { holdings?: unknown };
    const holdings = normalizeHoldings(payload.holdings);
    if (!holdings) {
      return NextResponse.json({ error: 'Invalid holdings payload' }, { status: 400 });
    }

    await replaceUserHoldings(session.sub, holdings);
    const investedGross = holdings.reduce((sum, row) => sum + row.quantity * row.averagePrice, 0);
    const currentHoldingValue = holdings.reduce(
      (sum, row) => sum + row.quantity * row.previousClosePrice,
      0,
    );
    const master = await updateComputedFromHoldings(session.sub, {
      investedGross,
      currentHoldingValue,
    });
    return NextResponse.json({ ok: true, count: holdings.length, master });
  } catch (error) {
    console.error('[POST /api/holdings] failed', error);
    const message = error instanceof Error ? error.message : 'Failed to save holdings';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/** Set `trade_type` (Kanban / portfolio bucket) for one symbol. */
export async function PATCH(request: Request) {
  try {
    const session = await getSessionFromCookies();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = (await request.json()) as { symbol?: unknown; tradeType?: unknown };
    const symbol = String(payload.symbol ?? '').trim().toUpperCase();
    if (!symbol) {
      return NextResponse.json({ error: 'Missing symbol' }, { status: 400 });
    }
    const raw = payload.tradeType;
    const tradeType =
      raw === null || raw === undefined || raw === '' ? null : String(raw).trim() || null;

    const updated = await updateUserHoldingTradeType(session.sub, symbol, tradeType);
    if (!updated) {
      return NextResponse.json({ error: 'Holding not found for symbol' }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update holding category';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
