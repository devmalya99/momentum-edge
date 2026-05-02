import { describe, expect, it } from 'vitest';

import {
  RISK_FRACTION_OF_CAPITAL,
  computePositionSizing,
  formatInr,
  formatPercentOfCapital,
} from '@/position-analysis/core/computePositionSizing';

import { defaultPositionParameters } from '@/position-analysis/schema/inputSchema';

// -----------------------------
// COMPUTE POSITION SIZING
// -----------------------------
describe('computePositionSizing', () => {
  it('computes correct position for 1% risk, 3% stop, ₹1L capital', () => {
    const result = computePositionSizing({
      ...defaultPositionParameters,
      totalCapital: 100_000,
      stopLossModel: 'percent',
      stopLossPercent: 3,
    });

    expect(result).not.toBeNull();

    expect(result!.maxLoss).toBe(1_000); // 1% of capital
    expect(result!.recommendedPositionSize).toBeCloseTo(33333.33, 2);
    expect(result!.percentOfCapital).toBeCloseTo(33.33, 2);
  });

  it('returns null when stop loss percent is zero', () => {
    const result = computePositionSizing({
      ...defaultPositionParameters,
      totalCapital: 100_000,
      stopLossPercent: 0,
    });

    expect(result).toBeNull();
  });

  it('returns null when stop loss percent is negative', () => {
    const result = computePositionSizing({
      ...defaultPositionParameters,
      stopLossPercent: -5,
    });

    expect(result).toBeNull();
  });

  it('returns null when capital is zero', () => {
    const result = computePositionSizing({
      ...defaultPositionParameters,
      totalCapital: 0,
    });

    expect(result).toBeNull();
  });

  it('handles high stop loss correctly (100%)', () => {
    const result = computePositionSizing({
      ...defaultPositionParameters,
      totalCapital: 100_000,
      stopLossPercent: 100,
    });

    expect(result).not.toBeNull();
    expect(result!.recommendedPositionSize).toBe(1_000); // risk = position
    expect(result!.percentOfCapital).toBeCloseTo(1, 2);
  });
});

// -----------------------------
// CONSTANTS
// -----------------------------
describe('constants', () => {
  it('uses 1% risk per trade', () => {
    expect(RISK_FRACTION_OF_CAPITAL).toBeCloseTo(0.01);
  });
});

// -----------------------------
// FORMAT INR
// -----------------------------
describe('formatInr', () => {
  it('formats numbers with rupee symbol and Indian grouping', () => {
    expect(formatInr(33333)).toBe('₹33,333');
  });

  it('handles large numbers correctly', () => {
    expect(formatInr(1234567)).toBe('₹12,34,567');
  });

  it('handles zero correctly', () => {
    expect(formatInr(0)).toBe('₹0');
  });
});

// -----------------------------
// FORMAT PERCENT
// -----------------------------
describe('formatPercentOfCapital', () => {
  it('formats decimal values to one decimal place', () => {
    expect(formatPercentOfCapital(33.333)).toBe('33.3% of capital');
  });

  it('formats whole numbers without decimal', () => {
    expect(formatPercentOfCapital(25)).toBe('25% of capital');
  });

  it('rounds correctly', () => {
    expect(formatPercentOfCapital(33.36)).toBe('33.4% of capital');
  });
});
