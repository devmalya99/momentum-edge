import { NextResponse } from 'next/server';
import { getSessionFromCookies } from '@/lib/auth/server-session';
import { requirePremiumMembership } from '@/lib/membership/server';
import {
  quickAiCheckSummariesRequestSchema,
  quickAiCheckSummariesResponseSchema,
} from '@/lib/ai/quick-ai-check';
import { listAiQuickAiCheckSummaries } from '@/lib/db/ai-quick-ai-check-cache';

const API_TAG = '[api/ai/quick-ai-check/summaries]';

export async function POST(request: Request) {
  try {
    const session = await getSessionFromCookies();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const premiumGate = await requirePremiumMembership(session.sub);
    if (premiumGate) return premiumGate;

    const payload = quickAiCheckSummariesRequestSchema.parse(await request.json());
    const rows = await listAiQuickAiCheckSummaries(payload.tickers);
    const nowMs = Date.now();

    const response = quickAiCheckSummariesResponseSchema.parse({
      summaries: rows.map((row) => {
        const staleAfterMs = Date.parse(row.staleAfter);
        const isStale = Number.isNaN(staleAfterMs) ? true : staleAfterMs <= nowMs;
        return {
          ticker: row.ticker,
          category: row.category,
          ratingReasons: row.ratingReasons.slice(0, 4),
          isStale,
        };
      }),
    });

    return NextResponse.json(response);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Failed to load business evaluation summaries';
    console.error(`${API_TAG} failed: ${message}`);
    return NextResponse.json({ error: 'Failed to load business evaluation summaries' }, { status: 400 });
  }
}
