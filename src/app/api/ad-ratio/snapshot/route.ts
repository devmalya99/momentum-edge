import { NextResponse } from 'next/server';
import { syncAdRatioToday } from '@/lib/ad-ratio-sync';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

function authorize(request: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (process.env.NODE_ENV === 'production') {
    if (!secret) {
      return false;
    }
    const auth = request.headers.get('authorization');
    if (auth === `Bearer ${secret}`) return true;
    const url = new URL(request.url);
    return url.searchParams.get('secret') === secret;
  }
  if (!secret) return true;
  const auth = request.headers.get('authorization');
  if (auth === `Bearer ${secret}`) return true;
  const url = new URL(request.url);
  return url.searchParams.get('secret') === secret;
}

async function runSnapshot(): Promise<NextResponse> {
  const result = await syncAdRatioToday({ force: true });
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error, detail: result.detail },
      { status: result.status },
    );
  }

  return NextResponse.json(result);
}

export async function GET(request: Request) {
  if (!authorize(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    return await runSnapshot();
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  if (!authorize(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    return await runSnapshot();
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
