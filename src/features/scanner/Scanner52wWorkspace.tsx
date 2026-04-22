'use client';

import { useEffect, useMemo, useCallback, useState } from 'react';
import { useQueries, useQueryClient } from '@tanstack/react-query';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  AlertTriangle,
  Bookmark,
  BookmarkCheck,
  LineChart,
  Loader2,
  RefreshCcw,
  Sparkles,
} from 'lucide-react';
import NseEquityCandleChartWidget from '@/components/NseEquityCandleChartWidget';
import TradingViewAdvancedChartWidget from '@/components/TradingViewAdvancedChartWidget';
import TechnicalChartScoreControl, {
  compactStockTagLabel,
  stockTagBadgeClass,
} from '@/components/TechnicalChartScoreControl';
import StockAiOverviewSheet from '@/features/scanner/StockAiOverviewSheet';
import { useTradingViewIndiaScreenerQuery } from '@/features/scanner/useTradingViewIndiaScreenerQuery';
import { useAiStockOverviewScoresQuery } from '@/features/ai/useAiStockOverviewScoresQuery';
import { useStockTagsQuery } from '@/features/stock-tags/useStockTagsQuery';
import { tradingViewScreenerRowToListItem } from '@/lib/tradingview-india-screener';
import { fetchNseEquityQuoteRow } from '@/lib/nse-quote-client';
import { toBseTradingViewQuerySymbol } from '@/lib/tradingview-symbol';
import { DEFAULT_WATCHLIST_LIST_ID } from '@/lib/watchlist-defaults';
import { useTradeStore } from '@/store/useTradeStore';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

function formatPrice(v: number | null): string {
  if (v == null) return '—';
  return v.toLocaleString('en-IN', { maximumFractionDigits: 2 });
}

function isWithinNseLiveSession(now: Date): boolean {
  const minutes = now.getHours() * 60 + now.getMinutes();
  const marketOpen = 9 * 60 + 15;
  const marketClose = 15 * 60 + 30;
  return minutes >= marketOpen && minutes < marketClose;
}

type ScannerTab =
  | '52h'
  | 'monthly'
  | 'new-trend'
  | 'at-all-time-high'
  | '1y-top';

function tabFromSearchParams(tabParam: string | null): ScannerTab {
  if (tabParam === 'monthly') return 'monthly';
  if (tabParam === 'new-trend') return 'new-trend';
  if (tabParam === 'at-all-time-high') return 'at-all-time-high';
  if (tabParam === '1y-top') return '1y-top';
  return '52h';
}

export default function Scanner52wWorkspace() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const searchParams = useSearchParams();
  const querySymbol = searchParams.get('symbol');
  const scannerTab = tabFromSearchParams(searchParams.get('tab'));

  const [chartMode, setChartMode] = useState<'kline' | 'tradingview'>('kline');
  const [aiSheetOpen, setAiSheetOpen] = useState(false);
  const [nowTs, setNowTs] = useState(() => Date.now());
  const [isScreenFocused, setIsScreenFocused] = useState(() =>
    typeof document === 'undefined' ? true : document.visibilityState === 'visible' && document.hasFocus(),
  );

  const scanner52hQuery = useTradingViewIndiaScreenerQuery('52h', scannerTab === '52h');
  const monthlyQuery = useTradingViewIndiaScreenerQuery('new-monthly-high', scannerTab === 'monthly');
  const newTrendQuery = useTradingViewIndiaScreenerQuery('new-trend', scannerTab === 'new-trend');
  const atAllTimeHighQuery = useTradingViewIndiaScreenerQuery(
    'at-all-time-high',
    scannerTab === 'at-all-time-high',
  );
  const oneYearTopQuery = useTradingViewIndiaScreenerQuery('1y-top', scannerTab === '1y-top');
  const scanner52hRows = useMemo(
    () => (scanner52hQuery.data?.data ?? []).map((row) => tradingViewScreenerRowToListItem(row, '52h')),
    [scanner52hQuery.data?.data],
  );
  const monthlyRows = useMemo(
    () =>
      (monthlyQuery.data?.data ?? []).map((row) =>
        tradingViewScreenerRowToListItem(row, 'new-monthly-high'),
      ),
    [monthlyQuery.data?.data],
  );
  const newTrendRows = useMemo(
    () => (newTrendQuery.data?.data ?? []).map((row) => tradingViewScreenerRowToListItem(row, 'new-trend')),
    [newTrendQuery.data?.data],
  );
  const atAllTimeHighRows = useMemo(
    () =>
      (atAllTimeHighQuery.data?.data ?? []).map((row) =>
        tradingViewScreenerRowToListItem(row, 'at-all-time-high'),
      ),
    [atAllTimeHighQuery.data?.data],
  );
  const oneYearTopRows = useMemo(
    () => (oneYearTopQuery.data?.data ?? []).map((row) => tradingViewScreenerRowToListItem(row, '1y-top')),
    [oneYearTopQuery.data?.data],
  );
  const isTvTab =
    scannerTab === '52h' ||
    scannerTab === 'monthly' ||
    scannerTab === 'new-trend' ||
    scannerTab === 'at-all-time-high' ||
    scannerTab === '1y-top';
  const tvRows =
    scannerTab === '52h'
      ? scanner52hRows
      : scannerTab === 'monthly'
        ? monthlyRows
        : scannerTab === 'new-trend'
          ? newTrendRows
        : scannerTab === 'at-all-time-high'
          ? atAllTimeHighRows
        : scannerTab === '1y-top'
          ? oneYearTopRows
            : [];
  const tvQuery =
    scannerTab === '52h'
      ? scanner52hQuery
      : scannerTab === 'monthly'
        ? monthlyQuery
        : scannerTab === 'new-trend'
          ? newTrendQuery
        : scannerTab === 'at-all-time-high'
          ? atAllTimeHighQuery
        : scannerTab === '1y-top'
          ? oneYearTopQuery
            : null;
  const scannerListTickers = useMemo(() => {
    if (isTvTab) return tvRows.map((row) => row.ticker);
    return [];
  }, [isTvTab, tvRows]);
  const { scoreByTicker: aiScoreByTicker } = useAiStockOverviewScoresQuery(scannerListTickers);

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

  const setScannerTab = useCallback(
    (next: ScannerTab) => {
      const params = new URLSearchParams(searchParams.toString());
      if (next === '52h') {
        params.delete('tab');
      } else {
        params.set('tab', next);
      }
      const q = params.toString();
      router.replace(q ? `/52w-scanner?${q}` : `/52w-scanner`, { scroll: false });
    },
    [router, searchParams],
  );

  const {
    staticTags,
    stockTagsByTicker,
    isLoadingStaticTags,
    isLoadingStockTags,
    isFetchingStockTags,
    saveTags,
    isSavingTags,
  } = useStockTagsQuery(scannerListTickers);
  const staticTagLabelById = useMemo(() => {
    const map = new Map<string, string>();
    for (const tag of staticTags) map.set(tag.id, tag.label);
    return map;
  }, [staticTags]);
  const [tagFilterMode, setTagFilterMode] = useState<'include' | 'exclude'>('include');
  const [activeTagFilters, setActiveTagFilters] = useState<string[]>([]);
  const toggleTagFilter = useCallback((tagId: string) => {
    setActiveTagFilters((prev) =>
      prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId],
    );
  }, []);
  const matchesActiveTagFilter = useCallback(
    (ticker: string) => {
      if (activeTagFilters.length === 0) return true;
      const tagIds = stockTagsByTicker.get(ticker.trim().toUpperCase()) ?? [];
      if (tagIds.length === 0) return true;
      const hasSelectedTag = tagIds.some((tagId) => activeTagFilters.includes(tagId));
      if (tagFilterMode === 'exclude') return !hasSelectedTag;
      return hasSelectedTag;
    },
    [activeTagFilters, stockTagsByTicker, tagFilterMode],
  );
  const filteredTvRows = useMemo(
    () => tvRows.filter((row) => matchesActiveTagFilter(row.ticker)),
    [tvRows, matchesActiveTagFilter],
  );
  const isLiveMarketSession = useMemo(() => isWithinNseLiveSession(new Date(nowTs)), [nowTs]);
  useEffect(() => {
    const interval = window.setInterval(() => setNowTs(Date.now()), 60_000);
    return () => window.clearInterval(interval);
  }, []);
  useEffect(() => {
    const updateFocusState = () => {
      setIsScreenFocused(document.visibilityState === 'visible' && document.hasFocus());
    };
    updateFocusState();
    window.addEventListener('focus', updateFocusState);
    window.addEventListener('blur', updateFocusState);
    document.addEventListener('visibilitychange', updateFocusState);
    return () => {
      window.removeEventListener('focus', updateFocusState);
      window.removeEventListener('blur', updateFocusState);
      document.removeEventListener('visibilitychange', updateFocusState);
    };
  }, []);
  const tvTickersForQuotes = useMemo(
    () => [...new Set(filteredTvRows.filter((row) => row.isNse).map((row) => row.ticker.trim().toUpperCase()))],
    [filteredTvRows],
  );
  const tvQuoteQueries = useQueries({
    queries: tvTickersForQuotes.map((ticker) => ({
      queryKey: ['nse-equity-quote', ticker] as const,
      queryFn: () => fetchNseEquityQuoteRow(ticker),
      enabled:
        isTvTab &&
        isScreenFocused &&
        (isLiveMarketSession ||
          queryClient.getQueryData(['nse-equity-quote', ticker]) == null),
      staleTime: 10 * 60 * 1000,
      gcTime: 24 * 60 * 60 * 1000,
      refetchInterval: isLiveMarketSession && isScreenFocused ? 10 * 60 * 1000 : false,
      refetchIntervalInBackground: false,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
    })),
  });
  const pChangeByTicker = useMemo(() => {
    const map = new Map<string, number>();
    tvTickersForQuotes.forEach((ticker, idx) => {
      const p = tvQuoteQueries[idx]?.data?.metaData?.pChange;
      if (typeof p === 'number' && Number.isFinite(p)) map.set(ticker, p);
    });
    return map;
  }, [tvTickersForQuotes, tvQuoteQueries]);
  const selectedTvSymbol = useMemo(() => {
    if (isTvTab) {
      if (filteredTvRows.length === 0) return '';
      if (querySymbol && filteredTvRows.some((r) => r.tvSymbol === querySymbol)) return querySymbol;
      return filteredTvRows[0].tvSymbol;
    }
    return querySymbol?.trim() ?? '';
  }, [isTvTab, filteredTvRows, querySymbol]);

  const chartNseSymbol = useMemo(() => {
    if (isTvTab) {
      const item = tvRows.find((row) => row.tvSymbol === selectedTvSymbol);
      return item?.isNse ? item.ticker : '';
    }
    return '';
  }, [isTvTab, tvRows, selectedTvSymbol]);

  const selectedStock = useMemo<{ ticker: string; companyName: string } | null>(() => {
    if (isTvTab) {
      const r = tvRows.find((x) => x.tvSymbol === selectedTvSymbol);
      return r ? { ticker: r.ticker, companyName: r.companyName } : null;
    }
    return null;
  }, [isTvTab, tvRows, selectedTvSymbol]);
  const technicalScoreTicker = selectedStock?.ticker.trim().toUpperCase() ?? '';

  /** TradingView widget expects `BSE:ticker` when the screener returns `NSE:ticker`. */
  const tradingViewChartSymbol = useMemo(
    () => toBseTradingViewQuerySymbol(selectedTvSymbol),
    [selectedTvSymbol],
  );

  useEffect(() => {
    if (!isTvTab) return;
    if (filteredTvRows.length === 0) return;
    if (!querySymbol || !filteredTvRows.some((r) => r.tvSymbol === querySymbol)) {
      const params = new URLSearchParams(searchParams.toString());
      params.set('tab', scannerTab);
      params.set('symbol', filteredTvRows[0].tvSymbol);
      router.replace(`/52w-scanner?${params.toString()}`, { scroll: false });
    }
  }, [isTvTab, scannerTab, filteredTvRows, querySymbol, router, searchParams]);

  useEffect(() => {
    if (!isTvTab) return;
    if (!chartNseSymbol && chartMode === 'kline') {
      setChartMode('tradingview');
    }
  }, [isTvTab, chartNseSymbol, chartMode]);

  const onSelect = useCallback(
    (tvSymbol: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (scannerTab === '52h') {
        params.delete('tab');
      } else {
        params.set('tab', scannerTab);
      }
      params.set('symbol', tvSymbol);
      router.replace(`/52w-scanner?${params.toString()}`, { scroll: false });
    },
    [router, searchParams, scannerTab],
  );

  const onRefresh = useCallback(() => {
    if (scannerTab === '52h') void scanner52hQuery.refetch();
    else if (scannerTab === 'monthly') void monthlyQuery.refetch();
    else if (scannerTab === 'new-trend') void newTrendQuery.refetch();
    else if (scannerTab === 'at-all-time-high') void atAllTimeHighQuery.refetch();
    else if (scannerTab === '1y-top') void oneYearTopQuery.refetch();
  }, [
    scannerTab,
    scanner52hQuery,
    monthlyQuery,
    newTrendQuery,
    atAllTimeHighQuery,
    oneYearTopQuery,
  ]);

  const listFetching = isTvTab ? (tvQuery?.isFetching ?? false) : false;
  const listLoading = isTvTab ? (tvQuery?.isLoading ?? false) : false;
  const listError = isTvTab ? (tvQuery?.error ?? null) : null;

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-white">Scanner</h1>
          <p className="mt-1 text-sm text-gray-500">
            {scannerTab === 'monthly'
              ? 'New Monthly High scanner (TradingView India): this scanner represents stocks giving fresh breakouts. Pick a symbol for K-line (NSE) or TradingView on the right.'
              : scannerTab === 'new-trend'
                ? 'New Trend scanner (TradingView India): tracks trending liquid stocks with momentum and RSI strength filters.'
              : scannerTab === 'at-all-time-high'
                ? 'At All Time High scanner (TradingView India): liquid stocks making fresh all-time highs.'
                : scannerTab === '1y-top'
                  ? '1Y Top screen (TradingView India): strongest 1-year movers with liquidity and market cap filters.'
                  : '52W H scanner (TradingView India): select any symbol to view K-line (NSE) or TradingView chart on the right.'}
          </p>
          <TooltipProvider delay={200}>
            <div className="mt-3 flex flex-wrap gap-2">
              <Tooltip>
                <TooltipTrigger
                  type="button"
                  onClick={() => setScannerTab('52h')}
                  className={`rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${
                    scannerTab === '52h'
                      ? 'border-blue-500/50 bg-blue-500/15 text-blue-100'
                      : 'border-white/10 bg-white/5 text-gray-400 hover:border-white/20 hover:text-gray-200'
                  }`}
                >
                  New 52w High
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-xs text-left leading-snug">
                  TradingView India 52W high scanner using your custom payload and filters.
                </TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger
                  type="button"
                  onClick={() => setScannerTab('monthly')}
                  className={`rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${
                    scannerTab === 'monthly'
                      ? 'border-blue-500/50 bg-blue-500/15 text-blue-100'
                      : 'border-white/10 bg-white/5 text-gray-400 hover:border-white/20 hover:text-gray-200'
                  }`}
                >
                  New Monthly High
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-xs text-left leading-snug">
                  New scanner: stocks giving fresh breakouts based on the New Monthly High payload.
                </TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger
                  type="button"
                  onClick={() => setScannerTab('new-trend')}
                  className={`rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${
                    scannerTab === 'new-trend'
                      ? 'border-blue-500/50 bg-blue-500/15 text-blue-100'
                      : 'border-white/10 bg-white/5 text-gray-400 hover:border-white/20 hover:text-gray-200'
                  }`}
                >
                  New Trend
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-xs text-left leading-snug">
                  New scanner for trend continuation setups with market-cap, liquidity, performance, and RSI filters.
                </TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger
                  type="button"
                  onClick={() => setScannerTab('at-all-time-high')}
                  className={`rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${
                    scannerTab === 'at-all-time-high'
                      ? 'border-blue-500/50 bg-blue-500/15 text-blue-100'
                      : 'border-white/10 bg-white/5 text-gray-400 hover:border-white/20 hover:text-gray-200'
                  }`}
                >
                  At All Time High
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-xs text-left leading-snug">
                  New scanner for stocks at fresh all-time highs with liquidity filters.
                </TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger
                  type="button"
                  onClick={() => setScannerTab('1y-top')}
                  className={`rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${
                    scannerTab === '1y-top'
                      ? 'border-blue-500/50 bg-blue-500/15 text-blue-100'
                      : 'border-white/10 bg-white/5 text-gray-400 hover:border-white/20 hover:text-gray-200'
                  }`}
                >
                  1Y Top
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-xs text-left leading-snug">
                  TradingView India 1-year top performers screen - sorted by 1Y returns with liquidity and market-cap filters.
                </TooltipContent>
              </Tooltip>
            </div>
          </TooltipProvider>
        </div>
        <div className="flex shrink-0 flex-wrap items-start justify-end gap-2">
          <button
            type="button"
            onClick={() => setAiSheetOpen(true)}
            disabled={!selectedStock}
            aria-label={
              selectedStock
                ? `AI overview for ${selectedStock.ticker}`
                : 'AI overview (select a stock first)'
            }
            className="inline-flex items-center gap-2 rounded-xl border border-purple-400/30 bg-purple-500/10 px-3 py-2 text-xs font-semibold text-purple-100 hover:bg-purple-500/20 disabled:opacity-50"
          >
            <Sparkles className="h-3.5 w-3.5" aria-hidden />
            AI
          </button>
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
      </div>

      <StockAiOverviewSheet
        open={aiSheetOpen}
        onOpenChange={setAiSheetOpen}
        ticker={selectedStock?.ticker ?? ''}
        companyName={selectedStock?.companyName ?? ''}
      />

      {listError ? (
        <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4 text-sm text-gray-300">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" aria-hidden />
            <span>
              {listError instanceof Error
                ? listError.message
                : isTvTab
                  ? 'Failed to load TradingView screen.'
                  : 'Failed to load 52 week high data.'}
            </span>
          </div>
        </div>
      ) : null}

      <div className="flex h-[min(max(480px,calc(100dvh-14rem)),880px)] flex-col overflow-hidden rounded-3xl border border-white/10 bg-[#161618] lg:flex-row">
          <aside className="flex max-h-[40%] min-h-0 w-full shrink-0 flex-col overflow-hidden border-b border-white/10 lg:h-full lg:max-h-none lg:w-[min(100%,360px)] lg:border-b-0 lg:border-r">
            <div className="flex shrink-0 items-center justify-between gap-2 border-b border-white/5 px-4 py-3">
              <span className="text-[10px] font-bold uppercase tracking-widest text-gray-500">
                {scannerTab === '52h'
                  ? `52W H scanner (${filteredTvRows.length}${scanner52hQuery.data?.totalCount != null ? ` / ${scanner52hQuery.data.totalCount}` : ''})`
                  : scannerTab === 'monthly'
                  ? `Monthly screen (${filteredTvRows.length}${monthlyQuery.data?.totalCount != null ? ` / ${monthlyQuery.data.totalCount}` : ''})`
                  : scannerTab === 'new-trend'
                    ? `New Trend (${filteredTvRows.length}${newTrendQuery.data?.totalCount != null ? ` / ${newTrendQuery.data.totalCount}` : ''})`
                  : scannerTab === 'at-all-time-high'
                    ? `At All Time High (${filteredTvRows.length}${atAllTimeHighQuery.data?.totalCount != null ? ` / ${atAllTimeHighQuery.data.totalCount}` : ''})`
                  : scannerTab === '1y-top'
                    ? `1Y Top (${filteredTvRows.length}${oneYearTopQuery.data?.totalCount != null ? ` / ${oneYearTopQuery.data.totalCount}` : ''})`
                    : `Scanner (${filteredTvRows.length})`}
              </span>
              <div className="flex shrink-0 items-center gap-2">
                {listFetching || listLoading ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-400" aria-hidden />
                ) : null}
              </div>
            </div>
            <div className="flex shrink-0 flex-wrap items-center gap-1 border-b border-white/5 px-4 py-2">
              <span className="mr-1 text-[9px] font-bold uppercase tracking-wide text-gray-600">Tags</span>
              <div className="mr-2 inline-flex items-center gap-0.5 rounded-md border border-white/10 bg-[#0a0a0b] p-0.5">
                <button
                  type="button"
                  onClick={() => setTagFilterMode('include')}
                  className={`rounded-sm px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide transition-colors ${
                    tagFilterMode === 'include'
                      ? 'bg-blue-500/30 text-blue-100'
                      : 'text-gray-500 hover:bg-white/5 hover:text-gray-300'
                  }`}
                >
                  Include
                </button>
                <button
                  type="button"
                  onClick={() => setTagFilterMode('exclude')}
                  className={`rounded-sm px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide transition-colors ${
                    tagFilterMode === 'exclude'
                      ? 'bg-rose-500/30 text-rose-100'
                      : 'text-gray-500 hover:bg-white/5 hover:text-gray-300'
                  }`}
                >
                  Exclude
                </button>
              </div>
              {staticTags.map((tag) => {
                const active = activeTagFilters.includes(tag.id);
                return (
                  <button
                    key={`scanner-tag-filter-${tag.id}`}
                    type="button"
                    onClick={() => toggleTagFilter(tag.id)}
                    className={`rounded-md border px-2 py-0.5 text-[10px] font-bold ${active ? stockTagBadgeClass(tag.id) : 'border-white/10 bg-white/5 text-gray-400 hover:border-white/20 hover:text-gray-200'}`}
                  >
                    {compactStockTagLabel(tag.label)}
                  </button>
                );
              })}
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-2">
              {listLoading ? (
              <div className="px-3 py-8 text-center text-sm text-gray-500">
                {scannerTab === 'monthly'
                  ? 'Loading monthly screen…'
                  : scannerTab === 'new-trend'
                    ? 'Loading New Trend screen…'
                  : scannerTab === 'at-all-time-high'
                    ? 'Loading At All Time High screen…'
                    : scannerTab === '1y-top'
                      ? 'Loading 1Y Top screen…'
                    : 'Loading 52W scanner…'}
              </div>
            ) : filteredTvRows.length === 0 ? (
              <div className="px-3 py-8 text-center text-sm text-gray-500">
                No symbols matched this TradingView screen right now.
              </div>
            ) : (
              <ul className="space-y-1">
                {filteredTvRows.map((row) => {
                  const isSelected = row.tvSymbol === selectedTvSymbol;
                  const ch = pChangeByTicker.get(row.ticker.trim().toUpperCase()) ?? row.changePct;
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
                              <div className="flex items-center gap-1.5">
                                <span className="font-bold tracking-tight">{row.tvSymbol}</span>
                                {aiScoreByTicker.has(row.ticker.trim().toUpperCase()) ? (
                                  <span className="rounded-md border border-purple-400/30 bg-purple-500/15 px-1.5 py-0.5 text-[10px] font-bold text-purple-200">
                                    AI {aiScoreByTicker.get(row.ticker.trim().toUpperCase())?.objectiveScore}%
                                  </span>
                                ) : null}
                                {(stockTagsByTicker.get(row.ticker.trim().toUpperCase())?.length ?? 0) > 0 ? (
                                  <div className="flex items-center gap-1">
                                    {(stockTagsByTicker.get(row.ticker.trim().toUpperCase()) ?? []).slice(0, 2).map((tagId) => (
                                      <span
                                        key={`${row.ticker}-tv-${tagId}`}
                                        className={`rounded-md border px-1.5 py-0.5 text-[10px] font-bold ${stockTagBadgeClass(tagId)}`}
                                      >
                                        {compactStockTagLabel(staticTagLabelById.get(tagId) ?? tagId)}
                                      </span>
                                    ))}
                                  </div>
                                ) : null}
                              </div>
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
                    disabled={isTvTab && !chartNseSymbol}
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
              {selectedStock ? (
                <TechnicalChartScoreControl
                  ticker={selectedStock.ticker}
                  staticTags={staticTags}
                  selectedTagIds={stockTagsByTicker.get(technicalScoreTicker) ?? []}
                  isLoading={isLoadingStaticTags || isLoadingStockTags || isFetchingStockTags}
                  isSaving={isSavingTags}
                  onSaveTags={async (tagIds) => {
                    await saveTags({ ticker: selectedStock.ticker, tagIds });
                  }}
                />
              ) : null}
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
              {isTvTab && listLoading
                ? scannerTab === 'monthly'
                  ? 'Loading monthly screen…'
                  : scannerTab === 'new-trend'
                    ? 'Loading New Trend screen…'
                  : scannerTab === 'at-all-time-high'
                    ? 'Loading At All Time High screen…'
                    : scannerTab === '1y-top'
                      ? 'Loading 1Y Top screen…'
                  : 'Loading 52W scanner…'
                : 'Select a stock from the scanner to load a chart.'}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
