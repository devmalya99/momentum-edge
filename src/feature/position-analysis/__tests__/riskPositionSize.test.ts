import { describe, expect, it } from 'vitest';

import {
  computeRiskPositionSize,
  MAX_RISK_PERCENT,
} from '@/position-analysis/core/computeRiskPositionSize';

describe('computeRiskPositionSize', () => {
  it('calculates risk amount and position size using risk and stop loss percent', () => {
    const result = computeRiskPositionSize({
      capital: 100_000,
      riskPercent: 1,
      stopLossPercent: 3,
    });

    expect(result).not.toBeNull();
    expect(result?.riskAmount).toBe(1_000);
    expect(result?.positionSize).toBeCloseTo(33333.33, 2);
    expect(result?.exceedsCapital).toBe(false);
  });

  it('caps risk above 2 percent', () => {
    const result = computeRiskPositionSize({
      capital: 100_000,
      riskPercent: 3,
      stopLossPercent: 3,
    });

    expect(result).not.toBeNull();
    expect(result?.effectiveRiskPercent).toBe(MAX_RISK_PERCENT);
    expect(result?.isRiskCapped).toBe(true);
    expect(result?.riskAmount).toBe(2_000);
  });

  it('returns quantity when entry price is provided', () => {
    const result = computeRiskPositionSize({
      capital: 100_000,
      riskPercent: 1,
      stopLossPercent: 3,
      entryPrice: 500,
    });

    expect(result?.quantity).toBeCloseTo(66.67, 2);
  });

  it('returns null for invalid stop loss', () => {
    const result = computeRiskPositionSize({
      capital: 100_000,
      riskPercent: 1,
      stopLossPercent: 0,
    });

    expect(result).toBeNull();
  });
});
