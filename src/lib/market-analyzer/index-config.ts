/**
 * Uniform NSE symbol resolution for Market Analyzer target indices.
 */

import {
  getIndexEntry,
  INDEX_CATEGORIES,
  INDEX_CATEGORY_LABELS,
  indexesByCategory,
  isTargetIndexId,
  MARKET_ANALYZER_INDEXES,
  type IndexCategory,
  type TargetIndexId,
} from '@/lib/market-analyzer/index-catalog';
import type { TargetIndex } from '@/types/marketAnalyzer';

export {
  INDEX_CATEGORIES,
  INDEX_CATEGORY_LABELS,
  indexesByCategory,
  isTargetIndexId,
  MARKET_ANALYZER_INDEXES,
  type IndexCategory,
  type TargetIndexId,
};

/** @deprecated Use MARKET_ANALYZER_INDEXES — kept for imports that expect TARGET_INDEX_OPTIONS */
export const TARGET_INDEX_OPTIONS: readonly TargetIndex[] = MARKET_ANALYZER_INDEXES.map(
  (e) => e.id,
) as TargetIndex[];

export function nseSymbolForTargetIndex(index: TargetIndex): string {
  const row = getIndexEntry(index);
  if (!row) {
    throw new Error(`Unknown Market Analyzer index: ${index}`);
  }
  return row.nseSymbol;
}


export function targetIndexLabel(index: TargetIndex): string {
  return nseSymbolForTargetIndex(index);
}

/** NSE `getGraphChart` short key when set in catalog (skips 404 on long name). */
export function chartTypeForTargetIndex(index: TargetIndex): string | undefined {
  return getIndexEntry(index)?.chartType;
}

export function defaultTargetIndex(): TargetIndex {
  return 'NIFTY_50';
}
