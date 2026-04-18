'use client';

import { useEffect, useMemo, useCallback, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AlertTriangle, Bookmark, BookmarkCheck, LineChart, Loader2, RefreshCcw } from 'lucide-react';
import NseEquityCandleChartWidget from '@/components/NseEquityCandleChartWidget';
import TradingViewAdvancedChartWidget from '@/components/TradingViewAdvancedChartWidget';
import { use52wScannerQuery } from '@/features/52wScanner/use52wScannerQuery';
import { useTradingViewMonthlyScannerQuery } from '@/features/52wScanner/useTradingViewMonthlyScannerQuery';
import { tradingViewScreenerRowToListItem } from '@/lib/tradingview-india-screener';
import { toBseTradingViewQuerySymbol, toTradingViewSymbol } from '@/lib/tradingview-symbol';
import { DEFAULT_WATCHLIST_LIST_ID } from '@/lib/watchlist-defaults';
import { useTradeStore } from '@/store/useTradeStore';

function toTvSymbol(nseSymbol: string): string {
  return toTradingViewSymbol(nseSymbol);
}

function formatPrice(v: number | null): string {
  if (v == null) return '—';
  return v.toLocaleString('en-IN', { maximumFractionDigits: 2 });
}

type ScannerTab = '52h' | 'monthly';

export default function Scanner52wWorkspace() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const querySymbol = searchParams.get('symbol');
  const scannerTab: ScannerTab = searchParams.get('tab') === 'monthly' ? 'monthly' : '52h';

  const [chartMode, setChartMode] = useState<'kline' | 'tradingview'>('kline');

  const { data, isLoading, isFetching, error, refetch } = use52wScannerQuery();
  const rows = data?.data ?? [];

  const monthlyQuery = useTradingViewMonthlyScannerQuery(scannerTab === 'monthly');
  const monthlyRows = useMemo(
    () => (monthlyQuery.data?.data ?? []).map(tradingViewScreenerRowToListItem),
    [monthlyQuery.data?.data],
  );

  const watchlist = useTradeStore((s) => s.watchlist);
  const toggleWatchlist = useTradeStore((s) => s.toggleWatchlist);
  const isBookmarked52h = useCallback(
    (nseSymbol: string) =>
      watchlist.some(
        (w) =>
          w.listId === DEFAULT_WATCHLIST_LIST_ID &&
          w.kind === 'equity' &&
          w.symbol.trim().toUpperCase() === nseSymbol.trim().toUpperCase(),
      ),
    [watchlist],
  );
  const isBookmarkedTicker = useCallback(
    (ticker: string) =>
      watchlist.some(
        (w) =>
          w.listId === DEFAULT_WATCHLIST_LIST_ID &&
          w.kind === 'equity' &&
          w.symbol.trim().toUpperCase() === ticker.trim().toUpperCase(),
      ),
    [watchlist],
  );

  const setScannerTab = useCallback(
    (next: ScannerTab) => {
      const params = new URLSearchParams(searchParams.toString());
      if (next === 'monthly') {
        params.set('tab', 'monthly');
      } else {
        params.delete('tab');
      }
      const q = params.toString();
      router.replace(q ? `/52w-scanner?${q}` : `/52w-scanner`, { scroll: false });
    },
    [router, searchParams],
  );

  const selectedTvSymbol = useMemo(() => {
    if (scannerTab === 'monthly') {
      if (monthlyRows.length === 0) return querySymbol?.trim() ?? '';
      if (querySymbol && monthlyRows.some((r) => r.tvSymbol === querySymbol)) return querySymbol;
      return monthlyRows[0].tvSymbol;
    }
    if (rows.length === 0) return querySymbol?.trim() ?? '';
    if (querySymbol && rows.some((r) => toTvSymbol(r.symbol) === querySymbol)) return querySymbol;
    return toTvSymbol(rows[0].symbol);
  }, [scannerTab, monthlyRows, rows, querySymbol]);

  const chartNseSymbol = useMemo(() => {
    if (scannerTab === 'monthly') {
      const item = monthlyRows.find((r) => r.tvSymbol === selectedTvSymbol);
      return item?.isNse ? item.ticker : '';
    }
    const row = rows.find((r) => toTvSymbol(r.symbol) === selectedTvSymbol);
    return row ? row.symbol.trim().toUpperCase() : '';
  }, [scannerTab, monthlyRows, rows, selectedTvSymbol]);

  /** TradingView widget expects `BSE:ticker` when the screener returns `NSE:ticker`. */
  const tradingViewChartSymbol = useMemo(
    () => toBseTradingViewQuerySymbol(selectedTvSymbol),
    [selectedTvSymbol],
  );

  useEffect(() => {
    if (scannerTab !== '52h') return;
    if (rows.length === 0) return;
    if (!querySymbol || !rows.some((r) => toTvSymbol(r.symbol) === querySymbol)) {
      const params = new URLSearchParams(searchParams.toString());
      params.delete('tab');
      params.set('symbol', toTvSymbol(rows[0].symbol));
      router.replace(`/52w-scanner?${params.toString()}`, { scroll: false });
    }
  }, [scannerTab, rows, querySymbol, router, searchParams]);

  useEffect(() => {
    if (scannerTab !== 'monthly') return;
    if (monthlyRows.length === 0) return;
    if (!querySymbol || !monthlyRows.some((r) => r.tvSymbol === querySymbol)) {
      const params = new URLSearchParams(searchParams.toString());
      params.set('tab', 'monthly');
      params.set('symbol', monthlyRows[0].tvSymbol);
      router.replace(`/52w-scanner?${params.toString()}`, { scroll: false });
    }
  }, [scannerTab, monthlyRows, querySymbol, router, searchParams]);

  useEffect(() => {
    if (scannerTab !== 'monthly') return;
    if (!chartNseSymbol && chartMode === 'kline') {
      setChartMode('tradingview');
    }
  }, [scannerTab, chartNseSymbol, chartMode]);

  const onSelect = useCallback(
    (tvSymbol: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (scannerTab === 'monthly') {
        params.set('tab', 'monthly');
      } else {
        params.delete('tab');
      }
      params.set('symbol', tvSymbol);
      router.replace(`/52w-scanner?${params.toString()}`, { scroll: false });
    },
    [router, searchParams, scannerTab],
  );

  const onRefresh = useCallback(() => {
    if (scannerTab === 'monthly') void monthlyQuery.refetch();
    else void refetch();
  }, [scannerTab, monthlyQuery, refetch]);

  const listFetching = scannerTab === 'monthly' ? monthlyQuery.isFetching : isFetching;
  const listLoading = scannerTab === 'monthly' ? monthlyQuery.isLoading : isLoading;
  const listError = scannerTab === 'monthly' ? monthlyQuery.error : error;

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-white">Scanner</h1>
          <p className="mt-1 text-sm text-gray-500">
            {scannerTab === 'monthly'
              ? 'Monthly high screen (TradingView India): pick a symbol for K-line (NSE) or TradingView on the right.'
              : 'NSE 52-week highs on the left; select any stock for K-line (NSE) or TradingView on the right.'}
          </p>
          {scannerTab === '52h' && data?.timestamp ? (
            <p className="mt-1 text-[11px] text-gray-600">Snapshot: {data.timestamp}</p>
          ) : null}
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setScannerTab('52h')}
              className={`rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${
                scannerTab === '52h'
                  ? 'border-blue-500/50 bg-blue-500/15 text-blue-100'
                  : 'border-white/10 bg-white/5 text-gray-400 hover:border-white/20 hover:text-gray-200'
              }`}
            >
              52 H
            </button>
            <button
              type="button"
              onClick={() => setScannerTab('monthly')}
              className={`rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${
                scannerTab === 'monthly'
                  ? 'border-blue-500/50 bg-blue-500/15 text-blue-100'
                  : 'border-white/10 bg-white/5 text-gray-400 hover:border-white/20 hover:text-gray-200'
              }`}
            >
              Monthly H
            </button>
          </div>
        </div>
        <button
          type="button"
          onClick={onRefresh}
          disabled={listFetching}
          className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-medium text-gray-300 hover:bg-white/10 disabled:opacity-60"
        >
          {listFetching ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
          ) : (
            <RefreshCcw className="h-3.5 w-3.5" aria-hidden />
          )}
          Refresh
        </button>
      </div>

      {listError ? (
        <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4 text-sm text-gray-300">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" aria-hidden />
            <span>
              {listError instanceof Error
                ? listError.message
                : scannerTab === 'monthly'
                  ? 'Failed to load TradingView monthly screen.'
                  : 'Failed to load 52 week high data.'}
            </span>
          </div>
        </div>
      ) : null}

      <div className="flex h-[min(max(480px,calc(100dvh-14rem)),880px)] flex-col overflow-hidden rounded-3xl border border-white/10 bg-[#161618] lg:flex-row">
        <aside className="flex max-h-[40%] min-h-0 w-full shrink-0 flex-col overflow-hidden border-b border-white/10 lg:h-full lg:max-h-none lg:w-[min(100%,360px)] lg:border-b-0 lg:border-r">
          <div className="flex shrink-0 items-center justify-between border-b border-white/5 px-4 py-3">
            <span className="text-[10px] font-bold uppercase tracking-widest text-gray-500">
              {scannerTab === 'monthly'
                ? `Monthly screen (${monthlyRows.length}${monthlyQuery.data?.totalCount != null ? ` / ${monthlyQuery.data.totalCount}` : ''})`
                : `52W high stocks (${rows.length})`}
            </span>
            {listFetching || listLoading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-400" aria-hidden />
            ) : null}
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-2">
            {scannerTab === '52h' ? (
              listLoading ? (
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
                    const bookmarked = isBookmarked52h(row.symbol);
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
              )
            ) : listLoading ? (
              <div className="px-3 py-8 text-center text-sm text-gray-500">Loading monthly screen…</div>
            ) : monthlyRows.length === 0 ? (
              <div className="px-3 py-8 text-center text-sm text-gray-500">
                No symbols matched this TradingView screen right now.
              </div>
            ) : (
              <ul className="space-y-1">
                {monthlyRows.map((row) => {
                  const isSelected = row.tvSymbol === selectedTvSymbol;
                  const ch = row.changePct;
                  const isPositive = ch == null ? true : ch >= 0;
                  const bookmarked = isBookmarkedTicker(row.ticker);
                  return (
                    <li key={row.tvSymbol}>
                      <div
                        className={`flex items-start gap-2 rounded-2xl border px-3 py-3 transition-colors ${
                          isSelected
                            ? 'border-blue-500/40 bg-blue-500/10 text-white'
                            : 'border-transparent bg-transparent text-gray-300 hover:border-white/10 hover:bg-white/5'
                        }`}
                      >
                        <button type="button" onClick={() => onSelect(row.tvSymbol)} className="min-w-0 flex-1 text-left">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <div className="font-bold tracking-tight">{row.tvSymbol}</div>
                              <div className="mt-0.5 truncate text-[11px] text-gray-500">{row.companyName}</div>
                            </div>
                            <span
                              className={`rounded-md px-1.5 py-0.5 text-[10px] font-bold ${
                                isPositive ? 'text-green-300' : 'text-red-300'
                              }`}
                            >
                              {ch == null ? '—' : `${ch.toFixed(2)}%`}
                            </span>
                          </div>
                          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-gray-400">
                            <span>Close ₹{formatPrice(row.close)}</span>
                            <span>{row.exchange}</span>
                          </div>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            void toggleWatchlist({
                              listId: DEFAULT_WATCHLIST_LIST_ID,
                              kind: 'equity',
                              symbol: row.ticker,
                              companyName: row.companyName,
                            });
                          }}
                          aria-label={
                            bookmarked
                              ? `Remove ${row.ticker} from watchlist`
                              : `Add ${row.ticker} to watchlist`
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
                <span className="font-mono text-[11px] text-gray-400">
                  {chartMode === 'tradingview' ? tradingViewChartSymbol : selectedTvSymbol}
                </span>
                <div className="ml-auto flex items-center gap-0.5 rounded-lg border border-white/10 bg-[#0a0a0b] p-0.5">
                  <button
                    type="button"
                    onClick={() => setChartMode('kline')}
                    disabled={scannerTab === 'monthly' && !chartNseSymbol}
                    className={`rounded-md px-2 py-1 text-[10px] font-bold uppercase tracking-wide transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
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
                {chartMode === 'kline' && chartNseSymbol ? (
                  <NseEquityCandleChartWidget
                    key={chartNseSymbol}
                    symbol={chartNseSymbol}
                    className="absolute inset-0 flex h-full min-h-0 w-full flex-col"
                  />
                ) : chartMode === 'tradingview' ? (
                  <TradingViewAdvancedChartWidget
                    key={tradingViewChartSymbol}
                    symbol={tradingViewChartSymbol}
                    className="absolute inset-0 flex h-full min-h-0 w-full flex-col"
                  />
                ) : (
                  <div className="flex flex-1 items-center justify-center px-4 text-center text-sm text-gray-500">
                    K-line is only available for NSE symbols. Use TradingView for BSE and other exchanges.
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="flex flex-1 items-center justify-center text-sm text-gray-500">
              {scannerTab === 'monthly' && listLoading
                ? 'Loading monthly screen…'
                : 'Select a stock from the scanner to load a chart.'}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
