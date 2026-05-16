import { describe, expect, it } from 'vitest';

import {
  buildAdRatioSeries,
  type NeonAdDailyRow,
  type NseMonthlyAdBlock,
  type NseMonthlyAdRow,
} from '@/lib/market-analyzer/build-ad-ratio-series';

function nseRow(
  tradeDate: string,
  ratio: number,
  sortIso: string,
): NseMonthlyAdRow {
  return {
    ADD_DAY_STRING: tradeDate,
    ADD_DAY: tradeDate,
    ADD_ADVANCES: 100,
    ADD_DECLINES: 80,
    ADD_ADV_DCLN_RATIO: ratio,
    TIMESTAMP: sortIso,
  };
}

const NSE_BLOCK_JAN: NseMonthlyAdBlock = {
  yearKey: 'JAN-2024',
  data: [
    nseRow('2024-01-02', 1.1, '2024-01-02T04:00:00.000Z'),
    nseRow('2024-01-03', 1.2, '2024-01-03T04:00:00.000Z'),
    nseRow('2024-01-04', 1.3, '2024-01-04T04:00:00.000Z'),
  ],
};

const NSE_BLOCK_FEB: NseMonthlyAdBlock = {
  yearKey: 'FEB-2024',
  data: [nseRow('2024-01-05', 1.4, '2024-01-05T04:00:00.000Z')],
};

/** Neon session after last NSE date — rolling gap-fill. */
const NEON_GAP_ROWS: NeonAdDailyRow[] = [
  {
    trade_date: '2024-01-06',
    ad_ratio: 9.99,
    advances: 50,
    declines: 50,
  },
];

/** Duplicate of an existing NSE session — must not create a second point. */
const NEON_DUPLICATE_ROWS: NeonAdDailyRow[] = [
  {
    trade_date: '2024-01-03',
    ad_ratio: 99.99,
    advances: 1,
    declines: 1,
  },
  ...NEON_GAP_ROWS,
];

describe('buildAdRatioSeries', () => {
  it('deduplicates overlapping trade dates and keeps the NSE ratio for that session', () => {
    const series = buildAdRatioSeries(
      [NSE_BLOCK_JAN, NSE_BLOCK_FEB],
      NEON_DUPLICATE_ROWS,
      'rolling',
    );

    expect(series).toHaveLength(5);
    expect(series[1]).toBe(1.2);
    expect(series).not.toContain(99.99);
  });

  it('returns ratios in strict chronological order oldest to newest', () => {
    const shuffledBlocks: NseMonthlyAdBlock[] = [
      NSE_BLOCK_FEB,
      {
        yearKey: 'JAN-2024-B',
        data: [nseRow('2024-01-01', 1.0, '2024-01-01T04:00:00.000Z')],
      },
      NSE_BLOCK_JAN,
    ];

    const series = buildAdRatioSeries(shuffledBlocks, [], 'rolling');

    expect(series).toEqual([1.0, 1.1, 1.2, 1.3, 1.4]);
  });

  it('appends Neon-only sessions after the last NSE trade date in rolling mode', () => {
    const series = buildAdRatioSeries([NSE_BLOCK_JAN, NSE_BLOCK_FEB], NEON_GAP_ROWS, 'rolling');

    expect(series[series.length - 1]).toBe(9.99);
  });

  it('processes NSE-only data when Neon gap-fill rows are empty', () => {
    const series = buildAdRatioSeries([NSE_BLOCK_JAN, NSE_BLOCK_FEB], [], 'rolling');

    expect(series).toEqual([1.1, 1.2, 1.3, 1.4]);
  });
});
