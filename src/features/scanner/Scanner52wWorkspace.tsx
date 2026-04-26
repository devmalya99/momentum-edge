'use client';

import { useEffect, useMemo, useCallback, useState } from 'react';
import { useQueries, useQueryClient } from '@tanstack/react-query';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  AlertTriangle,
  Bookmark,
  BookmarkCheck,
  Eye,
  LineChart,
  Loader2,
  Network,
  RefreshCcw,
  Sparkles,
} from 'lucide-react';
import NseEquityCandleChartWidget from '@/components/NseEquityCandleChartWidget';
import TradingViewAdvancedChartWidget from '@/components/TradingViewAdvancedChartWidget';
import TechnicalChartScoreControl, {
  compactStockTagLabel,
  stockTagBadgeClass,
} from '@/components/TechnicalChartScoreControl';
import ScanAnalysisSheet from '@/features/scanner/ScanAnalysisSheet';
import StockAiOverviewSheet from '@/features/scanner/StockAiOverviewSheet';
import { useTradingViewIndiaScreenerQuery } from '@/features/scanner/useTradingViewIndiaScreenerQuery';
import { useAiStockOverviewScoresQuery } from '@/features/ai/useAiStockOverviewScoresQuery';
import RelativeTurnoverFilterControl from '@/features/relative-turnover/RelativeTurnoverFilterControl';
import { useRelativeTurnoverMap } from '@/features/relative-turnover/useRelativeTurnover';
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
import { useAuthStore } from '@/store/useAuthStore';

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
  | 'at-all-time-high';

function tabFromSearchParams(tabParam: string | null): ScannerTab {
  if (tabParam === 'monthly') return 'monthly';
  if (tabParam === 'new-trend') return 'new-trend';
  if (tabParam === 'at-all-time-high') return 'at-all-time-high';
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
  const [scanAnalysisOpen, setScanAnalysisOpen] = useState(false);
  const [minRelativeTurnoverPct, setMinRelativeTurnoverPct] = useState(0);
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
  const isTvTab =
    scannerTab === '52h' ||
    scannerTab === 'monthly' ||
    scannerTab === 'new-trend' ||
    scannerTab === 'at-all-time-high';
  const tvRows =
    scannerTab === '52h'
      ? scanner52hRows
      : scannerTab === 'monthly'
        ? monthlyRows
        : scannerTab === 'new-trend'
          ? newTrendRows
          : scannerTab === 'at-all-time-high'
            ? atAllTimeHighRows
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
            : null;
  const scannerListTickers = useMemo(() => {
    if (isTvTab) return tvRows.map((row) => row.ticker);
    return [];
  }, [isTvTab, tvRows]);
  const { scoreByTicker: aiScoreByTicker } = useAiStockOverviewScoresQuery(scannerListTickers);
  const { metricBySymbol: relativeTurnoverBySymbol } = useRelativeTurnoverMap(scannerListTickers);

  const watchlist = useTradeStore((s) => s.watchlist);
  const authUser = useAuthStore((s) => s.user);
  const canEditStockTags = authUser?.role === 'admin';
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
    () =>
      tvRows.filter((row) => {
        if (!matchesActiveTagFilter(row.ticker)) return false;
        if (minRelativeTurnoverPct <= 0) return true;
        const metric = relativeTurnoverBySymbol.get(row.ticker.trim().toUpperCase());
        if (!metric) return false;
        return metric.relativeTurnoverPct >= minRelativeTurnoverPct;
      }),
    [tvRows, matchesActiveTagFilter, minRelativeTurnoverPct, relativeTurnoverBySymbol],
  );
  const scanAnalysisStocks = useMemo(
    () =>
      filteredTvRows.map((row) => ({
        symbol: row.ticker,
        name: row.companyName || row.ticker,
      })),
    [filteredTvRows],
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
      refetchInterval: () => (isLiveMarketSession && isScreenFocused ? 10 * 60 * 1000 : false),
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
  }, [
    scannerTab,
    scanner52hQuery,
    monthlyQuery,
    newTrendQuery,
    atAllTimeHighQuery,
  ]);

  const listFetching = isTvTab ? (tvQuery?.isFetching ?? false) : false;
  const listLoading = isTvTab ? (tvQuery?.isLoading ?? false) : false;
  const listError = isTvTab ? (tvQuery?.error ?? null) : null;

  const scannerLabel =
    scannerTab === '52h'
      ? '52W High'
      : scannerTab === 'monthly'
        ? 'Monthly High'
        : scannerTab === 'new-trend'
          ? 'New Trend'
          : scannerTab === 'at-all-time-high'
            ? 'All Time High'
            : '52W High';

  const scannerSubtitle =
    scannerTab === 'monthly'
      ? 'Fresh breakouts — new monthly highs with volume confirmation.'
      : scannerTab === 'new-trend'
        ? 'Trend continuation setups with momentum and RSI strength filters.'
        : scannerTab === 'at-all-time-high'
          ? 'Liquid stocks making fresh all-time highs.'
            : 'Stocks hitting fresh 52-week highs. Select a symbol to load the chart.';

  const listLabel =
    scannerTab === '52h'
      ? `52W H (${filteredTvRows.length}${scanner52hQuery.data?.totalCount != null ? ` / ${scanner52hQuery.data.totalCount}` : ''})`
      : scannerTab === 'monthly'
        ? `Monthly (${filteredTvRows.length}${monthlyQuery.data?.totalCount != null ? ` / ${monthlyQuery.data.totalCount}` : ''})`
        : scannerTab === 'new-trend'
          ? `New Trend (${filteredTvRows.length}${newTrendQuery.data?.totalCount != null ? ` / ${newTrendQuery.data.totalCount}` : ''})`
          : scannerTab === 'at-all-time-high'
            ? `ATH (${filteredTvRows.length}${atAllTimeHighQuery.data?.totalCount != null ? ` / ${atAllTimeHighQuery.data.totalCount}` : ''})`
            : `52W H (${filteredTvRows.length}${scanner52hQuery.data?.totalCount != null ? ` / ${scanner52hQuery.data.totalCount}` : ''})`;

  const loadingLabel =
    scannerTab === 'monthly'
      ? 'Loading monthly screen…'
      : scannerTab === 'new-trend'
        ? 'Loading New Trend…'
        : scannerTab === 'at-all-time-high'
          ? 'Loading ATH screen…'
            : 'Loading 52W scanner…';

  const NEW_TREND_FILTER_LINES = [
    'Change: -2% to 10%',
    'Market cap: >= 1B',
    'RSI5: 60 to <89',
    '10D avg traded value: >30M',
    'Weekly RSI: >60',
    'EMA20 >= EMA50',
    'Volume change: >10%',
    'Primary listings only',
  ] as const;

  const TAB_DEFS: { id: ScannerTab; label: string; tooltip: string; filterLines?: readonly string[] }[] = [
    { id: '52h', label: '52W High', tooltip: 'TradingView India 52W high scanner.' },
    { id: 'monthly', label: 'Monthly High', tooltip: 'Stocks giving fresh breakouts on new monthly highs.' },
    {
      id: 'new-trend',
      label: 'New Trend',
      tooltip: 'Trend continuation setups with market-cap, liquidity, and RSI filters.',
      filterLines: NEW_TREND_FILTER_LINES,
    },
    { id: 'at-all-time-high', label: 'All Time High', tooltip: 'Stocks at fresh all-time highs with liquidity filters.' },
  ];

  return (
    <div className="space-y-4">
      {/* ── Page Header ── */}
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-black tracking-tight text-white">Scanner</h1>
            <span className="rounded-full border border-cyan-400/25 bg-cyan-400/8 px-2.5 py-0.5 text-[11px] font-bold tracking-wide text-cyan-300">
              {scannerLabel}
            </span>
          </div>
          <p className="mt-1 text-[13px] leading-relaxed text-gray-500">{scannerSubtitle}</p>

          {/* ── Tab Bar ── */}
          <TooltipProvider delay={200}>
            <div className="mt-3 inline-flex flex-wrap gap-1.5 rounded-xl border border-white/8 bg-white/3 p-1">
              {TAB_DEFS.map(({ id, label, tooltip, filterLines }) => (
                <Tooltip key={id}>
                  <TooltipTrigger
                    type="button"
                    onClick={() => setScannerTab(id)}
                    className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-semibold tracking-wide transition-all duration-150 ${
                      scannerTab === id
                        ? 'bg-white/10 text-white shadow-sm shadow-black/30'
                        : 'text-gray-500 hover:bg-white/5 hover:text-gray-300'
                    }`}
                  >
                    {label}
                    {filterLines ? <Eye className="h-3 w-3 opacity-70" aria-hidden /> : null}
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="max-w-xs text-left text-[11px] leading-snug">
                    <div className="space-y-2">
                      <p>{tooltip}</p>
                      {filterLines ? (
                        <div className="border-t border-white/10 pt-2">
                          <div className="mb-1 font-bold uppercase tracking-wide text-cyan-200">Filter</div>
                          <ul className="space-y-1 text-gray-300">
                            {filterLines.map((line) => (
                              <li key={line}>{line}</li>
                            ))}
                          </ul>
                        </div>
                      ) : null}
                    </div>
                  </TooltipContent>
                </Tooltip>
              ))}
            </div>
          </TooltipProvider>
        </div>

        {/* ── Action Buttons ── */}
        <div className="flex shrink-0 items-start gap-2 pt-1">
          <button
            type="button"
            onClick={() => setScanAnalysisOpen(true)}
            disabled={filteredTvRows.length === 0}
            className="inline-flex items-center gap-1.5 rounded-xl border border-cyan-400/25 bg-cyan-500/10 px-3.5 py-2 text-[12px] font-semibold text-cyan-200 transition-colors hover:bg-cyan-500/18 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Network className="h-3.5 w-3.5" aria-hidden />
            Analyse Scan
          </button>
          <button
            type="button"
            onClick={() => setAiSheetOpen(true)}
            disabled={!selectedStock}
            aria-label={selectedStock ? `AI overview for ${selectedStock.ticker}` : 'AI overview (select a stock first)'}
            className="inline-flex items-center gap-1.5 rounded-xl border border-violet-400/30 bg-violet-500/10 px-3.5 py-2 text-[12px] font-semibold text-violet-200 transition-colors hover:bg-violet-500/18 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Sparkles className="h-3.5 w-3.5" aria-hidden />
            AI
          </button>
          <button
            type="button"
            onClick={onRefresh}
            disabled={listFetching}
            className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3.5 py-2 text-[12px] font-medium text-gray-300 transition-colors hover:bg-white/8 disabled:opacity-60"
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
      <ScanAnalysisSheet
        open={scanAnalysisOpen}
        onOpenChange={setScanAnalysisOpen}
        scannerName={scannerLabel}
        stocks={scanAnalysisStocks}
      />

      {listError ? (
        <div className="flex items-start gap-3 rounded-2xl border border-amber-500/20 bg-amber-500/6 px-4 py-3.5 text-[13px] text-gray-300">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" aria-hidden />
          <span>
            {listError instanceof Error
              ? listError.message
              : isTvTab
                ? 'Failed to load TradingView screen.'
                : 'Failed to load scanner data.'}
          </span>
        </div>
      ) : null}

      {/* ── Main Panel ── */}
      <div className="flex h-[min(max(500px,calc(100dvh-13rem)),900px)] flex-col overflow-hidden rounded-2xl border border-white/8 bg-[#111114] lg:flex-row">

        {/* ── Left Sidebar: Stock List ── */}
        <aside className="flex max-h-[42%] min-h-0 w-full shrink-0 flex-col overflow-hidden border-b border-white/7 lg:h-full lg:max-h-none lg:w-[340px] lg:border-b-0 lg:border-r lg:border-white/7">

          {/* Sidebar header */}
          <div className="flex shrink-0 items-center justify-between gap-2 border-b border-white/6 px-4 py-2.5">
            <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-gray-500">{listLabel}</span>
            {listFetching || listLoading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin text-cyan-400" aria-hidden />
            ) : null}
          </div>

          {/* Tag filter bar */}
          <div className="flex shrink-0 flex-wrap items-center gap-1.5 border-b border-white/6 bg-[#0d0d10] px-3.5 py-2">
            <span className="text-[9px] font-bold uppercase tracking-widest text-gray-600">Filter</span>
            <div className="inline-flex items-center gap-0.5 rounded-md border border-white/8 bg-black/30 p-0.5">
              <button
                type="button"
                onClick={() => setTagFilterMode('include')}
                className={`rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide transition-colors ${
                  tagFilterMode === 'include'
                    ? 'bg-cyan-500/25 text-cyan-200'
                    : 'text-gray-600 hover:text-gray-400'
                }`}
              >
                Include
              </button>
              <button
                type="button"
                onClick={() => setTagFilterMode('exclude')}
                className={`rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide transition-colors ${
                  tagFilterMode === 'exclude'
                    ? 'bg-rose-500/25 text-rose-200'
                    : 'text-gray-600 hover:text-gray-400'
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
                  className={`rounded border px-2 py-0.5 text-[10px] font-semibold transition-colors ${
                    active ? stockTagBadgeClass(tag.id) : 'border-white/8 bg-transparent text-gray-500 hover:border-white/15 hover:text-gray-300'
                  }`}
                >
                  {compactStockTagLabel(tag.label)}
                </button>
              );
            })}
            <RelativeTurnoverFilterControl
              value={minRelativeTurnoverPct}
              onChange={setMinRelativeTurnoverPct}
            />
          </div>

          {/* Stock list */}
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
            {listLoading ? (
              <div className="flex flex-col items-center justify-center gap-2 px-4 py-12 text-center">
                <Loader2 className="h-5 w-5 animate-spin text-gray-600" aria-hidden />
                <span className="text-[12px] text-gray-600">{loadingLabel}</span>
              </div>
            ) : filteredTvRows.length === 0 ? (
              <div className="px-4 py-12 text-center text-[12px] text-gray-600">
                No symbols matched this screen right now.
              </div>
            ) : (
              <ul>
                {filteredTvRows.map((row) => {
                  const isSelected = row.tvSymbol === selectedTvSymbol;
                  const ch = pChangeByTicker.get(row.ticker.trim().toUpperCase()) ?? row.changePct;
                  const isPositive = ch == null ? true : ch >= 0;
                  const bookmarked = isBookmarkedTicker(row.ticker);
                  const upperTicker = row.ticker.trim().toUpperCase();
                  const aiScore = aiScoreByTicker.get(upperTicker);
                  const tagIds = stockTagsByTicker.get(upperTicker) ?? [];

                  return (
                    <li key={row.tvSymbol} className={`border-b border-white/4 last:border-b-0 ${isSelected ? 'bg-white/5.5' : ''}`}>
                      <div className={`flex items-stretch gap-0 transition-colors ${isSelected ? '' : 'hover:bg-white/3'}`}>

                        {/* Left accent bar */}
                        <div className={`w-[3px] shrink-0 rounded-full ${isSelected ? 'bg-cyan-400' : 'bg-transparent'}`} />

                        <button
                          type="button"
                          onClick={() => onSelect(row.tvSymbol)}
                          className="min-w-0 flex-1 px-3 py-2.5 text-left"
                        >
                          {/* Row top: ticker + change % */}
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex min-w-0 items-center gap-1.5">
                              <span className={`text-[13px] font-bold tracking-tight ${isSelected ? 'text-white' : 'text-gray-200'}`}>
                                {row.ticker.replace(/^(NSE:|BSE:)/, '')}
                              </span>
                              {aiScore ? (
                                <span className="rounded border border-violet-400/25 bg-violet-500/12 px-1.5 py-px text-[9px] font-bold tracking-wide text-violet-300">
                                  AI {aiScore.objectiveScore}%
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
                                {isPositive ? '+' : ''}{ch.toFixed(2)}%
                              </span>
                            ) : (
                              <span className="shrink-0 text-[11px] text-gray-600">—</span>
                            )}
                          </div>

                          {/* Company name */}
                          <div className="mt-0.5 truncate text-[11px] text-gray-500">{row.companyName}</div>
                          <div className="mt-1 text-[10px] font-semibold text-cyan-300">
                            30D Turnover/MCap:{' '}
                            {relativeTurnoverBySymbol
                              .get(upperTicker)
                              ?.relativeTurnoverPct.toFixed(2)
                              .concat('%') ?? '—'}
                          </div>

                          {/* Row bottom: price + exchange + tags */}
                          <div className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1">
                            <span className="text-[11px] font-medium tabular-nums text-gray-400">₹{formatPrice(row.close)}</span>
                            <span className="text-[10px] text-gray-600">{row.exchange}</span>
                            {tagIds.slice(0, 2).map((tagId) => (
                              <span
                                key={`${row.ticker}-tv-${tagId}`}
                                className={`rounded border px-1.5 py-px text-[9px] font-bold ${stockTagBadgeClass(tagId)}`}
                              >
                                {compactStockTagLabel(staticTagLabelById.get(tagId) ?? tagId)}
                              </span>
                            ))}
                          </div>
                        </button>

                        {/* Bookmark */}
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
                          aria-label={bookmarked ? `Remove ${row.ticker} from watchlist` : `Add ${row.ticker} to watchlist`}
                          className={`flex shrink-0 items-center px-2 transition-colors ${
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

        {/* ── Right Panel: Chart ── */}
        <div className="flex min-h-0 flex-1 flex-col bg-[#0d0d10] p-3 sm:p-4">
          {selectedTvSymbol ? (
            <div className="flex min-h-0 flex-1 flex-col gap-2">

              {/* Chart toolbar */}
              <div className="flex shrink-0 flex-wrap items-center gap-2">
                <div className="flex items-center gap-2">
                  <LineChart className="h-3.5 w-3.5 text-cyan-400" aria-hidden />
                  <span className="font-mono text-[11px] font-medium text-gray-400">
                    {chartMode === 'tradingview' ? tradingViewChartSymbol : selectedTvSymbol}
                  </span>
                </div>
                <div className="ml-auto inline-flex items-center gap-0.5 rounded-lg border border-white/8 bg-black/30 p-0.5">
                  <button
                    type="button"
                    onClick={() => setChartMode('kline')}
                    disabled={isTvTab && !chartNseSymbol}
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

              {/* Tag control */}
              {selectedStock ? (
                <TechnicalChartScoreControl
                  ticker={selectedStock.ticker}
                  staticTags={staticTags}
                  selectedTagIds={stockTagsByTicker.get(technicalScoreTicker) ?? []}
                  canEdit={canEditStockTags}
                  isLoading={isLoadingStaticTags || isLoadingStockTags || isFetchingStockTags}
                  isSaving={isSavingTags}
                  onSaveTag={async (tagId) => {
                    await saveTags({ ticker: selectedStock.ticker, tagId });
                  }}
                />
              ) : null}

              {/* Chart area */}
              <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl">
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
                  <div className="flex flex-1 items-center justify-center px-4 text-center text-[12px] text-gray-600">
                    K-line is only available for NSE symbols. Switch to TradingView for BSE and other exchanges.
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center">
              {isTvTab && listLoading ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin text-gray-600" aria-hidden />
                  <span className="text-[12px] text-gray-600">{loadingLabel}</span>
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
