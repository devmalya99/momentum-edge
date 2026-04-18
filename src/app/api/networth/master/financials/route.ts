import { NextResponse } from 'next/server';
import { getSessionFromCookies } from '@/lib/auth/server-session';
import { updateMasterFinancialField } from '@/lib/db/user-networth-master';

type FinancialField = 'duePayables' | 'receivables' | 'ppf' | 'liquidFund';

function mapFieldToDbColumn(field: FinancialField) {
  if (field === 'duePayables') return 'totalCreditCardDue' as const;
  if (field === 'receivables') return 'receivables' as const;
  if (field === 'ppf') return 'ppfAmount' as const;
  return 'liquidFundInvestment' as const;
}

export async function PATCH(request: Request) {
  try {
    const session = await getSessionFromCookies();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = (await request.json()) as {
      field?: unknown;
      value?: unknown;
    };
    const field = payload.field;
    const rawValue = Number(payload.value);

    if (
      field !== 'duePayables' &&
      field !== 'receivables' &&
      field !== 'ppf' &&
      field !== 'liquidFund'
    ) {
      return NextResponse.json({ error: 'Invalid field' }, { status: 400 });
    }
    if (!Number.isFinite(rawValue) || rawValue < 0) {
      return NextResponse.json({ error: 'value must be a finite number >= 0' }, { status: 400 });
    }

    const master = await updateMasterFinancialField(
      session.sub,
      mapFieldToDbColumn(field),
      rawValue,
    );

    return NextResponse.json({ ok: true, master });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to save financial field';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
