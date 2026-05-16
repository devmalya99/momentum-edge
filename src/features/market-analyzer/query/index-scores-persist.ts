import { MARKET_ANALYZER_INDEXES } from '@/lib/market-analyzer/index-catalog';
import { INDEX_SCORES_STALE_MS } from '@/features/market-analyzer/constants/index-scores';
import type { IndexScoresCatalog } from '@/features/market-analyzer/types/index-scores';

const STORAGE_KEY = 'momentum-edge:rq:index-scores-catalog';

type PersistedPayload = {
  data: IndexScoresCatalog;
  /** Same as `data.refreshedAt`, used for React Query `initialDataUpdatedAt`. */
  updatedAt: number;
};

export function isIndexScoresCatalogComplete(catalog: IndexScoresCatalog | undefined): boolean {
  if (!catalog?.scores) return false;
  return MARKET_ANALYZER_INDEXES.every((e) => catalog.scores[e.id] != null);
}

export function isIndexScoresCatalogFresh(refreshedAt: string, now = Date.now()): boolean {
  const updatedAt = new Date(refreshedAt).getTime();
  if (!Number.isFinite(updatedAt)) return false;
  const age = now - updatedAt;
  return age >= 0 && age < INDEX_SCORES_STALE_MS;
}

export function readPersistedIndexScoresCatalog(): PersistedPayload | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersistedPayload;
    if (!parsed?.data?.refreshedAt || typeof parsed.data.scores !== 'object') return null;
    if (!isIndexScoresCatalogFresh(parsed.data.refreshedAt)) {
      window.localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return {
      data: parsed.data,
      updatedAt: Number.isFinite(parsed.updatedAt)
        ? parsed.updatedAt
        : new Date(parsed.data.refreshedAt).getTime(),
    };
  } catch {
    return null;
  }
}

export function persistIndexScoresCatalog(catalog: IndexScoresCatalog): void {
  if (typeof window === 'undefined') return;
  try {
    const updatedAt = new Date(catalog.refreshedAt).getTime();
    const payload: PersistedPayload = {
      data: catalog,
      updatedAt: Number.isFinite(updatedAt) ? updatedAt : Date.now(),
    };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // Quota / privacy mode — in-memory React Query cache still works for the session.
  }
}

export function clearPersistedIndexScoresCatalog(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}
