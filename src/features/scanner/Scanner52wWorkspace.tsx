'use client';

import { useEffect, useMemo, useCallback, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  AlertTriangle,
  Bookmark,
  BookmarkCheck,
  Eye,
  LineChart,
  Loader2,
  Network,
  Newspaper,
  RefreshCcw,
  Sparkles,
} from 'lucide-react';
import NseEquityCandleChartWidget from '@/components/NseEquityCandleChartWidget';
import TradingViewAdvancedChartWidget from '@/components/TradingViewAdvancedChartWidget';
import ScanAnalysisSheet from '@/features/scanner/ScanAnalysisSheet';
import StockAiOverviewSheet from '@/features/scanner/StockAiOverviewSheet';
import StockNewsSheet from '@/features/news/StockNewsSheet';
import { useTradingViewIndiaScreenerQuery } from '@/features/scanner/useTradingViewIndiaScreenerQuery';
import { useBusinessAnalysisSummariesQuery } from '@/features/ai/useBusinessAnalysisSummariesQuery';
import { tradingViewScreenerRowToListItem } from '@/lib/tradingview-india-screener';
import { toBseTradingViewQuerySymbol } from '@/lib/tradingview-symbol';
import { DEFAULT_WATCHLIST_LIST_ID } from '@/lib/watchlist-defaults';
import { useTradeStore } from '@/store/useTradeStore';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useAdjacentNseChartPrefetch } from '@/hooks/useAdjacentNseChartPrefetch';
import { usePremiumAiGate } from '@/hooks/usePremiumAiGate';
import { normalizeBusinessTicker } from '@/lib/ai/business-analysis';

function formatPrice(v: number | null): string {
  if (v == null) return '—';
  return v.toLocaleString('en-IN', { maximumFractionDigits: 2 });
}

const TODAYS_SPECIAL_FILTER_LINES = [
  'Change: 1% to 8.3%',
  'RSI > 58 and Weekly RSI > 55',
  'Perf.W: 2% to 17%',
  'Relative volume (10D) > 1.2',
  '10D avg traded value > 20M',
  'EMA20 >= EMA50 and EMA100',
  'Market cap >= 1B and primary listings only',
] as const;

const SCANNER_SUBTITLE =
  'Momentum and liquidity screen for today: positive weekly strength with RSI and EMA trend filters.';

export default function Scanner52wWorkspace() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const querySymbol = searchParams.get('symbol');

  const [chartMode, setChartMode] = useState<'kline' | 'tradingview'>('kline');
  const [aiSheetOpen, setAiSheetOpen] = useState(false);
  const [newsSheetOpen, setNewsSheetOpen] = useState(false);
  const [scanAnalysisOpen, setScanAnalysisOpen] = useState(false);
  const { requirePremiumForAi, guardAiSheetOpen } = usePremiumAiGate();

  const todaysSpecialQuery = useTradingViewIndiaScreenerQuery();
  const tvRows = useMemo(
    () => (todaysSpecialQuery.data?.data ?? []).map((row) => tradingViewScreenerRowToListItem(row)),
    [todaysSpecialQuery.data?.data],
  );
  const scannerListTickers = useMemo(() => tvRows.map((row) => row.ticker), [tvRows]);
  const { summaryByTicker: businessSummaryByTicker } =
    useBusinessAnalysisSummariesQuery(scannerListTickers);
  const watchlist = useTradeStore((s) => s.watchlist);
  const toggleWatchlist = useTradeStore((s) => s.toggleWatchlist);
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

  const scanAnalysisStocks = useMemo(
    () =>
      tvRows.map((row) => ({
        symbol: row.ticker,
        name: row.companyName || row.ticker,
      })),
    [tvRows],
  );

  const selectedTvSymbol = useMemo(() => {
    if (tvRows.length === 0) return '';
    if (querySymbol && tvRows.some((r) => r.tvSymbol === querySymbol)) return querySymbol;
    return tvRows[0].tvSymbol;
  }, [tvRows, querySymbol]);

  const selectedTickerForQuote = useMemo(() => {
    if (!querySymbol) return '';
    const selected = tvRows.find((row) => row.tvSymbol === querySymbol);
    if (!selected?.isNse) return '';
    return selected.ticker.trim().toUpperCase();
  }, [querySymbol, tvRows]);
  const selectedPChange = undefined;

  const chartNseSymbol = useMemo(() => {
    const item = tvRows.find((row) => row.tvSymbol === selectedTvSymbol);
    return item?.isNse ? item.ticker : '';
  }, [tvRows, selectedTvSymbol]);

  const selectedStock = useMemo<{ ticker: string; companyName: string } | null>(() => {
    const r = tvRows.find((x) => x.tvSymbol === selectedTvSymbol);
    return r ? { ticker: r.ticker, companyName: r.companyName } : null;
  }, [tvRows, selectedTvSymbol]);

  const tradingViewChartSymbol = useMemo(
    () => toBseTradingViewQuerySymbol(selectedTvSymbol),
    [selectedTvSymbol],
  );

  const chartPrefetchItems = useMemo(
    () =>
      tvRows.map((row) => ({
        symbol: row.isNse ? row.ticker.trim().toUpperCase() : '',
        seriesKind: 'equity' as const,
      })),
    [tvRows],
  );
  const selectedChartIndex = useMemo(
    () => tvRows.findIndex((row) => row.tvSymbol === selectedTvSymbol),
    [tvRows, selectedTvSymbol],
  );
  useAdjacentNseChartPrefetch({
    items: chartPrefetchItems,
    currentIndex: selectedChartIndex,
    enabled: false,
  });

  useEffect(() => {
    if (tvRows.length === 0) return;
    if (!querySymbol || !tvRows.some((r) => r.tvSymbol === querySymbol)) {
      const params = new URLSearchParams(searchParams.toString());
      params.delete('tab');
      params.set('symbol', tvRows[0].tvSymbol);
      const nextQuery = params.toString();
      const currentQuery = searchParams.toString();
      if (nextQuery !== currentQuery) {
        router.replace(nextQuery ? `/52w-scanner?${nextQuery}` : '/52w-scanner', { scroll: false });
      }
    }
  }, [tvRows, querySymbol, router, searchParams]);

  useEffect(() => {
    if (!chartNseSymbol && chartMode === 'kline') {
      setChartMode('tradingview');
    }
  }, [chartNseSymbol, chartMode]);

  const onSelect = useCallback(
    (tvSymbol: string) => {
      const params = new URLSearchParams(searchParams.toString());
      params.delete('tab');
      params.set('symbol', tvSymbol);
      router.replace(`/52w-scanner?${params.toString()}`, { scroll: false });
    },
    [router, searchParams],
  );

  const onRefresh = useCallback(() => {
    void todaysSpecialQuery.refetch();
  }, [todaysSpecialQuery]);

  const listFetching = todaysSpecialQuery.isFetching;
  const listLoading = todaysSpecialQuery.isLoading;
  const listError = todaysSpecialQuery.error ?? null;

  const listLabel = `Todays Special (${tvRows.length}${
    todaysSpecialQuery.data?.totalCount != null ? ` / ${todaysSpecialQuery.data.totalCount}` : ''
  })`;

  return (
    <div className="flex h-full min-h-0 flex-col gap-2">
      <header className="shrink-0 rounded-xl border border-white/8 bg-[#111114] px-4 py-3.5 sm:px-5 sm:py-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-black tracking-tight text-white sm:text-2xl">Todays Special</h1>
              <TooltipProvider delay={200}>
                <Tooltip>
                  <TooltipTrigger
                    type="button"
                    className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-[10px] font-semibold text-gray-400"
                  >
                    <Eye className="h-3 w-3 opacity-70" aria-hidden />
                    Filters
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="max-w-xs text-left text-[11px] leading-snug">
                    <div className="space-y-2">
                      <p>{SCANNER_SUBTITLE}</p>
                      <div className="border-t border-white/10 pt-2">
                        <div className="mb-1 font-bold uppercase tracking-wide text-cyan-200">Filter</div>
                        <ul className="space-y-1 text-gray-300">
                          {TODAYS_SPECIAL_FILTER_LINES.map((line) => (
                            <li key={line}>{line}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <p className="mt-1.5 max-w-2xl text-[12px] leading-relaxed text-gray-500 sm:text-[13px]">
              {SCANNER_SUBTITLE}
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => {
                if (tvRows.length === 0) return;
                requirePremiumForAi(() => setScanAnalysisOpen(true));
              }}
              disabled={tvRows.length === 0}
              className="inline-flex items-center gap-1.5 rounded-lg border border-cyan-400/25 bg-cyan-500/10 px-3 py-1.5 text-[11px] font-semibold text-cyan-200 transition-colors hover:bg-cyan-500/18 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Network className="h-3.5 w-3.5" aria-hidden />
              <span className="hidden sm:inline">List Analysis</span>
            </button>
            <button
              type="button"
              onClick={() => {
                if (!selectedStock) return;
                setNewsSheetOpen(true);
              }}
              disabled={!selectedStock}
              aria-label={selectedStock ? `News for ${selectedStock.ticker}` : 'News (select a stock first)'}
              className="inline-flex items-center gap-1.5 rounded-lg border border-sky-400/30 bg-sky-500/10 px-3 py-1.5 text-[11px] font-semibold text-sky-200 transition-colors hover:bg-sky-500/18 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Newspaper className="h-3.5 w-3.5" aria-hidden />
              News
            </button>
            <button
              type="button"
              onClick={() => {
                if (!selectedStock) return;
                requirePremiumForAi(() => setAiSheetOpen(true));
              }}
              disabled={!selectedStock}
              aria-label={
                selectedStock
                  ? `Business Analysis for ${selectedStock.ticker}`
                  : 'Business Analysis (select a stock first)'
              }
              className="inline-flex items-center gap-1.5 rounded-lg border border-violet-400/30 bg-violet-500/10 px-3 py-1.5 text-[11px] font-semibold text-violet-200 transition-colors hover:bg-violet-500/18 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Sparkles className="h-3.5 w-3.5" aria-hidden />
              Business Analysis
            </button>
            <button
              type="button"
              onClick={onRefresh}
              disabled={listFetching}
              title="Refresh screen"
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-[11px] font-medium text-gray-300 transition-colors hover:bg-white/8 disabled:opacity-60"
            >
              {listFetching ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
              ) : (
                <RefreshCcw className="h-3.5 w-3.5" aria-hidden />
              )}
              <span className="hidden sm:inline">Refresh</span>
            </button>
          </div>
        </div>
      </header>

      <StockNewsSheet
        open={newsSheetOpen}
        onOpenChange={setNewsSheetOpen}
        ticker={selectedStock?.ticker ?? ''}
        companyName={selectedStock?.companyName ?? ''}
      />
      <StockAiOverviewSheet
        open={aiSheetOpen}
        onOpenChange={(open) => guardAiSheetOpen(open, setAiSheetOpen)}
        ticker={selectedStock?.ticker ?? ''}
        companyName={selectedStock?.companyName ?? ''}
      />
      <ScanAnalysisSheet
        open={scanAnalysisOpen}
        onOpenChange={(open) => guardAiSheetOpen(open, setScanAnalysisOpen)}
        scannerName="Todays Special"
        stocks={scanAnalysisStocks}
      />

      {listError ? (
        <div className="flex shrink-0 items-center gap-2 rounded-lg border border-amber-500/20 bg-amber-500/6 px-3 py-1.5 text-[11px] text-amber-100">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-400" aria-hidden />
          <span>
            {listError instanceof Error ? listError.message : 'Failed to load TradingView screen.'}
          </span>
        </div>
      ) : null}

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-white/8 bg-[#111114] lg:flex-row">
        <aside className="flex max-h-[28%] min-h-0 w-full shrink-0 flex-col overflow-hidden border-b border-white/7 lg:h-full lg:max-h-none lg:w-[320px] lg:border-b-0 lg:border-r lg:border-white/7">
          <div className="flex shrink-0 items-center justify-between gap-2 border-b border-white/6 px-4 py-2.5">
            <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-gray-500">{listLabel}</span>
            {listFetching || listLoading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin text-cyan-400" aria-hidden />
            ) : null}
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
            {listLoading ? (
              <div className="flex flex-col items-center justify-center gap-2 px-4 py-12 text-center">
                <Loader2 className="h-5 w-5 animate-spin text-gray-600" aria-hidden />
                <span className="text-[12px] text-gray-600">Loading Todays Special…</span>
              </div>
            ) : tvRows.length === 0 ? (
              <div className="px-4 py-12 text-center text-[12px] text-gray-600">
                No symbols matched this screen right now.
              </div>
            ) : (
              <ul>
                {tvRows.map((row) => {
                  const isSelected = row.tvSymbol === selectedTvSymbol;
                  const upperTicker = row.ticker.trim().toUpperCase();
                  const summaryKey = normalizeBusinessTicker(row.ticker);
                  const ch =
                    isSelected &&
                    selectedTickerForQuote === upperTicker &&
                    typeof selectedPChange === 'number' &&
                    Number.isFinite(selectedPChange)
                      ? selectedPChange
                      : row.changePct;
                  const isPositive = ch == null ? true : ch >= 0;
                  const bookmarked = isBookmarkedTicker(row.ticker);
                  const businessSummary = businessSummaryByTicker.get(summaryKey);
                  return (
                    <li
                      key={row.tvSymbol}
                      className={`border-b border-white/4 last:border-b-0 ${isSelected ? 'bg-white/5.5' : ''}`}
                    >
                      <div
                        className={`flex items-stretch gap-0 transition-colors ${
                          isSelected ? '' : 'hover:bg-white/3'
                        }`}
                      >
                        <div className={`w-[3px] shrink-0 rounded-full ${isSelected ? 'bg-cyan-400' : 'bg-transparent'}`} />

                        <button
                          type="button"
                          onClick={() => onSelect(row.tvSymbol)}
                          className="min-w-0 flex-1 px-3 py-2.5 text-left"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex min-w-0 items-center gap-1.5">
                              <span
                                className={`text-[13px] font-bold tracking-tight ${isSelected ? 'text-white' : 'text-gray-200'}`}
                              >
                                {row.ticker.replace(/^(NSE:|BSE:)/, '')}
                              </span>
                              {businessSummary ? (
                                <span
                                  className="rounded border border-violet-400/25 bg-violet-500/12 px-1.5 py-px text-[9px] font-bold tracking-wide text-violet-300"
                                  title={businessSummary.ratingReasons.join(' · ')}
                                >
                                  Business {businessSummary.category}{' '}
                                  {businessSummary.direction === 'up'
                                    ? '↑'
                                    : businessSummary.direction === 'down'
                                      ? '↓'
                                      : '→'}
                                </span>
                              ) : null}
                            </div>
                            {ch != null ? (
                              <span
                                className={`shrink-0 rounded-md px-1.5 py-0.5 text-[11px] font-bold tabular-nums ${
                                  isPositive
                                    ? 'bg-emerald-500/12 text-emerald-300'
                                    : 'bg-red-500/12 text-red-300'
                                }`}
                              >
                                {isPositive ? '+' : ''}
                                {ch.toFixed(2)}%
                              </span>
                            ) : (
                              <span className="shrink-0 text-[11px] text-gray-600">—</span>
                            )}
                          </div>

                          <div className="mt-0.5 truncate text-[11px] text-gray-500">{row.companyName}</div>
                          <div className="mt-1 flex items-center gap-2 text-[11px] text-gray-500">
                            <span className="font-medium tabular-nums text-gray-400">₹{formatPrice(row.close)}</span>
                            <span className="text-gray-600">{row.exchange}</span>
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
                            bookmarked ? `Remove ${row.ticker} from watchlist` : `Add ${row.ticker} to watchlist`
                          }
                          className={`flex shrink-0 items-center px-2 transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                            bookmarked ? 'text-amber-400' : 'text-gray-600 hover:text-gray-300'
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

        <div className="flex min-h-0 flex-1 flex-col bg-[#0d0d10] p-2 sm:p-2.5">
          {selectedTvSymbol ? (
            <div className="flex min-h-0 flex-1 flex-col">
              <div className="flex shrink-0 items-center gap-2 border-b border-white/6 pb-2">
                <LineChart className="h-3.5 w-3.5 shrink-0 text-cyan-400" aria-hidden />
                <span className="min-w-0 truncate font-mono text-[11px] font-medium text-gray-300">
                  {chartMode === 'tradingview' ? tradingViewChartSymbol : selectedTvSymbol}
                </span>
                <div className="ml-auto inline-flex shrink-0 items-center gap-0.5 rounded-lg border border-white/8 bg-black/30 p-0.5">
                  <button
                    type="button"
                    onClick={() => setChartMode('kline')}
                    disabled={!chartNseSymbol}
                    className={`rounded-md px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide transition-all disabled:cursor-not-allowed disabled:opacity-40 ${
                      chartMode === 'kline'
                        ? 'bg-cyan-500/20 text-cyan-200 shadow-sm'
                        : 'text-gray-500 hover:bg-white/5 hover:text-gray-300'
                    }`}
                  >
                    K-line
                  </button>
                  <button
                    type="button"
                    onClick={() => setChartMode('tradingview')}
                    className={`rounded-md px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide transition-all ${
                      chartMode === 'tradingview'
                        ? 'bg-cyan-500/20 text-cyan-200 shadow-sm'
                        : 'text-gray-500 hover:bg-white/5 hover:text-gray-300'
                    }`}
                  >
                    TradingView
                  </button>
                </div>
              </div>

              <div className="relative mt-2 flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-white/6">
                {chartMode === 'kline' && chartNseSymbol ? (
                  <NseEquityCandleChartWidget
                    key={chartNseSymbol}
                    symbol={chartNseSymbol}
                    defaultPeriod="1h"
                    className="absolute inset-0 flex h-full min-h-0 w-full flex-col"
                  />
                ) : chartMode === 'tradingview' ? (
                  <TradingViewAdvancedChartWidget
                    key={tradingViewChartSymbol}
                    symbol={tradingViewChartSymbol}
                    className="absolute inset-0 flex h-full min-h-0 w-full flex-col"
                  />
                ) : (
                  <div className="flex flex-1 items-center justify-center px-4 text-center text-[12px] text-gray-600">
                    K-line is only available for NSE symbols. Switch to TradingView for BSE and other exchanges.
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center">
              {listLoading ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin text-gray-600" aria-hidden />
                  <span className="text-[12px] text-gray-600">Loading Todays Special…</span>
                </>
              ) : (
                <>
                  <LineChart className="h-8 w-8 text-gray-700" aria-hidden />
                  <span className="text-[13px] text-gray-600">Select a stock to load the chart</span>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
