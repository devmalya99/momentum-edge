import { describe, expect, it } from 'vitest';

import { defaultPositionParameters, inputSchema } from '@/position-analysis/schema/inputSchema';

describe('inputSchema (percentage-based)', () => {
  it('accepts default fixture values', () => {
    const r = inputSchema.safeParse(defaultPositionParameters);
    expect(r.success).toBe(true);
  });

  // -------------------------
  // WIN RATE
  // -------------------------
  describe('winRate (%)', () => {
    it('accepts values between 0 and 100', () => {
      [0, 25, 50, 100].forEach((val) => {
        const r = inputSchema.safeParse({
          ...defaultPositionParameters,
          winRate: val,
        });
        expect(r.success).toBe(true);
      });
    });

    it('rejects values above 100', () => {
      const r = inputSchema.safeParse({
        ...defaultPositionParameters,
        winRate: 101,
      });
      expect(r.success).toBe(false);
      expect(r.error?.issues[0].path).toContain('winRate');
    });

    it('rejects negative values', () => {
      const r = inputSchema.safeParse({
        ...defaultPositionParameters,
        winRate: -1,
      });
      expect(r.success).toBe(false);
    });

    it('rejects decimal-style inputs (e.g. 0.55)', () => {
      const r = inputSchema.safeParse({
        ...defaultPositionParameters,
        winRate: 0.55,
      });
      expect(r.success).toBe(false);
    });
  });

  // -------------------------
  // STOP LOSS
  // -------------------------
  describe('stopLossPercent (%)', () => {
    it('accepts valid percentage values', () => {
      [0.5, 1, 3, 50, 100].forEach((val) => {
        const r = inputSchema.safeParse({
          ...defaultPositionParameters,
          stopLossPercent: val,
        });
        expect(r.success).toBe(true);
      });
    });

    it('rejects values above 100', () => {
      const r = inputSchema.safeParse({
        ...defaultPositionParameters,
        stopLossPercent: 150,
      });
      expect(r.success).toBe(false);
      expect(r.error?.issues[0].path).toContain('stopLossPercent');
    });

    it('rejects zero or negative if not allowed', () => {
      const r = inputSchema.safeParse({
        ...defaultPositionParameters,
        stopLossPercent: -1,
      });
      expect(r.success).toBe(false);
    });
  });

  // -------------------------
  // TAX RATE
  // -------------------------
  describe('taxRate (%)', () => {
    it('accepts values between 0 and 100', () => {
      [0, 5, 18, 30, 100].forEach((val) => {
        const r = inputSchema.safeParse({
          ...defaultPositionParameters,
          taxRate: val,
        });
        expect(r.success).toBe(true);
      });
    });

    it('rejects values above 100', () => {
      const r = inputSchema.safeParse({
        ...defaultPositionParameters,
        taxRate: 101,
      });
      expect(r.success).toBe(false);
      expect(r.error?.issues[0].path).toContain('taxRate');
    });

    it('rejects negative values', () => {
      const r = inputSchema.safeParse({
        ...defaultPositionParameters,
        taxRate: -5,
      });
      expect(r.success).toBe(false);
    });

    it('accepts decimal percentages (e.g. 0.02 for 0.02%, 0.2 for 0.2%, 2 for 2%)', () => {
      [0.02, 0.2, 2, 18.5].forEach((val) => {
        const r = inputSchema.safeParse({
          ...defaultPositionParameters,
          taxRate: val,
        });
        expect(r.success).toBe(true);
      });
    });
  });
});
