'use client';

import { useCallback, useEffect, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { BookmarkCheck, LineChart, Trash2 } from 'lucide-react';
import TradingViewAdvancedChartWidget from '@/components/TradingViewAdvancedChartWidget';
import { useTradeStore } from '@/store/useTradeStore';

export default function WatchlistWorkspace() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const querySymbol = searchParams.get('symbol');

  const watchlist = useTradeStore((s) => s.watchlist);
  const removeFromWatchlist = useTradeStore((s) => s.removeFromWatchlist);

  const selectedTvSymbol = useMemo(() => {
    if (watchlist.length === 0) return querySymbol ?? '';
    if (querySymbol && watchlist.some((w) => w.id === querySymbol)) return querySymbol;
    return watchlist[0].id;
  }, [watchlist, querySymbol]);

  useEffect(() => {
    if (watchlist.length === 0) return;
    if (!querySymbol || !watchlist.some((w) => w.id === querySymbol)) {
      router.replace(`/watchlist?symbol=${encodeURIComponent(watchlist[0].id)}`, { scroll: false });
    }
  }, [watchlist, querySymbol, router]);

  const onSelect = useCallback(
    (tvSymbol: string) => {
      router.replace(`/watchlist?symbol=${encodeURIComponent(tvSymbol)}`, { scroll: false });
    },
    [router],
  );

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-black tracking-tight text-white">Watchlist</h1>
        <p className="mt-1 text-sm text-gray-500">
          Your bookmarked stocks on the left; select one to view its TradingView chart.
        </p>
      </div>

      <div className="flex h-[min(max(480px,calc(100dvh-14rem)),880px)] flex-col overflow-hidden rounded-3xl border border-white/10 bg-[#161618] lg:flex-row">
        <aside className="flex max-h-[40%] min-h-0 w-full shrink-0 flex-col overflow-hidden border-b border-white/10 lg:h-full lg:max-h-none lg:w-[min(100%,360px)] lg:border-b-0 lg:border-r">
          <div className="flex shrink-0 items-center justify-between border-b border-white/5 px-4 py-3">
            <span className="text-[10px] font-bold uppercase tracking-widest text-gray-500">
              Watchlist stocks ({watchlist.length})
            </span>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-2">
            {watchlist.length === 0 ? (
              <div className="px-3 py-8 text-center text-sm text-gray-500">
                No watchlist stocks yet. Bookmark names from the 52 H Scanner.
              </div>
            ) : (
              <ul className="space-y-1">
                {watchlist.map((item) => {
                  const isSelected = item.id === selectedTvSymbol;
                  return (
                    <li key={item.id}>
                      <div
                        className={`flex items-start gap-2 rounded-2xl border px-3 py-3 transition-colors ${
                          isSelected
                            ? 'border-blue-500/40 bg-blue-500/10 text-white'
                            : 'border-transparent bg-transparent text-gray-300 hover:border-white/10 hover:bg-white/5'
                        }`}
                      >
                        <button type="button" onClick={() => onSelect(item.id)} className="min-w-0 flex-1 text-left">
                          <div className="font-bold tracking-tight">{item.symbol}</div>
                          <div className="mt-0.5 truncate text-[11px] text-gray-500">{item.companyName}</div>
                          <div className="mt-1 text-[10px] text-gray-600 font-mono">{item.id}</div>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            void removeFromWatchlist(item.id);
                          }}
                          aria-label={`Remove ${item.symbol} from watchlist`}
                          className="shrink-0 rounded-lg border border-white/10 p-1 text-gray-500 transition-colors hover:border-red-400/30 hover:bg-red-500/10 hover:text-red-300"
                        >
                          <Trash2 className="h-3.5 w-3.5" aria-hidden />
                        </button>
                      </div>
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
                <BookmarkCheck className="h-4 w-4 text-amber-300" aria-hidden />
                <span className="font-mono text-[11px] text-gray-400">{selectedTvSymbol}</span>
              </div>
              <div className="relative min-h-0 flex-1 overflow-hidden">
                <TradingViewAdvancedChartWidget
                  key={selectedTvSymbol}
                  symbol={selectedTvSymbol}
                  className="tradingview-widget-container absolute inset-0 flex h-full min-h-0 w-full flex-col"
                />
              </div>
            </div>
          ) : (
            <div className="flex flex-1 items-center justify-center text-sm text-gray-500">
              Select a watchlist stock to load a chart.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
