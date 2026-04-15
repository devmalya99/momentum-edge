import { NextResponse } from 'next/server';
import { syncAdRatioTodayIfChanged } from '@/lib/ad-ratio-sync';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

async function runSyncOnLoad(): Promise<NextResponse> {
  const result = await syncAdRatioTodayIfChanged();
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error, detail: result.detail },
      { status: result.status },
    );
  }
  return NextResponse.json(result);
}

export async function POST() {
  try {
    return await runSyncOnLoad();
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
