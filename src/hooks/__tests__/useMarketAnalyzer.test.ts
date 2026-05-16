import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useMarketAnalyzer } from '@/hooks/useMarketAnalyzer';
import type { IndexAnalyzerResult, RawMacroTelemetrySnapshot, RawTelemetrySnapshot } from '@/types/marketAnalyzer';

vi.mock('@/lib/market-analyzer/collect-telemetry', () => ({
  collectMacroTelemetry: vi.fn(),
}));

import { collectMacroTelemetry } from '@/lib/market-analyzer/collect-telemetry';

const MACRO_TELEMETRY: RawMacroTelemetrySnapshot = {
  vixHistory: Array.from({ length: 22 }, () => 15),
  adRatioHistory: Array.from({ length: 33 }, () => 1.2),
  nifty500CloseHistory: Array.from({ length: 44 }, () => 22_000),
  nifty500Ema20History: Array.from({ length: 44 }, () => 22_000),
  nifty500Ema50History: Array.from({ length: 44 }, () => 21_900),
  nifty500Ema200History: Array.from({ length: 44 }, () => 21_500),
  nifty500CurrentPrice: 22_100,
  nifty500CurrentEma20: 22_000,
  nifty500CurrentEma50: 21_900,
  nifty500CurrentEma200: 21_500,
  nifty500RsiCurrent: 55,
};

const VALID_INDEX_RESULT: IndexAnalyzerResult = {
  verdict: 'Stage 2',
  positionSizingGuidance: '15%',
  explanation: 'Index EMA stack constructive; macro discount applied to sizing.',
};

const VALID_PORTFOLIO_RESULT = {
  equityExposure: '70%' as const,
  summary: 'Breadth is constructive and VIX is stable; a measured risk-on stance fits.',
};

function buildTelemetry(): RawTelemetrySnapshot {
  return {
    vixHistory: Array.from({ length: 22 }, (_, i) => 14 + i * 0.05),
    indexCloseHistory: Array.from({ length: 44 }, (_, i) => 22_000 + i * 5),
    adRatioHistory: Array.from({ length: 33 }, (_, i) => 1.1 + i * 0.01),
    currentPrice: 22_500,
    currentEma20: 22_400,
    currentEma50: 22_300,
    currentEma200: 22_000,
    ema20History: Array.from({ length: 44 }, () => 22_400),
    ema50History: Array.from({ length: 44 }, () => 22_300),
    ema200History: Array.from({ length: 44 }, () => 22_000),
    rsiCurrent: 58,
    macdCurrent: { line: 1.2, signal: 0.8, hist: 0.4 },
  };
}

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}

describe('useMarketAnalyzer', () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    fetchSpy = vi.spyOn(globalThis, 'fetch');
    localStorage.clear();
    vi.mocked(collectMacroTelemetry).mockResolvedValue(MACRO_TELEMETRY);
  });

  afterEach(() => {
    fetchSpy.mockRestore();
    localStorage.clear();
  });

  it('starts in idle state with null results', () => {
    const { result } = renderHook(() => useMarketAnalyzer());

    expect(result.current.indexStatus).toBe('idle');
    expect(result.current.indexResult).toBeNull();
    expect(result.current.indexError).toBeNull();
    expect(result.current.portfolioExposure).toBeNull();
    expect(result.current.indexLoading).toBe(false);
  });

  it('loads portfolio exposure once and caches it for the day', async () => {
    fetchSpy.mockImplementation((url: string | URL) => {
      const path = String(url);
      if (path.includes('portfolio-exposure')) {
        return Promise.resolve(jsonResponse(VALID_PORTFOLIO_RESULT));
      }
      return Promise.reject(new Error(`Unexpected fetch: ${path}`));
    });

    const { result } = renderHook(() => useMarketAnalyzer());

    await act(async () => {
      await result.current.ensurePortfolioExposure();
    });

    await waitFor(() => {
      expect(result.current.portfolioExposure?.equityExposure).toBe('70%');
    });

    expect(fetchSpy).toHaveBeenCalledTimes(1);

    fetchSpy.mockClear();

    await act(async () => {
      await result.current.ensurePortfolioExposure();
    });

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(result.current.portfolioExposure?.fromCache).toBe(true);
  });

  it('populates index result after a successful POST', async () => {
    fetchSpy.mockImplementation((url: string | URL) => {
      const path = String(url);
      if (path.includes('portfolio-exposure')) {
        return Promise.resolve(jsonResponse(VALID_PORTFOLIO_RESULT));
      }
      if (path.endsWith('/api/market-analyzer')) {
        return Promise.resolve(jsonResponse(VALID_INDEX_RESULT));
      }
      return Promise.reject(new Error(`Unexpected fetch: ${path}`));
    });

    const { result } = renderHook(() => useMarketAnalyzer());

    await act(async () => {
      await result.current.executeIndexAnalysis('NIFTY_50', buildTelemetry());
    });

    await waitFor(() => {
      expect(result.current.indexLoading).toBe(false);
    });

    expect(result.current.indexResult).toEqual(VALID_INDEX_RESULT);
    expect(result.current.portfolioExposure?.equityExposure).toBe('70%');
    expect(result.current.indexError).toBeNull();
    expect(result.current.indexStatus).toBe('success');
  });

  it('resetIndexAnalysis clears index state but keeps portfolio exposure', async () => {
    fetchSpy.mockResolvedValue(jsonResponse(VALID_PORTFOLIO_RESULT));

    const { result } = renderHook(() => useMarketAnalyzer());

    await act(async () => {
      await result.current.ensurePortfolioExposure();
    });

    act(() => {
      result.current.resetIndexAnalysis();
    });

    expect(result.current.indexResult).toBeNull();
    expect(result.current.portfolioExposure?.equityExposure).toBe('70%');
  });
});
