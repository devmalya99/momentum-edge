import { describe, expect, it } from 'vitest';

import { computeTradeDecision } from '@/position-analysis/core/computeTradeDecision';
import { defaultPositionParameters } from '@/position-analysis/schema/inputSchema';
import { tradeDecisionSchema } from '@/position-analysis/schema/outputSchema';

describe('computeTradeDecision', () => {
  it('returns TRADE with fields that satisfy tradeDecisionSchema (dev validation)', () => {
    const params = {
      ...defaultPositionParameters,
      totalCapital: 100_000,
      stopLossModel: 'percent' as const,
      stopLossPercent: 3,
      winRate: 55,
      averageWin: 2000,
      averageLoss: 1000,
      feesPerTrade: 200,
      taxRate: 20,
    };

    const result = computeTradeDecision(params);

    expect(result.decision).toBe('TRADE');
    if (result.decision !== 'TRADE') return;

    expect(tradeDecisionSchema.safeParse(result).success).toBe(true);
    expect(result.positionSize).toBeGreaterThan(0);
    expect(result.allocation).toBeGreaterThan(0);
    expect(result.allocation).toBeLessThanOrEqual(1);
    expect(result.percentOfCapital).toBeGreaterThanOrEqual(0);
    expect(result.percentOfCapital).toBeLessThanOrEqual(100);
  });

  it('returns DO_NOT_TRADE when Kelly edge is invalid', () => {
    const result = computeTradeDecision({
      ...defaultPositionParameters,
      totalCapital: 100_000,
      stopLossModel: 'percent',
      stopLossPercent: 3,
      winRate: 50,
      averageWin: 1000,
      averageLoss: 1000,
    });

    expect(result.decision).toBe('DO_NOT_TRADE');
    if (result.decision !== 'DO_NOT_TRADE') return;
    expect(result.reason.length).toBeGreaterThan(0);
    expect(tradeDecisionSchema.safeParse(result).success).toBe(true);
  });

  it('returns DO_NOT_TRADE when position sizing inputs are unusable', () => {
    const result = computeTradeDecision({
      ...defaultPositionParameters,
      totalCapital: 100_000,
      stopLossModel: 'percent',
      stopLossPercent: 0,
      winRate: 55,
      averageWin: 2000,
      averageLoss: 1000,
    });

    expect(result.decision).toBe('DO_NOT_TRADE');
    if (result.decision !== 'DO_NOT_TRADE') return;
    expect(result.reason).toBe('Invalid position sizing inputs.');
  });
});
