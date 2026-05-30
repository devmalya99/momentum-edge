'use client';

import { parsePartialJson } from 'ai';
import { useCallback, useRef, useState } from 'react';
import { BUSINESS_ANALYSIS_API_HEADERS } from '@/lib/ai/business-analysis-client';
import { businessAnalysisLog } from '@/lib/ai/business-analysis-stream-log';

type StreamScope = 'basic' | 'extended';

export function useBusinessAnalysisStream<T extends Record<string, unknown>>(scope: StreamScope) {
  const [object, setObject] = useState<Partial<T> | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | undefined>(undefined);
  const abortRef = useRef<AbortController | null>(null);

  const submit = useCallback(
    async (input: Record<string, unknown>): Promise<Partial<T> | undefined> => {
      abortRef.current?.abort();
      const abort = new AbortController();
      abortRef.current = abort;

      setIsLoading(true);
      setError(undefined);
      setObject(undefined);

      let accumulated = '';
      let updateCount = 0;
      let chunkCount = 0;

      try {
        businessAnalysisLog.ui(`${scope}-submit`, input);
        const response = await fetch('/api/ai/business-analysis', {
          method: 'POST',
          headers: BUSINESS_ANALYSIS_API_HEADERS,
          body: JSON.stringify(input),
          signal: abort.signal,
        });

        if (!response.ok) {
          const message = await response.text().catch(() => `Request failed (${response.status})`);
          throw new Error(message);
        }
        if (!response.body) throw new Error('Empty response body');

        const reader = response.body.getReader();
        const decoder = new TextDecoder();

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          chunkCount += 1;
          accumulated += decoder.decode(value, { stream: true });
          const { value: partial } = await parsePartialJson(accumulated);

          if (partial && typeof partial === 'object' && !Array.isArray(partial)) {
            updateCount += 1;
            setObject(partial as Partial<T>);
            businessAnalysisLog.ui(`${scope}-partial-update`, {
              chunkCount,
              updateCount,
              chars: accumulated.length,
              keys: Object.keys(partial),
            });
          } else if (chunkCount === 1 || chunkCount % 5 === 0) {
            businessAnalysisLog.ui(`${scope}-chunk-no-parse-yet`, {
              chunkCount,
              chars: accumulated.length,
            });
          }
        }

        accumulated += decoder.decode();
        const { value: finalPartial } = await parsePartialJson(accumulated);
        if (finalPartial && typeof finalPartial === 'object' && !Array.isArray(finalPartial)) {
          setObject(finalPartial as Partial<T>);
        }

        businessAnalysisLog.ui(`${scope}-stream-complete`, {
          chunkCount,
          updateCount,
          chars: accumulated.length,
        });

        return (finalPartial as Partial<T> | undefined) ?? undefined;
      } catch (err) {
        if (abort.signal.aborted) return undefined;
        const streamError = err instanceof Error ? err : new Error(String(err));
        setError(streamError);
        businessAnalysisLog.ui(`${scope}-stream-error`, { message: streamError.message });
        throw streamError;
      } finally {
        if (!abort.signal.aborted) setIsLoading(false);
        abortRef.current = null;
      }
    },
    [scope],
  );

  const stop = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const clear = useCallback(() => {
    stop();
    setObject(undefined);
    setError(undefined);
    setIsLoading(false);
  }, [stop]);

  return { object, isLoading, error, submit, stop, clear };
}
