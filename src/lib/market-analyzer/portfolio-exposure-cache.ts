/**
 * Client-side day cache for portfolio exposure (IST calendar date).
 */

import type { EquityExposure } from '@/types/marketAnalyzer';

const STORAGE_KEY = 'momentum-edge:portfolio-exposure';

export type PortfolioExposureCacheEntry = {
  asOf: string;
  equityExposure: EquityExposure;
  summary: string;
  fetchedAt: string;
};

export function istDateKey(date: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

export function readPortfolioExposureCache(
  date: Date = new Date(),
): PortfolioExposureCacheEntry | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PortfolioExposureCacheEntry;
    if (parsed.asOf !== istDateKey(date)) return null;
    if (!parsed.equityExposure || typeof parsed.summary !== 'string') return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writePortfolioExposureCache(entry: PortfolioExposureCacheEntry): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(entry));
  } catch {
    // Quota or privacy mode — ignore; in-memory state still works for the session.
  }
}
