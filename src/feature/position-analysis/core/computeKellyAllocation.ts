// --- Defaults when caller does not pass fees/tax (India-style retail assumptions)

/** Tax withheld on profits (20%). */
export const KELLY_TAX_ON_PROFIT = 0.2;

/** Flat fee per trade (₹). */
export const KELLY_FLAT_FEE_PER_TRADE = 200;

/** Half-Kelly multiplier. */
export const KELLY_HALF_MULTIPLIER = 0.5;

/** Max reported allocation as a fraction of capital (risk control). */
export const KELLY_MAX_ALLOCATION_FRACTION = 0.25;

/**
 * Single failure message for all invalid outcomes so UI and tests share one contract.
 * Covers bad inputs, negative Kelly, poor odds, and net P&L after costs.
 */
export const EDGE_FAIL_REASON =
  'Edge insufficient due to friction costs. Do not trade.' as const;

// --- Types: valid branch carries allocation + diagnostics; invalid branch carries a single reason string.

export type KellyAllocationParams = {
  winRatePercent: number;
  averageWin: number;
  averageLoss: number;
  /** When set, overrides {@link KELLY_FLAT_FEE_PER_TRADE}. */
  feesPerTrade?: number;
  /** Tax on gains, 0–100 (e.g. 20 for 20%). When set, overrides {@link KELLY_TAX_ON_PROFIT} as a fraction. */
  taxRatePercent?: number;
};

export type KellyAllocationInvalid = {
  isValid: false;
  reason: string;
};

export type KellyAllocationValid = {
  isValid: true;
  allocation: number;
  netWin: number;
  netLoss: number;
  odds: number;
};

export type KellyAllocationResult = KellyAllocationInvalid | KellyAllocationValid;

/**
 * Half-Kelly capital allocation from win rate and average win/loss (₹), with 20% tax on profits and ₹200 fee per trade.
 * `averageLoss` must be > 0 (realistic loss distribution; zero would distort odds).
 */
export function computeKellyAllocation(params: KellyAllocationParams): KellyAllocationResult {
  // Merge caller overrides with module defaults (₹ fee per side, tax as fraction of profit).
  const { winRatePercent, averageWin, averageLoss, feesPerTrade, taxRatePercent } = params;
  const flatFee = feesPerTrade ?? KELLY_FLAT_FEE_PER_TRADE;
  const taxOnProfitFraction =
    taxRatePercent !== undefined ? taxRatePercent / 100 : KELLY_TAX_ON_PROFIT;

  // Reject non-numeric or out-of-domain inputs before any payoff math.
  if (
    !Number.isFinite(winRatePercent) ||
    !Number.isFinite(averageWin) ||
    !Number.isFinite(averageLoss)
  ) {
    return { isValid: false, reason: EDGE_FAIL_REASON };
  }

  if (winRatePercent <= 0 || winRatePercent > 100) {
    return { isValid: false, reason: EDGE_FAIL_REASON };
  }

  if (averageWin < 0) {
    return { isValid: false, reason: EDGE_FAIL_REASON };
  }

  if (averageLoss <= 0) {
    return { isValid: false, reason: EDGE_FAIL_REASON };
  }

  // Expected net P&L per winning / losing trade after tax on wins and round-trip fee drag.
  const netWin = averageWin * (1 - taxOnProfitFraction) - flatFee;
  const netLoss = averageLoss + flatFee;

  if (netWin <= 0) {
    return { isValid: false, reason: EDGE_FAIL_REASON };
  }

  const odds = netWin / netLoss;

  if (!Number.isFinite(odds) || odds <= 0) {
    return { isValid: false, reason: EDGE_FAIL_REASON };
  }

  // Full Kelly fraction: p − (1−p)/odds. Must be positive or there is no edge after costs.
  const p = winRatePercent / 100;
  const q = 1 - p;
  const fullKelly = p - q / odds;

  if (fullKelly <= 0) {
    return { isValid: false, reason: EDGE_FAIL_REASON };
  }

  // Half-Kelly for less variance, then cap so UI never implies betting more than 100% or the risk budget.
  let allocation = fullKelly * KELLY_HALF_MULTIPLIER;

  if (!Number.isFinite(allocation) || allocation < 0) {
    return { isValid: false, reason: EDGE_FAIL_REASON };
  }

  if (allocation > 1) {
    allocation = 1;
  }

  if (allocation > KELLY_MAX_ALLOCATION_FRACTION) {
    allocation = KELLY_MAX_ALLOCATION_FRACTION;
  }

  return {
    isValid: true,
    allocation,
    netWin,
    netLoss,
    odds,
  };
}
