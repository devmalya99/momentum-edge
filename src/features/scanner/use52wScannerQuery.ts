'use client';

import { useQuery } from '@tanstack/react-query';

export type Scanner52wRow = {
  symbol: string;
  series: string;
  companyName: string;
  new52WHL: number | null;
  prev52WHL: number | null;
  prevHLDate: string;
  ltp: number | null;
  prevClose: number | null;
  change: number | null;
  pChange: number | null;
};

type Scanner52wApiPayload = {
  high?: number;
  data?: Array<{
    symbol?: string;
    series?: string;
    comapnyName?: string;
    new52WHL?: number;
    prev52WHL?: number;
    prevHLDate?: string;
    ltp?: number;
    prevClose?: number | string;
    change?: number;
    pChange?: number;
  }>;
  timestamp?: string;
};

export type Scanner52wSnapshot = {
  high: number;
  data: Scanner52wRow[];
  timestamp: string;
};

function toNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function normalizeRows(raw: Scanner52wApiPayload['data']): Scanner52wRow[] {
  if (!Array.isArray(raw)) return [];

  const rows: Scanner52wRow[] = [];
  for (const row of raw) {
    const symbol = typeof row?.symbol === 'string' ? row.symbol.trim().toUpperCase() : '';
    if (!symbol) continue;

    rows.push({
      symbol,
      series: typeof row?.series === 'string' ? row.series : 'EQ',
      companyName: typeof row?.comapnyName === 'string' ? row.comapnyName : symbol,
      new52WHL: toNumber(row?.new52WHL),
      prev52WHL: toNumber(row?.prev52WHL),
      prevHLDate: typeof row?.prevHLDate === 'string' ? row.prevHLDate : '',
      ltp: toNumber(row?.ltp),
      prevClose: toNumber(row?.prevClose),
      change: toNumber(row?.change),
      pChange: toNumber(row?.pChange),
    });
  }

  return rows.sort((a, b) => {
    const pa = a.pChange ?? Number.NEGATIVE_INFINITY;
    const pb = b.pChange ?? Number.NEGATIVE_INFINITY;
    return pb - pa;
  });
}

async function fetch52wScanner(): Promise<Scanner52wSnapshot> {
  const response = await fetch('/api/52wScanner', { cache: 'no-store' });
  const payload = (await response.json()) as Scanner52wApiPayload & { error?: string; detail?: string };

  if (!response.ok) {
    const msg = typeof payload?.error === 'string' ? payload.error : 'Failed to load 52 week high scanner.';
    const detail =
      typeof payload?.detail === 'string' && payload.detail.length > 0 ? ` ${payload.detail}` : '';
    throw new Error(msg + detail);
  }

  return {
    high: typeof payload.high === 'number' ? payload.high : 0,
    data: normalizeRows(payload.data),
    timestamp: typeof payload.timestamp === 'string' ? payload.timestamp : '',
  };
}

export function use52wScannerQuery() {
  return useQuery({
    queryKey: ['52w-scanner'],
    queryFn: fetch52wScanner,
    staleTime: 60_000,
    refetchInterval: 120_000,
  });
}
