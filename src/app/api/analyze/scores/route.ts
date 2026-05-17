import { NextResponse } from 'next/server';
import { getSessionFromCookies } from '@/lib/auth/server-session';
import { listAiQuantamentalScores } from '@/lib/db/ai-quantamental-cache';
import { requirePremiumMembership } from '@/lib/membership/server';
import {
  quantamentalScoresRequestSchema,
  quantamentalScoresResponseSchema,
} from '@/lib/validations/stock-schema';

const API_TAG = '[api/analyze/scores]';

export async function POST(request: Request) {
  try {
    const session = await getSessionFromCookies();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const premiumGate = await requirePremiumMembership(session.sub);
    if (premiumGate) return premiumGate;

    const validated = quantamentalScoresRequestSchema.parse(await request.json());
    const rows = await listAiQuantamentalScores(validated.tickers);
    const nowMs = Date.now();

    const payload = quantamentalScoresResponseSchema.parse({
      scores: rows.map((row) => {
        const staleAfterMs = Date.parse(row.staleAfter);
        const isStale = Number.isNaN(staleAfterMs) ? true : staleAfterMs <= nowMs;
        return {
          ticker: row.ticker,
          totalScore: Math.max(0, Math.min(100, Math.round(row.totalScore))),
          isStale,
        };
      }),
    });

    return NextResponse.json(payload);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load quantamental scores';
    console.error(`${API_TAG} failed: ${message}`);
    return NextResponse.json({ error: 'Failed to load quantamental scores' }, { status: 400 });
  }
}
