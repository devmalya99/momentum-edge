/**
 * Uniform NSE symbol mapping for all analyzer target indices.
 * Adjust labels here only if NSE `getGraphChart` type strings differ.
 */

import type { TargetIndex } from '@/types/marketAnalyzer';

export const TARGET_INDEX_OPTIONS: readonly TargetIndex[] = [
  'NIFTY_50',
  'NIFTY_500',
  'NIFTY_METAL',
  'NIFTY_PHARMA',
] as const;

const NSE_SYMBOL_BY_INDEX: Record<TargetIndex, string> = {
  NIFTY_50: 'NIFTY 50',
  NIFTY_500: 'NIFTY 500',
  NIFTY_METAL: 'NIFTY METAL',
  NIFTY_PHARMA: 'NIFTY PHARMA',
};

export function nseSymbolForTargetIndex(index: TargetIndex): string {
  return NSE_SYMBOL_BY_INDEX[index];
}

export function targetIndexLabel(index: TargetIndex): string {
  return NSE_SYMBOL_BY_INDEX[index];
}
