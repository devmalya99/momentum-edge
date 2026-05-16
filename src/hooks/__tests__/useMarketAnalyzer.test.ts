import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useMarketAnalyzer } from '@/hooks/useMarketAnalyzer';
import type { AnalyzerResult, RawTelemetrySnapshot } from '@/types/marketAnalyzer';

const VALID_RESULT: AnalyzerResult = {
  verdict: 'Breeze',
  positionSizingGuidance: '15%',
  equityExposure: '70%',
  explanation: 'Trend and breadth support measured risk-on positioning.',
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
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  it('starts in idle state with null result and error and loading false', () => {
    const { result } = renderHook(() => useMarketAnalyzer());

    expect(result.current.status).toBe('idle');
    expect(result.current.result).toBeNull();
    expect(result.current.error).toBeNull();
    expect(result.current.loading).toBe(false);
  });

  it('sets loading true immediately when executeAnalysis is invoked', async () => {
    let resolveFetch!: (value: Response) => void;
    fetchSpy.mockImplementation(
      () =>
        new Promise<Response>((resolve) => {
          resolveFetch = resolve;
        }),
    );

    const { result } = renderHook(() => useMarketAnalyzer());

    act(() => {
      void result.current.executeAnalysis('NIFTY_50', buildTelemetry());
    });

    expect(result.current.loading).toBe(true);
    expect(result.current.status).toBe('loading');

    await act(async () => {
      resolveFetch(jsonResponse(VALID_RESULT));
    });
  });

  it('populates result and clears error after a successful POST', async () => {
    fetchSpy.mockResolvedValue(jsonResponse(VALID_RESULT));

    const { result } = renderHook(() => useMarketAnalyzer());

    await act(async () => {
      await result.current.executeAnalysis('NIFTY_50', buildTelemetry());
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.result).toEqual(VALID_RESULT);
    expect(result.current.error).toBeNull();
    expect(result.current.status).toBe('success');
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/market-analyzer');
    expect(init.method).toBe('POST');
    expect(init.headers).toMatchObject({
      'Content-Type': 'application/json',
      'X-Requested-With': 'XMLHttpRequest',
    });
    expect(JSON.parse(String(init.body))).toHaveProperty('payload');
  });

  it('stores the API error message and leaves result null on 422 responses', async () => {
    fetchSpy.mockResolvedValue(
      jsonResponse(
        { error: 'Unprocessable Entity', message: 'LLM response failed schema validation.' },
        422,
      ),
    );

    const { result } = renderHook(() => useMarketAnalyzer());

    await act(async () => {
      await result.current.executeAnalysis('NIFTY_500', buildTelemetry());
    });

    expect(result.current.loading).toBe(false);
    expect(result.current.result).toBeNull();
    expect(result.current.error).toBe('LLM response failed schema validation.');
    expect(result.current.status).toBe('error');
  });

  it('stores a failure message when fetch rejects', async () => {
    fetchSpy.mockRejectedValue(new Error('Network unreachable'));

    const { result } = renderHook(() => useMarketAnalyzer());

    await act(async () => {
      await result.current.executeAnalysis('NIFTY_METAL', buildTelemetry());
    });

    expect(result.current.loading).toBe(false);
    expect(result.current.result).toBeNull();
    expect(result.current.error).toBe('Network unreachable');
    expect(result.current.status).toBe('error');
  });

  it('reset returns all state to idle and null', async () => {
    fetchSpy.mockResolvedValue(jsonResponse(VALID_RESULT));

    const { result } = renderHook(() => useMarketAnalyzer());

    await act(async () => {
      await result.current.executeAnalysis('NIFTY_PHARMA', buildTelemetry());
    });

    expect(result.current.result).not.toBeNull();

    act(() => {
      result.current.reset();
    });

    expect(result.current.status).toBe('idle');
    expect(result.current.result).toBeNull();
    expect(result.current.error).toBeNull();
    expect(result.current.loading).toBe(false);
  });
});
