import { useQuery } from '@tanstack/react-query';
import type { AthScannerParsedRow } from '@/lib/screener-ath-xlsx';

export type AthScannerGlobalQueryData = {
  rows: AthScannerParsedRow[];
  sourceFileName: string | null;
  updatedAt: string | null;
  unavailable?: boolean;
};

async function fetchAthScannerGlobal(): Promise<AthScannerGlobalQueryData> {
  const response = await fetch('/api/ath-scanner/global', { cache: 'no-store' });
  const payload = (await response.json()) as AthScannerGlobalQueryData & { error?: string };
  if (!response.ok) {
    const msg = typeof payload?.error === 'string' ? payload.error : 'Failed to load ATH scanner list.';
    throw new Error(msg);
  }
  return {
    rows: Array.isArray(payload.rows) ? payload.rows : [],
    sourceFileName: payload.sourceFileName ?? null,
    updatedAt: payload.updatedAt ?? null,
    unavailable: payload.unavailable === true,
  };
}

export function useAthScannerGlobalQuery(enabled: boolean) {
  return useQuery({
    queryKey: ['ath-scanner', 'global'],
    queryFn: fetchAthScannerGlobal,
    enabled,
    staleTime: 0,
  });
}
