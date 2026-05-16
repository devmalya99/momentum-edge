import { describe, expect, it } from 'vitest';

import {
  getIndexEntry,
  isTargetIndexId,
  MARKET_ANALYZER_INDEXES,
  TARGET_INDEX_IDS,
} from '@/lib/market-analyzer/index-catalog';
import { nseSymbolForTargetIndex } from '@/lib/market-analyzer/index-config';

describe('index-catalog', () => {
  it('includes user-requested sectoral and thematic indices', () => {
    expect(nseSymbolForTargetIndex('NIFTY_CAPITAL_MARKETS')).toBe('NIFTY CAPITAL MARKETS');
    expect(nseSymbolForTargetIndex('NIFTY_INDIA_DEFENCE')).toBe('NIFTY INDIA DEFENCE');
    expect(nseSymbolForTargetIndex('NIFTY_REALTY')).toBe('NIFTY REALTY');
    expect(nseSymbolForTargetIndex('NIFTY_MIDCAP_150')).toBe('NIFTY MIDCAP 150');
  });

  it('records NSE short chart keys for strategy indices that 404 on long names', () => {
    expect(getIndexEntry('NIFTY_MIDCAP150_MOMENTUM_50')?.chartType).toBe('NIFTYM150MOMNTM50');
    expect(getIndexEntry('NIFTY_MIDSMLCAP400_MOMENTUM_QUALITY_100')?.chartType).toBe(
      'NIFTYMS400 MQ 100',
    );
    expect(getIndexEntry('NIFTY_SMLCAP250_MOMENTUM_QUALITY_100')?.nseSymbol).toBe(
      'NIFTY SMALLCAP250 MOMENTUM QUALITY 100',
    );
    expect(getIndexEntry('NIFTY500_MULTICAP_MOMENTUM_QUALITY_50')?.chartType).toBe(
      'NIFTY MULTI MQ 50',
    );
  });

  it('assigns every catalog entry a unique id', () => {
    const ids = MARKET_ANALYZER_INDEXES.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('exposes ids compatible with targetIndexSchema enum tuple', () => {
    expect(TARGET_INDEX_IDS.length).toBeGreaterThan(4);
    expect(isTargetIndexId('NIFTY_50')).toBe(true);
    expect(isTargetIndexId('NOT_AN_INDEX')).toBe(false);
    expect(getIndexEntry('NIFTY_METAL')?.category).toBe('sectoral');
  });
});
