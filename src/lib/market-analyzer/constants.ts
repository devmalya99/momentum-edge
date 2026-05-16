/**
 * Tunable Market Analyzer parameters — change lookbacks and chunk sizes here
 * without touching synthesizer or UI code.
 */

export const ANALYZER_LOOKBACK = {
  /** ~1 calendar month of VIX sessions */
  vixSessions: 22,
  vixClub: 2,
  /** ~2 months of index daily closes */
  indexCloseSessions: 44,
  indexCloseClub: 3,
  /** ~1.5 months of A/D session ratios */
  adSessions: 33,
  adClub: 3,
  /** ~1 month of EMA delta % points before clubbing */
  emaSessions: 22,
  emaClub: 2,
  /** Enough bars for EMA200 warmup + lookback slices */
  technicalIndexFlag: '1Y',
} as const;

export const MARKET_VERDICTS = [
  'Breakdown',
  'Grinding',
  'Transition',
  'Stage 2',
  'Momentum',
  'Extreme Alignment',
] as const;

export const POSITION_SIZE_SCALE = ['0%', '8%', '12%', '15%', '20%', '25%'] as const;

export const EQUITY_EXPOSURE_SCALE = ['0%', '10%', '30%', '50%', '70%', '100%', '125%'] as const;
