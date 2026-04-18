'use client';

import { useEffect, useMemo, useCallback, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AlertTriangle, Bookmark, BookmarkCheck, LineChart, Loader2, RefreshCcw } from 'lucide-react';
import NseEquityCandleChartWidget from '@/components/NseEquityCandleChartWidget';
import TradingViewAdvancedChartWidget from '@/components/TradingViewAdvancedChartWidget';
import { use52wScannerQuery } from '@/features/52wScanner/use52wScannerQuery';
import { toTradingViewSymbol } from '@/lib/tradingview-symbol';
import { DEFAULT_WATCHLIST_LIST_ID } from '@/lib/watchlist-defaults';
import { useTradeStore } from '@/store/useTradeStore';

function toTvSymbol(nseSymbol: string): string {
  return toTradingViewSymbol(nseSymbol);
}

function formatPrice(v: number | null): string {
  if (v == null) return '—';
  return v.toLocaleString('en-IN', { maximumFractionDigits: 2 });
}

export default function Scanner52wWorkspace() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const querySymbol = searchParams.get('symbol');
  const [chartMode, setChartMode] = useState<'kline' | 'tradingview'>('kline');

  const { data, isLoading, isFetching, error, refetch } = use52wScannerQuery();
  const rows = data?.data ?? [];
  const watchlist = useTradeStore((s) => s.watchlist);
  const toggleWatchlist = useTradeStore((s) => s.toggleWatchlist);
  const isBookmarked = useCallback(
    (nseSymbol: string) =>
      watchlist.some(
        (w) =>
          w.listId === DEFAULT_WATCHLIST_LIST_ID &&
          w.kind === 'equity' &&
          w.symbol.trim().toUpperCase() === nseSymbol.trim().toUpperCase(),
      ),
    [watchlist],
  );

  const selectedTvSymbol = useMemo(() => {
    if (rows.length === 0) return querySymbol ?? '';
    if (querySymbol && rows.some((r) => toTvSymbol(r.symbol) === querySymbol)) return querySymbol;
    return toTvSymbol(rows[0].symbol);
  }, [rows, querySymbol]);

  const chartNseSymbol = useMemo(() => {
    const row = rows.find((r) => toTvSymbol(r.symbol) === selectedTvSymbol);
    return row ? row.symbol.trim().toUpperCase() : '';
  }, [rows, selectedTvSymbol]);

  useEffect(() => {
    if (rows.length === 0) return;
    if (!querySymbol || !rows.some((r) => toTvSymbol(r.symbol) === querySymbol)) {
      router.replace(`/52w-scanner?symbol=${encodeURIComponent(toTvSymbol(rows[0].symbol))}`, {
        scroll: false,
      });
    }
  }, [rows, querySymbol, router]);

  const onSelect = useCallback(
    (tvSymbol: string) => {
      router.replace(`/52w-scanner?symbol=${encodeURIComponent(tvSymbol)}`, { scroll: false });
    },
    [router],
  );

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-white">52 H Scanner</h1>
          <p className="mt-1 text-sm text-gray-500">
            NSE 52-week highs on the left; select any stock for K-line (NSE) or TradingView on the right.
          </p>
          {data?.timestamp ? (
            <p className="mt-1 text-[11px] text-gray-600">Snapshot: {data.timestamp}</p>
          ) : null}
        </div>
        <button
          type="button"
          onClick={() => void refetch()}
          disabled={isFetching}
          className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-medium text-gray-300 hover:bg-white/10 disabled:opacity-60"
        >
          {isFetching ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
          ) : (
            <RefreshCcw className="h-3.5 w-3.5" aria-hidden />
          )}
          Refresh
        </button>
      </div>

      {error ? (
        <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4 text-sm text-gray-300">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" aria-hidden />
            <span>{error instanceof Error ? error.message : 'Failed to load 52 week high data.'}</span>
          </div>
        </div>
      ) : null}

      <div className="flex h-[min(max(480px,calc(100dvh-14rem)),880px)] flex-col overflow-hidden rounded-3xl border border-white/10 bg-[#161618] lg:flex-row">
        <aside className="flex max-h-[40%] min-h-0 w-full shrink-0 flex-col overflow-hidden border-b border-white/10 lg:h-full lg:max-h-none lg:w-[min(100%,360px)] lg:border-b-0 lg:border-r">
          <div className="flex shrink-0 items-center justify-between border-b border-white/5 px-4 py-3">
            <span className="text-[10px] font-bold uppercase tracking-widest text-gray-500">
              52W high stocks ({rows.length})
            </span>
            {isFetching || isLoading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-400" aria-hidden />
            ) : null}
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-2">
            {isLoading ? (
              <div className="px-3 py-8 text-center text-sm text-gray-500">Loading scanner list...</div>
            ) : rows.length === 0 ? (
              <div className="px-3 py-8 text-center text-sm text-gray-500">
                No 52-week high stocks returned by NSE right now.
              </div>
            ) : (
              <ul className="space-y-1">
                {rows.map((row) => {
                  const tvSymbol = toTvSymbol(row.symbol);
                  const isSelected = tvSymbol === selectedTvSymbol;
                  const isPositive = (row.change ?? 0) >= 0;
                  const bookmarked = isBookmarked(row.symbol);
                  return (
                    <li key={row.symbol}>
                      <div
                        className={`flex items-start gap-2 rounded-2xl border px-3 py-3 transition-colors ${
                          isSelected
                            ? 'border-blue-500/40 bg-blue-500/10 text-white'
                            : 'border-transparent bg-transparent text-gray-300 hover:border-white/10 hover:bg-white/5'
                        }`}
                      >
                        <button type="button" onClick={() => onSelect(tvSymbol)} className="min-w-0 flex-1 text-left">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <div className="font-bold tracking-tight">{row.symbol}</div>
                              <div className="mt-0.5 truncate text-[11px] text-gray-500">{row.companyName}</div>
                            </div>
                            <span
                              className={`rounded-md px-1.5 py-0.5 text-[10px] font-bold ${
                                isPositive ? 'text-green-300' : 'text-red-300'
                              }`}
                            >
                              {row.pChange == null ? '—' : `${row.pChange.toFixed(2)}%`}
                            </span>
                          </div>
                          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-gray-400">
                            <span>LTP ₹{formatPrice(row.ltp)}</span>
                            <span>New high ₹{formatPrice(row.new52WHL)}</span>
                          </div>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            void toggleWatchlist({
                              listId: DEFAULT_WATCHLIST_LIST_ID,
                              kind: 'equity',
                              symbol: row.symbol,
                              companyName: row.companyName,
                            });
                          }}
                          aria-label={
                            bookmarked
                              ? `Remove ${row.symbol} from watchlist`
                              : `Add ${row.symbol} to watchlist`
                          }
                          className={`shrink-0 rounded-lg border p-1 transition-colors ${
                            bookmarked
                              ? 'border-amber-400/30 bg-amber-500/10 text-amber-300'
                              : 'border-white/10 text-gray-500 hover:border-white/20 hover:text-gray-300'
                          }`}
                        >
                          {bookmarked ? (
                            <BookmarkCheck className="h-3.5 w-3.5" aria-hidden />
                          ) : (
                            <Bookmark className="h-3.5 w-3.5" aria-hidden />
                          )}
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
              <div className="mb-2 flex shrink-0 flex-wrap items-center gap-2 text-xs text-gray-500">
                <LineChart className="h-4 w-4 text-blue-400" aria-hidden />
                <span className="font-mono text-[11px] text-gray-400">{selectedTvSymbol}</span>
                <div className="ml-auto flex items-center gap-0.5 rounded-lg border border-white/10 bg-[#0a0a0b] p-0.5">
                  <button
                    type="button"
                    onClick={() => setChartMode('kline')}
                    className={`rounded-md px-2 py-1 text-[10px] font-bold uppercase tracking-wide transition-colors ${
                      chartMode === 'kline'
                        ? 'bg-blue-500/30 text-blue-100'
                        : 'text-gray-500 hover:bg-white/5 hover:text-gray-300'
                    }`}
                  >
                    K-line
                  </button>
                  <button
                    type="button"
                    onClick={() => setChartMode('tradingview')}
                    className={`rounded-md px-2 py-1 text-[10px] font-bold uppercase tracking-wide transition-colors ${
                      chartMode === 'tradingview'
                        ? 'bg-blue-500/30 text-blue-100'
                        : 'text-gray-500 hover:bg-white/5 hover:text-gray-300'
                    }`}
                  >
                    TradingView
                  </button>
                </div>
              </div>
              <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
                {chartNseSymbol ? (
                  chartMode === 'kline' ? (
                    <NseEquityCandleChartWidget
                      key={chartNseSymbol}
                      symbol={chartNseSymbol}
                      className="absolute inset-0 flex h-full min-h-0 w-full flex-col"
                    />
                  ) : (
                    <TradingViewAdvancedChartWidget
                      key={`${chartNseSymbol}-${selectedTvSymbol}`}
                      symbol={selectedTvSymbol}
                      className="absolute inset-0 flex h-full min-h-0 w-full flex-col"
                    />
                  )
                ) : null}
              </div>
            </div>
          ) : (
            <div className="flex flex-1 items-center justify-center text-sm text-gray-500">
              Select a stock from the scanner to load a chart.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
