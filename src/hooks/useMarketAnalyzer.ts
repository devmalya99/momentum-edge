'use client';

/**
 * Orchestrates Market Analyzer client pipeline: synthesize → POST → result state.
 * Data collection stays in the parent (MarketView); this hook only runs analysis.
 */

import { useCallback, useState } from 'react';
import { synthesizePayload } from '@/utils/dataSynthesizer';
import type { AnalyzerResult, RawTelemetrySnapshot, TargetIndex } from '@/types/marketAnalyzer';
import { analyzerResultSchema } from '@/types/marketAnalyzer';

export type MarketAnalyzerStatus = 'idle' | 'loading' | 'success' | 'error';

export function useMarketAnalyzer() {
  const [status, setStatus] = useState<MarketAnalyzerStatus>('idle');
  const [result, setResult] = useState<AnalyzerResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reset = useCallback(() => {
    setStatus('idle');
    setResult(null);
    setError(null);
  }, []);

  const executeAnalysis = useCallback(
    async (index: TargetIndex, telemetry: RawTelemetrySnapshot) => {
      setStatus('loading');
      setError(null);
      setResult(null);

      try {
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

        const json = (await res.json()) as AnalyzerResult & {
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

        const validated = analyzerResultSchema.parse(json);
        setResult(validated);
        setStatus('success');
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Market analysis failed.';
        setError(message);
        setStatus('error');
      }
    },
    [],
  );

  return {
    status,
    loading: status === 'loading',
    result,
    error,
    executeAnalysis,
    reset,
  };
}
