'use client';

import { useMemo, useEffect, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useTradeStore } from '@/store/useTradeStore';
import NseEquityCandleChartWidget from '@/components/NseEquityCandleChartWidget';
import { nseSymbolFromTradingViewId, toTradingViewSymbol } from '@/lib/tradingview-symbol';
import { markPriceForTrade, useActiveTradeLivePrices } from '@/hooks/useActiveTradeLivePrices';
import type { Trade } from '@/db';
import { Loader2, LineChart } from 'lucide-react';

type HoldingGroup = {
  tvSymbol: string;
  displaySymbol: string;
  trades: Trade[];
};

function buildHoldings(activeTrades: Trade[]): HoldingGroup[] {
  const map = new Map<string, HoldingGroup>();
  for (const t of activeTrades) {
    const tv = toTradingViewSymbol(t.symbol);
    const cur = map.get(tv);
    if (cur) cur.trades.push(t);
    else
      map.set(tv, {
        tvSymbol: tv,
        displaySymbol: t.symbol.trim().toUpperCase(),
        trades: [t],
      });
  }
  return [...map.values()].sort((a, b) => a.displaySymbol.localeCompare(b.displaySymbol));
}

function unrealizedForGroup(group: HoldingGroup, liveBySymbol: Record<string, number>): number {
  return group.trades.reduce((sum, t) => {
    const px = markPriceForTrade(t, liveBySymbol);
    return sum + (px - t.entryPrice) * t.positionSize;
  }, 0);
}

export default function StockChartsWorkspace() {
  const { trades } = useTradeStore();
  const router = useRouter();
  const searchParams = useSearchParams();
  const paramSymbol = searchParams.get('symbol');

  const activeTrades = useMemo(
    () => trades.filter((t) => t.status === 'Active'),
    [trades],
  );
  const holdings = useMemo(() => buildHoldings(activeTrades), [activeTrades]);
  const { livePriceBySymbol, quotesFetching } = useActiveTradeLivePrices(trades);

  const selectedTvSymbol = useMemo(() => {
    if (holdings.length > 0) {
      if (paramSymbol && holdings.some((h) => h.tvSymbol === paramSymbol)) return paramSymbol;
      return holdings[0].tvSymbol;
    }
    if (paramSymbol) return paramSymbol;
    return '';
  }, [holdings, paramSymbol]);

  const chartNseSymbol = useMemo(() => {
    const g = holdings.find((h) => h.tvSymbol === selectedTvSymbol);
    if (g) return g.displaySymbol.trim().toUpperCase();
    if (selectedTvSymbol) return nseSymbolFromTradingViewId(selectedTvSymbol);
    return '';
  }, [holdings, selectedTvSymbol]);

  useEffect(() => {
    if (holdings.length === 0) return;
    if (!paramSymbol || !holdings.some((h) => h.tvSymbol === paramSymbol)) {
      router.replace(
        `/stock-charts?symbol=${encodeURIComponent(holdings[0].tvSymbol)}`,
        { scroll: false },
      );
    }
  }, [holdings, paramSymbol, router]);

  const selectSymbol = useCallback(
    (tv: string) => {
      router.replace(`/stock-charts?symbol=${encodeURIComponent(tv)}`, { scroll: false });
    },
    [router],
  );

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-black tracking-tight text-white">Holdings & charts</h1>
        <p className="mt-1 text-sm text-gray-500">
          Active positions on the left; select one to view its candle chart on the right.
        </p>
      </div>

      <div className="flex h-[min(max(480px,calc(100dvh-14rem)),880px)] flex-col overflow-hidden rounded-3xl border border-white/10 bg-[#161618] lg:flex-row">
        <aside className="flex max-h-[40%] min-h-0 w-full shrink-0 flex-col overflow-hidden border-b border-white/10 lg:h-full lg:max-h-none lg:w-[min(100%,300px)] lg:border-b-0 lg:border-r">
          <div className="flex shrink-0 items-center justify-between border-b border-white/5 px-4 py-3">
            <span className="text-[10px] font-bold uppercase tracking-widest text-gray-500">
              Active holdings
            </span>
            {quotesFetching ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-400" aria-hidden />
            ) : null}
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-2">
            {holdings.length === 0 ? (
              <div className="px-3 py-8 text-center text-sm text-gray-500">
                No active trades. Open positions from the dashboard to list them here, or open this
                page from a chart with a symbol in the URL.
              </div>
            ) : (
              <ul className="space-y-1">
                {holdings.map((h) => {
                  const unrealized = unrealizedForGroup(h, livePriceBySymbol);
                  const isSel = h.tvSymbol === selectedTvSymbol;
                  return (
                    <li key={h.tvSymbol}>
                      <button
                        type="button"
                        onClick={() => selectSymbol(h.tvSymbol)}
                        className={`w-full rounded-2xl border px-3 py-3 text-left transition-colors ${
                          isSel
                            ? 'border-blue-500/40 bg-blue-500/10 text-white'
                            : 'border-transparent bg-transparent text-gray-300 hover:border-white/10 hover:bg-white/5'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="font-bold tracking-tight">{h.displaySymbol}</div>
                            <div className="mt-0.5 text-[10px] text-gray-500">{h.tvSymbol}</div>
                          </div>
                          {h.trades.length > 1 ? (
                            <span className="shrink-0 rounded-md border border-white/10 px-1.5 py-0.5 text-[9px] font-bold uppercase text-gray-400">
                              {h.trades.length}×
                            </span>
                          ) : null}
                        </div>
                        <div
                          className={`mt-2 text-xs font-semibold ${
                            unrealized >= 0 ? 'text-green-400/90' : 'text-red-400/90'
                          }`}
                        >
                          Unrealized ₹{unrealized.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </aside>

        <div className="flex min-h-0 flex-1 flex-col bg-[#0f0f0f] p-3 sm:p-4">
          {selectedTvSymbol ? (
            <div className="flex min-h-0 flex-1 flex-col">
              <div className="mb-2 flex shrink-0 items-center gap-2 text-xs text-gray-500">
                <LineChart className="h-4 w-4 text-blue-400" aria-hidden />
                <span className="font-mono text-[11px] text-gray-400">{selectedTvSymbol}</span>
              </div>
              <div className="relative min-h-0 flex-1 overflow-hidden">
                {chartNseSymbol ? (
                  <NseEquityCandleChartWidget
                    key={chartNseSymbol}
                    symbol={chartNseSymbol}
                    className="absolute inset-0 flex h-full min-h-0 w-full flex-col"
                  />
                ) : null}
              </div>
            </div>
          ) : (
            <div className="flex flex-1 items-center justify-center text-sm text-gray-500">
              Select a holding or add an active trade to load a chart.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
