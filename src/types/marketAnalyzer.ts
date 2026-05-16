/**
 * Market Analyzer pipeline types and Zod contracts.
 * Shared by client synthesis, API validation, and UI result rendering.
 *
 * Dual-axis grading (6 tiers each):
 * - MarketVerdict: Breakdown | Grinding | Transition | Stage 2 | Momentum | Extreme Alignment
 * - PositionSizeGuidance: 0% | 8% | 12% | 15% | 20% | 25%
 * - EquityExposure: 0% | 10% | 30% | 50% | 70% | 100% | 125%
 */

import { z } from 'zod';
import {
  EQUITY_EXPOSURE_SCALE,
  MARKET_VERDICTS,
  POSITION_SIZE_SCALE,
} from '@/lib/market-analyzer/constants';
import { TARGET_INDEX_IDS } from '@/lib/market-analyzer/index-catalog';

export const targetIndexSchema = z.enum(TARGET_INDEX_IDS);

export type TargetIndex = z.infer<typeof targetIndexSchema>;

export const marketVerdictSchema = z.enum(MARKET_VERDICTS);
export type MarketVerdict = z.infer<typeof marketVerdictSchema>;

export const positionSizeSchema = z.enum(POSITION_SIZE_SCALE);
export type PositionSizeGuidance = z.infer<typeof positionSizeSchema>;

export const equityExposureSchema = z.enum(EQUITY_EXPOSURE_SCALE);
export type EquityExposure = z.infer<typeof equityExposureSchema>;

export type MacdSnapshot = {
  line: number;
  signal: number;
  hist: number;
};

/** Pre-compression telemetry assembled before `synthesizePayload`. */
export type RawTelemetrySnapshot = {
  vixHistory: number[];
  indexCloseHistory: number[];
  adRatioHistory: number[];
  currentPrice: number;
  currentEma20: number;
  currentEma50: number;
  currentEma200: number;
  ema20History: number[];
  ema50History: number[];
  ema200History: number[];
  rsiCurrent: number;
  macdCurrent: MacdSnapshot;
};

export const compressedPayloadSchema = z.object({
  idx: targetIndexSchema,
  asOf: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  vix: z.array(z.number()),
  px: z.array(z.number()),
  ad: z.array(z.number()),
  e20: z.array(z.number()),
  e50: z.array(z.number()),
  e200: z.array(z.number()),
  d20: z.number(),
  d50: z.number(),
  d200: z.number(),
  rsi: z.number(),
  macd: z.object({
    l: z.number(),
    s: z.number(),
    h: z.number(),
  }),
  cal: z.object({
    dte: z.number().int().nonnegative(),
    wknd: z.boolean(),
  }),
});

export type CompressedPayload = z.infer<typeof compressedPayloadSchema>;

/** Macro-only telemetry (VIX, breadth, Nifty 500) — no selected sector index. */
export type RawMacroTelemetrySnapshot = {
  vixHistory: number[];
  adRatioHistory: number[];
  nifty500CloseHistory: number[];
  nifty500Ema20History: number[];
  nifty500Ema50History: number[];
  nifty500Ema200History: number[];
  nifty500CurrentPrice: number;
  nifty500CurrentEma20: number;
  nifty500CurrentEma50: number;
  nifty500CurrentEma200: number;
  nifty500RsiCurrent: number;
};

export const compressedMacroPayloadSchema = z.object({
  asOf: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  vix: z.array(z.number()),
  ad: z.array(z.number()),
  n500: z.object({
    px: z.array(z.number()),
    d20: z.number(),
    d50: z.number(),
    d200: z.number(),
    rsi: z.number(),
  }),
  cal: z.object({
    dte: z.number().int().nonnegative(),
    wknd: z.boolean(),
  }),
});

export type CompressedMacroPayload = z.infer<typeof compressedMacroPayloadSchema>;

export const indexAnalyzerResultSchema = z.object({
  verdict: marketVerdictSchema,
  positionSizingGuidance: positionSizeSchema,
  explanation: z.string().min(1).max(4000),
});

export type IndexAnalyzerResult = z.infer<typeof indexAnalyzerResultSchema>;

export const portfolioExposureResultSchema = z.object({
  equityExposure: equityExposureSchema,
  summary: z.string().min(1).max(500),
});

export type PortfolioExposureResult = z.infer<typeof portfolioExposureResultSchema>;

/** @deprecated Use IndexAnalyzerResult + PortfolioExposureResult in the UI. */
export const analyzerResultSchema = indexAnalyzerResultSchema.extend({
  equityExposure: equityExposureSchema,
});

/** @deprecated Merged view for legacy callers. */
export type AnalyzerResult = IndexAnalyzerResult & { equityExposure: EquityExposure };

export const marketAnalyzerRequestSchema = z.object({
  payload: compressedPayloadSchema,
});

export type MarketAnalyzerRequestBody = z.infer<typeof marketAnalyzerRequestSchema>;

export const portfolioExposureRequestSchema = z.object({
  payload: compressedMacroPayloadSchema,
});

export type PortfolioExposureRequestBody = z.infer<typeof portfolioExposureRequestSchema>;
