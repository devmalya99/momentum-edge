import { NextResponse } from 'next/server';
import { getSessionFromCookies } from '@/lib/auth/server-session';
import { requirePremiumMembership } from '@/lib/membership/server';
import { businessAnalysisSummariesRequestSchema, businessAnalysisSummariesResponseSchema } from '@/lib/ai/business-analysis';
import { listAiBusinessAnalysisSummaries } from '@/lib/db/ai-business-analysis-cache';

const API_TAG = '[api/ai/business-analysis/summaries]';

export async function POST(request: Request) {
  try {
    const session = await getSessionFromCookies();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const premiumGate = await requirePremiumMembership(session.sub);
    if (premiumGate) return premiumGate;

    const payload = businessAnalysisSummariesRequestSchema.parse(await request.json());
    const rows = await listAiBusinessAnalysisSummaries(payload.tickers);
    const nowMs = Date.now();

    const response = businessAnalysisSummariesResponseSchema.parse({
      summaries: rows.map((row) => {
        const staleAfterMs = Date.parse(row.staleAfter);
        const isStale = Number.isNaN(staleAfterMs) ? true : staleAfterMs <= nowMs;
        return {
          ticker: row.ticker,
          category: row.category,
          compositeScore: row.compositeScore,
          direction: row.direction,
          previousCategory: row.previousCategory ?? undefined,
          previousCompositeScore: row.previousCompositeScore ?? undefined,
          ratingReasons: row.ratingReasons.slice(0, 4),
          isStale,
        };
      }),
    });

    return NextResponse.json(response);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Failed to load business analysis summaries';
    console.error(`${API_TAG} failed: ${message}`);
    return NextResponse.json({ error: 'Failed to load business analysis summaries' }, { status: 400 });
  }
}
