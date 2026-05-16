import { NextResponse } from 'next/server';
import { unstable_cache } from 'next/cache';
import { VIX_HISTORY_REVALIDATE_SECONDS } from '@/features/vix-tracker/constants';
import { fetchVixHistoryPayload, VIX_CHART_SESSIONS } from '@/lib/nse-vix-history';

export const revalidate = 2600;

const getVixHistoryCached = unstable_cache(
  async (sessions: number) => fetchVixHistoryPayload(sessions),
  ['nse-vix-history'],
  { revalidate: VIX_HISTORY_REVALIDATE_SECONDS },
);

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const sessionsRaw = searchParams.get('sessions');
  const sessions =
    sessionsRaw != null && sessionsRaw.trim() !== ''
      ? Math.min(120, Math.max(10, parseInt(sessionsRaw, 10) || VIX_CHART_SESSIONS))
      : VIX_CHART_SESSIONS;

  try {
    const payload = await getVixHistoryCached(sessions);
    return NextResponse.json(payload, {
      headers: {
        'Cache-Control': `public, max-age=${VIX_HISTORY_REVALIDATE_SECONDS}, s-maxage=${VIX_HISTORY_REVALIDATE_SECONDS}, stale-while-revalidate=600`,
      },
    });
  } catch (error) {
    console.error('[GET /api/nse/vix-history]', error);
    const message = error instanceof Error ? error.message : 'VIX history fetch failed';
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
