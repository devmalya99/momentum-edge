import { describe, expect, it } from 'vitest';

import {
  computeKellyAllocation,
  EDGE_FAIL_REASON,
} from '@/position-analysis/core/computeKellyAllocation';

// Expected numbers below are fixed reference values — not derived from the implementation in this file.

describe('computeKellyAllocation', () => {
  describe('happy path (realistic profitable system)', () => {
    it('returns valid Half-Kelly allocation with correct net figures and odds', () => {
      const result = computeKellyAllocation({
        winRatePercent: 55,
        averageWin: 2000,
        averageLoss: 1000,
      });

      expect(result.isValid).toBe(true);
      if (!result.isValid) return;

      expect(result.netWin).toBe(1400);
      expect(result.netLoss).toBe(1200);
      expect(result.odds).toBeCloseTo(1.1666666667, 4);
      expect(result.allocation).toBeGreaterThan(0);
      // Half-Kelly on this setup: 0.08214285714285715 (reference)
      expect(result.allocation).toBeCloseTo(0.08214285714285715, 10);
    });
  });

  describe('edge destroyed by costs', () => {
    it('returns invalid when Kelly fraction is not positive after costs', () => {
      const result = computeKellyAllocation({
        winRatePercent: 50,
        averageWin: 1000,
        averageLoss: 1000,
      });

      expect(result.isValid).toBe(false);
      if (result.isValid) return;
      expect(result.reason).toBe(EDGE_FAIL_REASON);
    });

    it('rejects scenarios where netWin is positive but odds are too poor for positive Kelly', () => {
      const result = computeKellyAllocation({
        winRatePercent: 55,
        averageWin: 251,
        averageLoss: 1000,
      });

      expect(result.isValid).toBe(false);
      if (result.isValid) return;
      expect(result.reason).toBe(EDGE_FAIL_REASON);
    });

    it('rejects scenarios where edge is too small after half-kelly adjustment', () => {
      const result = computeKellyAllocation({
        winRatePercent: 51,
        averageWin: 1000,
        averageLoss: 1000,
      });

      expect(result.isValid).toBe(false);
      if (result.isValid) return;
      expect(result.reason).toBe(EDGE_FAIL_REASON);
    });
  });

  describe('net win becomes negative after tax + fees', () => {
    it('returns invalid when average win is too small after 20% tax and ₹200 fee', () => {
      const result = computeKellyAllocation({
        winRatePercent: 55,
        averageWin: 200,
        averageLoss: 1000,
      });

      expect(result.isValid).toBe(false);
      if (result.isValid) return;
      expect(result.reason).toBe(EDGE_FAIL_REASON);
    });
  });

  describe('zero or invalid inputs', () => {
    it('rejects winRatePercent = 0', () => {
      const result = computeKellyAllocation({
        winRatePercent: 0,
        averageWin: 5000,
        averageLoss: 1000,
      });
      expect(result.isValid).toBe(false);
      if (result.isValid) return;
      expect(result.reason).toBe(EDGE_FAIL_REASON);
    });

    it('rejects winRatePercent > 100', () => {
      const result = computeKellyAllocation({
        winRatePercent: 101,
        averageWin: 5000,
        averageLoss: 1000,
      });
      expect(result.isValid).toBe(false);
      if (result.isValid) return;
      expect(result.reason).toBe(EDGE_FAIL_REASON);
    });

    it('rejects averageLoss = 0 (unrealistic; would distort odds)', () => {
      const result = computeKellyAllocation({
        winRatePercent: 55,
        averageWin: 2000,
        averageLoss: 0,
      });
      expect(result.isValid).toBe(false);
      if (result.isValid) return;
      expect(result.reason).toBe(EDGE_FAIL_REASON);
    });

    it('rejects negative averageWin', () => {
      const result = computeKellyAllocation({
        winRatePercent: 50,
        averageWin: -100,
        averageLoss: 500,
      });
      expect(result.isValid).toBe(false);
      if (result.isValid) return;
      expect(result.reason).toBe(EDGE_FAIL_REASON);
    });

    it('rejects negative averageLoss', () => {
      const result = computeKellyAllocation({
        winRatePercent: 50,
        averageWin: 2000,
        averageLoss: -100,
      });
      expect(result.isValid).toBe(false);
      if (result.isValid) return;
      expect(result.reason).toBe(EDGE_FAIL_REASON);
    });
  });

  describe('boundary conditions', () => {
    it('handles winRatePercent = 100 with high win and low loss without NaN or Infinity', () => {
      const result = computeKellyAllocation({
        winRatePercent: 100,
        averageWin: 5_000_000,
        averageLoss: 1,
      });

      expect(result.isValid).toBe(true);
      if (!result.isValid) return;

      expect(Number.isFinite(result.allocation)).toBe(true);
      expect(Number.isFinite(result.odds)).toBe(true);
      expect(result.allocation).toBeLessThanOrEqual(0.25);
      expect(result.allocation).toBeGreaterThan(0);
      // 100% wins → Half-Kelly 0.5 raw, capped at 25% risk limit
      expect(result.allocation).toBeCloseTo(0.25, 10);
    });

    it('does not produce Infinity when loss side is minimal but finite', () => {
      const result = computeKellyAllocation({
        winRatePercent: 60,
        averageWin: 100_000,
        averageLoss: 0.01,
      });

      expect(result.isValid).toBe(true);
      if (!result.isValid) return;
      expect(Number.isFinite(result.odds)).toBe(true);
      expect(Number.isFinite(result.allocation)).toBe(true);
      expect(result.allocation).toBeLessThanOrEqual(0.25);
    });
  });

  describe('precision', () => {
    it('matches allocation to 4 decimal places for a fixed reference scenario', () => {
      const result = computeKellyAllocation({
        winRatePercent: 55,
        averageWin: 2000,
        averageLoss: 1000,
      });

      expect(result.isValid).toBe(true);
      if (!result.isValid) return;

      const rounded4 = Math.round(result.allocation * 10_000) / 10_000;
      expect(rounded4).toBe(0.0821);
    });

    it('does not produce scientific notation or unstable floats', () => {
      const result = computeKellyAllocation({
        winRatePercent: 55,
        averageWin: 2000,
        averageLoss: 1000,
      });

      expect(result.isValid).toBe(true);
      if (!result.isValid) return;

      expect(result.allocation.toString()).not.toContain('e');
    });
  });

  describe('return shape', () => {
    it('invalid branch has isValid and reason only', () => {
      const result = computeKellyAllocation({
        winRatePercent: 40,
        averageWin: 500,
        averageLoss: 2000,
      });

      expect(result.isValid).toBe(false);
      if (result.isValid) return;
      expect('reason' in result).toBe(true);
      expect(result.reason).toBe(EDGE_FAIL_REASON);
    });

    it('valid branch exposes allocation, netWin, netLoss, odds', () => {
      const result = computeKellyAllocation({
        winRatePercent: 55,
        averageWin: 2000,
        averageLoss: 1000,
      });

      expect(result.isValid).toBe(true);
      if (!result.isValid) return;

      expect(result).toMatchObject({
        isValid: true,
        netWin: 1400,
        netLoss: 1200,
      });
      expect(typeof result.allocation).toBe('number');
      expect(typeof result.odds).toBe('number');
    });
  });
});

describe('risk controls', () => {
  it('caps allocation at max safe threshold (e.g. 25%)', () => {
    const result = computeKellyAllocation({
      winRatePercent: 90,
      averageWin: 100000,
      averageLoss: 100,
    });

    expect(result.isValid).toBe(true);
    if (!result.isValid) return;

    expect(result.allocation).toBeLessThanOrEqual(0.25);
  });
});
