import { describe, expect, it } from 'vitest';

import { buildGraphChartTypeCandidates } from '@/lib/nse-index-graph-chart';

describe('buildGraphChartTypeCandidates', () => {
  it('orders candidates as explicit chartType, mapped short, then long label', () => {
    const map = new Map<string, string>([
      ['NIFTY MIDCAP150 MOMENTUM 50', 'NIFTYM150MOMNTM50'],
    ]);
    expect(buildGraphChartTypeCandidates('NIFTY MIDCAP150 MOMENTUM 50', map)).toEqual([
      'NIFTYM150MOMNTM50',
      'NIFTY MIDCAP150 MOMENTUM 50',
    ]);
  });

  it('tries explicit chartType before mapped short key and long label', () => {
    const map = new Map<string, string>([
      ['NIFTY MIDSMALLCAP400 MOMENTUM QUALITY 100', 'NIFTYMS400 MQ 100'],
    ]);
    expect(
      buildGraphChartTypeCandidates(
        'NIFTY MIDSMALLCAP400 MOMENTUM QUALITY 100',
        map,
        'NIFTYMS400 MQ 100',
      ),
    ).toEqual([
      'NIFTYMS400 MQ 100',
      'NIFTY MIDSMALLCAP400 MOMENTUM QUALITY 100',
    ]);
  });
});
