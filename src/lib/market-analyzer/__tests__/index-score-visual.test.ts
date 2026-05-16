import { describe, expect, it } from 'vitest';
import { groupIndexesByPositionSize } from '@/lib/market-analyzer/index-score-visual';
import type { IndexScoreEntry } from '@/features/market-analyzer/types/index-scores';

describe('groupIndexesByPositionSize', () => {
  it('orders tiers from highest position size to lowest with pending last', () => {
    const scores: Record<string, IndexScoreEntry> = {
      NIFTY_50: {
        positionSizingGuidance: '25%',
        verdict: 'Momentum',
        fetchedAt: '2026-05-15T00:00:00.000Z',
      },
      NIFTY_IT: {
        positionSizingGuidance: '0%',
        verdict: 'Breakdown',
        fetchedAt: '2026-05-15T00:00:00.000Z',
      },
    };

    const groups = groupIndexesByPositionSize(scores);
    expect(groups[0]?.tier).toBe('25%');
    expect(groups.some((g) => g.tier === '0%')).toBe(true);
    expect(groups[groups.length - 1]?.tier).toBe('pending');
  });
});
