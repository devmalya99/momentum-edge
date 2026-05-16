import { computeKellyAllocation } from '@/position-analysis/core/computeKellyAllocation';
import { computePositionSizing } from '@/position-analysis/core/computePositionSizing';
import { tradeDecisionSchema } from '@/position-analysis/schema/outputSchema';
import type { PositionParameters, TradeDecision } from '@/position-analysis/types';

// Buckets Kelly allocation (0–1) into a coarse label for copy / UI.
function getRiskLevel(allocation: number): 'safe' | 'moderate' | 'aggressive' {
  console.log('allocation', allocation);
  if (allocation <= 0.01) return 'safe';
  if (allocation <= 0.02) return 'moderate';
  return 'aggressive';
}

function computeTradeDecisionInternal(params: PositionParameters): TradeDecision {
  // 1) Statistical edge after costs — no trade if Kelly says there is no positive edge.
  const kelly = computeKellyAllocation({
    winRatePercent: params.winRate,
    averageWin: params.averageWin,
    averageLoss: params.averageLoss,
    feesPerTrade: params.feesPerTrade,
    taxRatePercent: params.taxRate,
  });

  console.log('kelly', kelly);

  if (!kelly.isValid) {
    return {
      decision: 'DO_NOT_TRADE',
      reason: kelly.reason,
    };
  }

  // 2) Capital and stop rules — size the book; invalid inputs mirror computePositionSizing nulls.
  const pos = computePositionSizing(params);

  if (!pos) {
    return {
      decision: 'DO_NOT_TRADE',
      reason: 'Invalid position sizing inputs.',
    };
  }

  // 3) Single object combining edge (Kelly) and execution size (stop-based notional).
  return {
    decision: 'TRADE',
    allocation: kelly.allocation,
    positionSize: pos.recommendedPositionSize,
    maxLoss: pos.maxLoss,
    percentOfCapital: pos.percentOfCapital,
    riskLevel: getRiskLevel(kelly.allocation),
  };
}

export function computeTradeDecision(params: PositionParameters): TradeDecision {
  const result = computeTradeDecisionInternal(params);

  // Dev/test only: assert the pipeline matches the Zod contract; skip in production to avoid extra work.
  if (process.env.NODE_ENV !== 'production') {
    const parsed = tradeDecisionSchema.safeParse(result);
    if (!parsed.success) {
      console.error(parsed.error);
      throw new Error('Invalid TradeDecision output');
    }
  }

  return result;
}
