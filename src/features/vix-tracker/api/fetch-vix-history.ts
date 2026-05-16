import type { VixHistoryApiResponse } from '@/lib/nse-vix-types';

export type FetchVixHistoryParams = {
  sessions?: number;
};

export async function fetchVixHistory(
  params: FetchVixHistoryParams = {},
): Promise<VixHistoryApiResponse> {
  const sessions = params.sessions ?? 60;
  const res = await fetch(`/api/nse/vix-history?sessions=${sessions}`);
  const payload = (await res.json()) as VixHistoryApiResponse & { error?: string; detail?: string };
  if (!res.ok) {
    const msg =
      typeof payload?.error === 'string' ? payload.error : 'Failed to load India VIX history.';
    const detail =
      typeof payload?.detail === 'string' && payload.detail.length > 0 ? ` ${payload.detail}` : '';
    throw new Error(msg + detail);
  }
  if (!Array.isArray(payload.points)) {
    throw new Error('Invalid VIX history payload');
  }
  return payload;
}
