'use client';

/**
 * Market Analyzer: daily-cached portfolio exposure + per-index analysis.
 */

import { useCallback, useRef, useState } from 'react';
import { collectMacroTelemetry } from '@/lib/market-analyzer/collect-telemetry';
import {
  istDateKey,
  readPortfolioExposureCache,
  writePortfolioExposureCache,
  type PortfolioExposureCacheEntry,
} from '@/lib/market-analyzer/portfolio-exposure-cache';
import { synthesizeMacroPayload, synthesizePayload } from '@/utils/dataSynthesizer';
import type {
  EquityExposure,
  IndexAnalyzerResult,
  RawTelemetrySnapshot,
  TargetIndex,
} from '@/types/marketAnalyzer';
import { indexAnalyzerResultSchema } from '@/types/marketAnalyzer';
import { portfolioExposureResultSchema } from '@/types/marketAnalyzer';

export type MarketAnalyzerStatus = 'idle' | 'loading' | 'success' | 'error';

export type PortfolioExposureState = {
  equityExposure: EquityExposure;
  summary: string;
  asOf: string;
  fromCache: boolean;
};

export function useMarketAnalyzer() {
  const [indexStatus, setIndexStatus] = useState<MarketAnalyzerStatus>('idle');
  const [indexResult, setIndexResult] = useState<IndexAnalyzerResult | null>(null);
  const [indexError, setIndexError] = useState<string | null>(null);

  const [portfolioExposure, setPortfolioExposure] = useState<PortfolioExposureState | null>(null);
  const [portfolioLoading, setPortfolioLoading] = useState(false);
  const [portfolioError, setPortfolioError] = useState<string | null>(null);

  const portfolioFetchRef = useRef<Promise<PortfolioExposureState | null> | null>(null);

  const applyCacheEntry = useCallback((entry: PortfolioExposureCacheEntry): PortfolioExposureState => ({
    equityExposure: entry.equityExposure,
    summary: entry.summary,
    asOf: entry.asOf,
    fromCache: true,
  }), []);

  const ensurePortfolioExposure = useCallback(async (): Promise<PortfolioExposureState | null> => {
    const cached = readPortfolioExposureCache();
    if (cached) {
      const state = applyCacheEntry(cached);
      setPortfolioExposure(state);
      setPortfolioError(null);
      return state;
    }

    if (portfolioFetchRef.current) {
      return portfolioFetchRef.current;
    }

    const fetchPromise = (async () => {
      setPortfolioLoading(true);
      setPortfolioError(null);
      try {
        const telemetry = await collectMacroTelemetry();
        const payload = synthesizeMacroPayload(telemetry);

        const res = await fetch('/api/market-analyzer/portfolio-exposure', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Requested-With': 'XMLHttpRequest',
          },
          body: JSON.stringify({ payload }),
          cache: 'no-store',
        });

        const json = (await res.json()) as { error?: string; message?: string };
        if (!res.ok) {
          const msg =
            typeof json?.message === 'string'
              ? json.message
              : typeof json?.error === 'string'
                ? json.error
                : `Portfolio exposure failed (${res.status})`;
          throw new Error(msg);
        }

        const validated = portfolioExposureResultSchema.parse(json);
        const asOf = istDateKey();
        const entry: PortfolioExposureCacheEntry = {
          asOf,
          equityExposure: validated.equityExposure,
          summary: validated.summary,
          fetchedAt: new Date().toISOString(),
        };
        writePortfolioExposureCache(entry);

        const state: PortfolioExposureState = {
          equityExposure: entry.equityExposure,
          summary: entry.summary,
          asOf: entry.asOf,
          fromCache: false,
        };
        setPortfolioExposure(state);
        return state;
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : 'Failed to load portfolio exposure.';
        setPortfolioError(message);
        return null;
      } finally {
        setPortfolioLoading(false);
        portfolioFetchRef.current = null;
      }
    })();

    portfolioFetchRef.current = fetchPromise;
    return fetchPromise;
  }, [applyCacheEntry]);

  const resetIndexAnalysis = useCallback(() => {
    setIndexStatus('idle');
    setIndexResult(null);
    setIndexError(null);
  }, []);

  const executeIndexAnalysis = useCallback(
    async (index: TargetIndex, telemetry: RawTelemetrySnapshot) => {
      setIndexStatus('loading');
      setIndexError(null);
      setIndexResult(null);

      try {
        await ensurePortfolioExposure();

        const payload = synthesizePayload(index, telemetry);

        const res = await fetch('/api/market-analyzer', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Requested-With': 'XMLHttpRequest',
          },
          body: JSON.stringify({ payload }),
          cache: 'no-store',
        });

        const json = (await res.json()) as IndexAnalyzerResult & {
          error?: string;
          message?: string;
        };

        if (!res.ok) {
          const msg =
            typeof json?.message === 'string'
              ? json.message
              : typeof json?.error === 'string'
                ? json.error
                : `Market analysis failed (${res.status})`;
          throw new Error(msg);
        }

        const validated = indexAnalyzerResultSchema.parse(json);
        setIndexResult(validated);
        setIndexStatus('success');
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Market analysis failed.';
        setIndexError(message);
        setIndexStatus('error');
      }
    },
    [ensurePortfolioExposure],
  );

  return {
    indexStatus,
    indexLoading: indexStatus === 'loading',
    indexResult,
    indexError,

    portfolioExposure,
    portfolioLoading,
    portfolioError,
    ensurePortfolioExposure,

    executeIndexAnalysis,
    resetIndexAnalysis,

    /** @deprecated Use indexLoading */
    loading: indexStatus === 'loading',
    /** @deprecated Use indexResult */
    result: indexResult,
    /** @deprecated Use indexError */
    error: indexError,
    /** @deprecated Use executeIndexAnalysis */
    executeAnalysis: executeIndexAnalysis,
    /** @deprecated Use resetIndexAnalysis */
    reset: resetIndexAnalysis,
    status: indexStatus,
  };
}
