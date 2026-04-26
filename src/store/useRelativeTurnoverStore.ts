'use client';

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import {
  RELATIVE_TURNOVER_CACHE_VERSION,
  RELATIVE_TURNOVER_TTL_MS,
  type RelativeTurnoverMetric,
} from '@/lib/relative-turnover';

type RelativeTurnoverCachedEntry = RelativeTurnoverMetric & {
  fetchedAt: number;
};

type RelativeTurnoverStore = {
  bySymbol: Record<string, RelativeTurnoverCachedEntry>;
  setMetric: (metric: RelativeTurnoverMetric, fetchedAt?: number) => void;
  getValidMetric: (symbol: string, now?: number) => RelativeTurnoverCachedEntry | null;
  invalidateExpired: (now?: number) => void;
};

function normalizeSymbol(symbol: string): string {
  return symbol.trim().toUpperCase();
}

export const useRelativeTurnoverStore = create<RelativeTurnoverStore>()(
  persist(
    (set, get) => ({
      bySymbol: {},
      setMetric: (metric, fetchedAt = Date.now()) => {
        const symbol = normalizeSymbol(metric.symbol);
        if (!symbol) return;
        set((state) => {
          const prev = state.bySymbol[symbol];
          if (
            prev &&
            prev.symbol === symbol &&
            prev.asOf === metric.asOf &&
            prev.turnover30d === metric.turnover30d &&
            prev.marketCap === metric.marketCap &&
            prev.relativeTurnoverPct === metric.relativeTurnoverPct
          ) {
            return state;
          }
          return {
            bySymbol: {
              ...state.bySymbol,
              [symbol]: { ...metric, symbol, fetchedAt },
            },
          };
        });
      },
      getValidMetric: (symbol, now = Date.now()) => {
        const key = normalizeSymbol(symbol);
        if (!key) return null;
        const row = get().bySymbol[key];
        if (!row) return null;
        if (now - row.fetchedAt > RELATIVE_TURNOVER_TTL_MS) return null;
        return row;
      },
      invalidateExpired: (now = Date.now()) => {
        set((state) => {
          const next: RelativeTurnoverStore['bySymbol'] = {};
          let changed = false;
          for (const [key, value] of Object.entries(state.bySymbol)) {
            if (now - value.fetchedAt <= RELATIVE_TURNOVER_TTL_MS) {
              next[key] = value;
            } else {
              changed = true;
            }
          }
          if (!changed) return state;
          return { bySymbol: next };
        });
      },
    }),
    {
      name: `relative-turnover-${RELATIVE_TURNOVER_CACHE_VERSION}`,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ bySymbol: state.bySymbol }),
    },
  ),
);
