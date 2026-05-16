/**
 * Market Analyzer pipeline types and Zod contracts.
 * Shared by client synthesis, API validation, and UI result rendering.
 */

import { z } from 'zod';
import {
  EQUITY_EXPOSURE_SCALE,
  MARKET_VERDICTS,
  POSITION_SIZE_SCALE,
} from '@/lib/market-analyzer/constants';

export const targetIndexSchema = z.enum([
  'NIFTY_50',
  'NIFTY_500',
  'NIFTY_METAL',
  'NIFTY_PHARMA',
]);

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

export const analyzerResultSchema = z.object({
  verdict: marketVerdictSchema,
  positionSizingGuidance: positionSizeSchema,
  equityExposure: equityExposureSchema,
  explanation: z.string().min(1).max(4000),
});

export type AnalyzerResult = z.infer<typeof analyzerResultSchema>;

export const marketAnalyzerRequestSchema = z.object({
  payload: compressedPayloadSchema,
});

export type MarketAnalyzerRequestBody = z.infer<typeof marketAnalyzerRequestSchema>;
