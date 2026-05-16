import { inputSchema } from '@/position-analysis/schema/inputSchema';
import type { PositionParameters } from '@/position-analysis/types';

// --- Risk budget: max loss per trade as a slice of total capital (used in percent stop mode).

/** Fraction of total capital treated as max loss per trade (1% — matches common risk rule). */
export const RISK_FRACTION_OF_CAPITAL = 0.01;

export type PositionSizingComputation = {
  recommendedPositionSize: number;
  /** 0–100 */
  percentOfCapital: number;
  maxLoss: number;
};

/**
 * Percent stop: max loss = capital × risk fraction; position = max loss ÷ stop fraction.
 * `stopLossPercent` on parameters is 0–100 (e.g. 3 for 3%); converted to a fraction here.
 * Absolute stop: max loss = stopLossAbsolute (rupee loss at stop); same stop % applies as width.
 */
export function computePositionSizing(
  raw: PositionParameters,
): PositionSizingComputation | null {
  // Zod ensures shape; we still bail if capital or stop width cannot produce a position.
  const parsed = inputSchema.safeParse(raw);
  if (!parsed.success) return null;
  const p = parsed.data;

  if (p.totalCapital <= 0) return null;

  if (p.stopLossPercent <= 0 || !Number.isFinite(p.stopLossPercent)) return null;

  // Stop is always expressed as % of position; convert once for rupee math below.
  const stopFraction = p.stopLossPercent / 100;

  // Percent model: risk = fixed % of capital → notional = risk / stop%.
  if (p.stopLossModel === 'percent') {
    const maxLoss = p.totalCapital * RISK_FRACTION_OF_CAPITAL;
    const recommendedPositionSize = maxLoss / stopFraction;
    const percentOfCapital =
      p.totalCapital > 0 ? (recommendedPositionSize / p.totalCapital) * 100 : 0;
    return {
      recommendedPositionSize,
      percentOfCapital,
      maxLoss,
    };
  }

  // Absolute model: user fixes rupee loss at stop; same stop% turns that into notional size.
  const maxLoss = p.stopLossAbsolute;
  const recommendedPositionSize = maxLoss / stopFraction;
  const percentOfCapital =
    p.totalCapital > 0 ? (recommendedPositionSize / p.totalCapital) * 100 : 0;
  return {
    recommendedPositionSize,
    percentOfCapital,
    maxLoss,
  };
}

// --- Display helpers for the UI (not used in core sizing math).

const inrFormatter = new Intl.NumberFormat('en-IN', {
  maximumFractionDigits: 0,
  minimumFractionDigits: 0,
});

export function formatInr(amount: number): string {
  if (!Number.isFinite(amount)) return '—';
  return `₹${inrFormatter.format(Math.round(amount))}`;
}

export function formatPercentOfCapital(pct: number): string {
  if (!Number.isFinite(pct)) return '—';
  const rounded = Math.round(pct * 10) / 10;
  const s = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
  return `${s}% of capital`;
}
