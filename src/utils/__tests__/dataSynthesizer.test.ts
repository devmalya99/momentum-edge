import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ANALYZER_LOOKBACK } from '@/lib/market-analyzer/constants';
import type { RawTelemetrySnapshot } from '@/types/marketAnalyzer';
import {
  clubDays,
  computeEmaDelta,
  evaluateTimeWindows,
  synthesizePayload,
} from '@/utils/dataSynthesizer';

/** Expected chunk count after tail slice + clubDays (ceil division). */
function expectedClubbedLength(sliceLen: number, club: number): number {
  return Math.ceil(sliceLen / club);
}

const FROZEN_TELEMETRY: RawTelemetrySnapshot = {
  vixHistory: Array.from({ length: 24 }, (_, i) => 14 + i * 0.1),
  indexCloseHistory: Array.from({ length: 50 }, (_, i) => 22_000 + i * 10),
  adRatioHistory: Array.from({ length: 40 }, (_, i) => 1 + i * 0.01),
  currentPrice: 22_500,
  currentEma20: 22_400,
  currentEma50: 22_300,
  currentEma200: 22_000,
  ema20History: Array.from({ length: 50 }, () => 22_400),
  ema50History: Array.from({ length: 50 }, () => 22_300),
  ema200History: Array.from({ length: 50 }, () => 22_000),
  rsiCurrent: 58.456,
  macdCurrent: { line: 12.3456, signal: 10.1111, hist: 2.2345 },
};

const REFERENCE_DATE = new Date('2026-05-16T12:00:00Z');

describe('clubDays', () => {
  it('returns exact arithmetic means for full chunks rounded to 2 decimal places', () => {
    expect(clubDays([10, 12, 20, 22, 30, 32], 2)).toEqual([11, 21, 31]);
  });

  it('averages an incomplete trailing chunk as a single-value mean', () => {
    expect(clubDays([1, 2, 3, 4, 5], 2)).toEqual([1.5, 3.5, 5]);
  });

  it('returns an empty array for empty input without throwing', () => {
    expect(clubDays([], 2)).toEqual([]);
  });
});

describe('computeEmaDelta', () => {
  it('returns a positive percent offset when spot is above EMA', () => {
    expect(computeEmaDelta(110, 100)).toBe(10);
  });

  it('returns a negative percent offset when spot is below EMA', () => {
    expect(computeEmaDelta(95, 100)).toBe(-5);
  });

  it('returns 0 when EMA is zero to avoid division by zero', () => {
    expect(computeEmaDelta(100, 0)).toBe(0);
  });

  it('rounds the result strictly to 2 decimal places', () => {
    expect(computeEmaDelta(100.333, 100)).toBe(0.33);
  });
});

describe('evaluateTimeWindows', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('reports 2 days to month-end on Feb 27 during a leap year in IST', () => {
    vi.setSystemTime(new Date('2024-02-27T06:30:00Z'));
    const flags = evaluateTimeWindows(new Date('2024-02-27T06:30:00Z'));
    expect(flags.daysToMonthlyExpiry).toBe(2);
  });

  it('sets isWeekendRisk true on Thursday in IST', () => {
    const thursdayIst = new Date('2026-05-14T06:30:00Z');
    vi.setSystemTime(thursdayIst);
    expect(evaluateTimeWindows(thursdayIst).isWeekendRisk).toBe(true);
  });

  it('sets isWeekendRisk true on Friday in IST', () => {
    const fridayIst = new Date('2026-05-15T06:30:00Z');
    vi.setSystemTime(fridayIst);
    expect(evaluateTimeWindows(fridayIst).isWeekendRisk).toBe(true);
  });

  it('sets isWeekendRisk false on Monday in IST', () => {
    const mondayIst = new Date('2026-05-11T06:30:00Z');
    vi.setSystemTime(mondayIst);
    expect(evaluateTimeWindows(mondayIst).isWeekendRisk).toBe(false);
  });
});

describe('synthesizePayload', () => {
  it('maps telemetry into compressed short-key payload fields', () => {
    const payload = synthesizePayload('NIFTY_500', FROZEN_TELEMETRY, REFERENCE_DATE);

    expect(payload.idx).toBe('NIFTY_500');
    expect(payload.asOf).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(payload).toHaveProperty('vix');
    expect(payload).toHaveProperty('px');
    expect(payload).toHaveProperty('ad');
    expect(payload).toHaveProperty('e20');
    expect(payload).toHaveProperty('e50');
    expect(payload).toHaveProperty('e200');
    expect(payload.d20).toBe(computeEmaDelta(22_500, 22_400));
    expect(payload.d50).toBe(computeEmaDelta(22_500, 22_300));
    expect(payload.d200).toBe(computeEmaDelta(22_500, 22_000));
    expect(payload.rsi).toBe(58.46);
    expect(payload.macd).toEqual({ l: 12.35, s: 10.11, h: 2.23 });
    expect(payload.cal).toEqual(
      expect.objectContaining({
        dte: expect.any(Number),
        wknd: expect.any(Boolean),
      }),
    );
  });

  it('produces clubbed array lengths derived from ANALYZER_LOOKBACK constants', () => {
    const payload = synthesizePayload('NIFTY_50', FROZEN_TELEMETRY, REFERENCE_DATE);

    const vixLen = Math.min(FROZEN_TELEMETRY.vixHistory.length, ANALYZER_LOOKBACK.vixSessions);
    const pxLen = Math.min(
      FROZEN_TELEMETRY.indexCloseHistory.length,
      ANALYZER_LOOKBACK.indexCloseSessions,
    );
    const adLen = Math.min(FROZEN_TELEMETRY.adRatioHistory.length, ANALYZER_LOOKBACK.adSessions);
    const emaDeltaLen = ANALYZER_LOOKBACK.emaSessions;

    expect(payload.vix).toHaveLength(
      expectedClubbedLength(vixLen, ANALYZER_LOOKBACK.vixClub),
    );
    expect(payload.px).toHaveLength(
      expectedClubbedLength(pxLen, ANALYZER_LOOKBACK.indexCloseClub),
    );
    expect(payload.ad).toHaveLength(expectedClubbedLength(adLen, ANALYZER_LOOKBACK.adClub));
    expect(payload.e20).toHaveLength(
      expectedClubbedLength(emaDeltaLen, ANALYZER_LOOKBACK.emaClub),
    );
    expect(payload.e50).toHaveLength(
      expectedClubbedLength(emaDeltaLen, ANALYZER_LOOKBACK.emaClub),
    );
    expect(payload.e200).toHaveLength(
      expectedClubbedLength(emaDeltaLen, ANALYZER_LOOKBACK.emaClub),
    );
  });

  it('threads evaluateTimeWindows calendar flags into cal.dte and cal.wknd', () => {
    const mondayIst = new Date('2026-05-11T06:30:00Z');
    const windows = evaluateTimeWindows(mondayIst);
    const payload = synthesizePayload('NIFTY_METAL', FROZEN_TELEMETRY, mondayIst);

    expect(payload.cal.dte).toBe(windows.daysToMonthlyExpiry);
    expect(payload.cal.wknd).toBe(windows.isWeekendRisk);
  });
});
