'use client';

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import {
  TURNOVER_ACCELERATION_CACHE_VERSION,
  TURNOVER_ACCELERATION_TTL_MS,
  type TurnoverAccelerationMetric,
} from '@/lib/turnover-acceleration';

type TurnoverAccelerationCachedEntry = TurnoverAccelerationMetric & {
  fetchedAt: number;
};

type TurnoverAccelerationStore = {
  bySymbol: Record<string, TurnoverAccelerationCachedEntry>;
  setMetric: (metric: TurnoverAccelerationMetric, fetchedAt?: number) => void;
  getValidMetric: (symbol: string, now?: number) => TurnoverAccelerationCachedEntry | null;
  invalidateExpired: (now?: number) => void;
};

function normalizeSymbol(symbol: string): string {
  return symbol.trim().toUpperCase();
}

function isCacheExpired(fetchedAt: number, now: number): boolean {
  return now - fetchedAt > TURNOVER_ACCELERATION_TTL_MS;
}

export const useTurnoverAccelerationStore = create<TurnoverAccelerationStore>()(
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
            prev.recentTurnover === metric.recentTurnover &&
            prev.previousTurnover === metric.previousTurnover &&
            prev.turnoverAccelerationPct === metric.turnoverAccelerationPct
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
        if (isCacheExpired(row.fetchedAt, now)) return null;
        return row;
      },
      invalidateExpired: (now = Date.now()) => {
        set((state) => {
          const next: TurnoverAccelerationStore['bySymbol'] = {};
          let changed = false;
          for (const [key, value] of Object.entries(state.bySymbol)) {
            if (isCacheExpired(value.fetchedAt, now)) changed = true;
            else next[key] = value;
          }
          if (!changed) return state;
          return { bySymbol: next };
        });
      },
    }),
    {
      name: `turnover-acceleration-${TURNOVER_ACCELERATION_CACHE_VERSION}`,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ bySymbol: state.bySymbol }),
    },
  ),
);
