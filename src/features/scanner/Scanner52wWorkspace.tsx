'use client';

import { useEffect, useMemo, useCallback, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
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
import ScanAnalysisSheet from '@/features/scanner/ScanAnalysisSheet';
import StockAiOverviewSheet from '@/features/scanner/StockAiOverviewSheet';
import { useTradingViewIndiaScreenerQuery } from '@/features/scanner/useTradingViewIndiaScreenerQuery';
import {
  quantamentalScoreTickerKey,
  useAiStockOverviewScoresQuery,
} from '@/features/ai/useAiStockOverviewScoresQuery';
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
import { useAdjacentNseChartPrefetch } from '@/hooks/useAdjacentNseChartPrefetch';
import { usePremiumAiGate } from '@/hooks/usePremiumAiGate';

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
  | 'strong-w-close';

function tabFromSearchParams(tabParam: string | null): ScannerTab {
  if (tabParam === 'monthly') return 'monthly';
  if (tabParam === 'new-trend') return 'new-trend';
  if (tabParam === 'at-all-time-high') return 'at-all-time-high';
  if (tabParam === 'strong-w-close') return 'strong-w-close';
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
  const { requirePremiumForAi, guardAiSheetOpen } = usePremiumAiGate();
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
  const strongWCloseQuery = useTradingViewIndiaScreenerQuery(
    'strong-w-close',
    scannerTab === 'strong-w-close',
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
  const strongWCloseRows = useMemo(
    () =>
      (strongWCloseQuery.data?.data ?? []).map((row) =>
        tradingViewScreenerRowToListItem(row, 'strong-w-close'),
      ),
    [strongWCloseQuery.data?.data],
  );
  const isTvTab =
    scannerTab === '52h' ||
    scannerTab === 'monthly' ||
    scannerTab === 'new-trend' ||
    scannerTab === 'at-all-time-high' ||
    scannerTab === 'strong-w-close';
  const tvRows =
    scannerTab === '52h'
      ? scanner52hRows
      : scannerTab === 'monthly'
        ? monthlyRows
        : scannerTab === 'new-trend'
          ? newTrendRows
          : scannerTab === 'at-all-time-high'
            ? atAllTimeHighRows
            : scannerTab === 'strong-w-close'
              ? strongWCloseRows
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
            : scannerTab === 'strong-w-close'
              ? strongWCloseQuery
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

  const scanAnalysisStocks = useMemo(
    () =>
      tvRows.map((row) => ({
        symbol: row.ticker,
        name: row.companyName || row.ticker,
      })),
    [tvRows],
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
  const selectedTvSymbol = useMemo(() => {
    if (isTvTab) {
      if (tvRows.length === 0) return '';
      if (querySymbol && tvRows.some((r) => r.tvSymbol === querySymbol)) return querySymbol;
      return tvRows[0].tvSymbol;
    }
    return querySymbol?.trim() ?? '';
  }, [isTvTab, tvRows, querySymbol]);
  const selectedTickerForQuote = useMemo(() => {
    if (!isTvTab || !querySymbol) return '';
    const selected = tvRows.find((row) => row.tvSymbol === querySymbol);
    if (!selected?.isNse) return '';
    return selected.ticker.trim().toUpperCase();
  }, [isTvTab, querySymbol, tvRows]);
  const selectedQuoteQuery = useQuery({
    queryKey: ['nse-equity-quote', selectedTickerForQuote] as const,
    queryFn: () => fetchNseEquityQuoteRow(selectedTickerForQuote),
    enabled:
      isTvTab &&
      !!selectedTickerForQuote &&
      isScreenFocused &&
      (isLiveMarketSession ||
        queryClient.getQueryData(['nse-equity-quote', selectedTickerForQuote]) == null),
    staleTime: 10 * 60 * 1000,
    gcTime: 24 * 60 * 60 * 1000,
    refetchInterval: () => (isLiveMarketSession && isScreenFocused ? 10 * 60 * 1000 : false),
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
  const selectedPChange = selectedQuoteQuery.data?.metaData?.pChange;

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
  /** TradingView widget expects `BSE:ticker` when the screener returns `NSE:ticker`. */
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
    enabled: isTvTab && chartMode === 'kline' && !!chartNseSymbol,
  });

  useEffect(() => {
    if (!isTvTab) return;
    if (tvRows.length === 0) return;
    if (!querySymbol || !tvRows.some((r) => r.tvSymbol === querySymbol)) {
      const params = new URLSearchParams(searchParams.toString());
      if (scannerTab === '52h') {
        params.delete('tab');
      } else {
        params.set('tab', scannerTab);
      }
      params.set('symbol', tvRows[0].tvSymbol);
      const nextQuery = params.toString();
      const currentQuery = searchParams.toString();
      if (nextQuery !== currentQuery) {
        router.replace(nextQuery ? `/52w-scanner?${nextQuery}` : '/52w-scanner', { scroll: false });
      }
    }
  }, [isTvTab, scannerTab, tvRows, querySymbol, router, searchParams]);

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
    else if (scannerTab === 'strong-w-close') void strongWCloseQuery.refetch();
  }, [
    scannerTab,
    scanner52hQuery,
    monthlyQuery,
    newTrendQuery,
    atAllTimeHighQuery,
    strongWCloseQuery,
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
            : scannerTab === 'strong-w-close'
              ? 'Strong W Close'
              : '52W High';

  const scannerSubtitle =
    scannerTab === 'monthly'
      ? 'Fresh breakouts — new monthly highs with volume confirmation.'
      : scannerTab === 'new-trend'
        ? 'Trend continuation setups with momentum and RSI strength filters.'
        : scannerTab === 'at-all-time-high'
          ? 'Liquid stocks making fresh all-time highs.'
          : scannerTab === 'strong-w-close'
            ? 'Filters stocks giving a strong weekly close near the week’s high, with momentum and liquidity criteria.'
            : 'Stocks hitting fresh 52-week highs. Select a symbol to load the chart.';

  const listLabel =
    scannerTab === '52h'
      ? `52W H (${tvRows.length}${scanner52hQuery.data?.totalCount != null ? ` / ${scanner52hQuery.data.totalCount}` : ''})`
      : scannerTab === 'monthly'
        ? `Monthly (${tvRows.length}${monthlyQuery.data?.totalCount != null ? ` / ${monthlyQuery.data.totalCount}` : ''})`
        : scannerTab === 'new-trend'
          ? `New Trend (${tvRows.length}${newTrendQuery.data?.totalCount != null ? ` / ${newTrendQuery.data.totalCount}` : ''})`
          : scannerTab === 'at-all-time-high'
            ? `ATH (${tvRows.length}${atAllTimeHighQuery.data?.totalCount != null ? ` / ${atAllTimeHighQuery.data.totalCount}` : ''})`
            : scannerTab === 'strong-w-close'
              ? `Strong W Close (${tvRows.length}${strongWCloseQuery.data?.totalCount != null ? ` / ${strongWCloseQuery.data.totalCount}` : ''})`
              : `52W H (${tvRows.length}${scanner52hQuery.data?.totalCount != null ? ` / ${scanner52hQuery.data.totalCount}` : ''})`;

  const loadingLabel =
    scannerTab === 'monthly'
      ? 'Loading monthly screen…'
      : scannerTab === 'new-trend'
        ? 'Loading New Trend…'
        : scannerTab === 'at-all-time-high'
          ? 'Loading ATH screen…'
          : scannerTab === 'strong-w-close'
            ? 'Loading Strong W Close…'
            : 'Loading 52W scanner…';

  const STRONG_W_CLOSE_FILTER_LINES = [
    'Weekly performance (Perf.W) > 0',
    '10D avg traded value > 10M',
    'ROC > 4',
    'Weekly close within 97–100% of weekly high',
    'Market cap >= 20B',
    'Weekly ROC > 3',
    'Primary listings only',
  ] as const;

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
    {
      id: 'strong-w-close',
      label: 'Strong W Close',
      tooltip:
        'Filters stocks giving a strong weekly close — finishing the week near its high with positive weekly performance and momentum.',
      filterLines: STRONG_W_CLOSE_FILTER_LINES,
    },
  ];

  return (
    <div className="flex h-full min-h-0 flex-col gap-2">
      {/* ── Header ── */}
      <header className="shrink-0 rounded-xl border border-white/8 bg-[#111114] px-4 py-3.5 sm:px-5 sm:py-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-black tracking-tight text-white sm:text-2xl">Scanner</h1>
            <p className="mt-1.5 max-w-2xl text-[12px] leading-relaxed text-gray-500 sm:text-[13px]">
              {scannerSubtitle}
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
              <span className="hidden sm:inline">Analyse</span>
            </button>
            <button
              type="button"
              onClick={() => {
                if (!selectedStock) return;
                requirePremiumForAi(() => setAiSheetOpen(true));
              }}
              disabled={!selectedStock}
              aria-label={selectedStock ? `AI overview for ${selectedStock.ticker}` : 'AI overview (select a stock first)'}
              className="inline-flex items-center gap-1.5 rounded-lg border border-violet-400/30 bg-violet-500/10 px-3 py-1.5 text-[11px] font-semibold text-violet-200 transition-colors hover:bg-violet-500/18 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Sparkles className="h-3.5 w-3.5" aria-hidden />
              AI
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

        <TooltipProvider delay={200}>
          <div className="mt-3.5 flex w-full flex-wrap items-center gap-1 rounded-xl border border-white/8 bg-white/3 p-1">
            {TAB_DEFS.map(({ id, label, tooltip, filterLines }) => (
              <Tooltip key={id}>
                <TooltipTrigger
                  type="button"
                  onClick={() => setScannerTab(id)}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-semibold tracking-wide transition-colors ${
                    scannerTab === id
                      ? 'bg-white/10 text-white shadow-sm shadow-black/20'
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
      </header>


      <StockAiOverviewSheet
        open={aiSheetOpen}
        onOpenChange={(open) => guardAiSheetOpen(open, setAiSheetOpen)}
        ticker={selectedStock?.ticker ?? ''}
        companyName={selectedStock?.companyName ?? ''}
      />
      <ScanAnalysisSheet
        open={scanAnalysisOpen}
        onOpenChange={(open) => guardAiSheetOpen(open, setScanAnalysisOpen)}
        scannerName={scannerLabel}
        stocks={scanAnalysisStocks}
      />

      {listError ? (
        <div className="flex shrink-0 items-center gap-2 rounded-lg border border-amber-500/20 bg-amber-500/6 px-3 py-1.5 text-[11px] text-amber-100">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-400" aria-hidden />
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
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-white/8 bg-[#111114] lg:flex-row">

        {/* ── Left Sidebar: Stock List ── */}
        <aside className="flex max-h-[28%] min-h-0 w-full shrink-0 flex-col overflow-hidden border-b border-white/7 lg:h-full lg:max-h-none lg:w-[320px] lg:border-b-0 lg:border-r lg:border-white/7">

          {/* Sidebar header */}
          <div className="flex shrink-0 items-center justify-between gap-2 border-b border-white/6 px-4 py-2.5">
            <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-gray-500">{listLabel}</span>
            {listFetching || listLoading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin text-cyan-400" aria-hidden />
            ) : null}
          </div>

          {/* Stock list */}
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
            {listLoading ? (
              <div className="flex flex-col items-center justify-center gap-2 px-4 py-12 text-center">
                <Loader2 className="h-5 w-5 animate-spin text-gray-600" aria-hidden />
                <span className="text-[12px] text-gray-600">{loadingLabel}</span>
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
                  const quantamentalTickerKey = quantamentalScoreTickerKey(row.ticker);
                  const ch =
                    isSelected &&
                    selectedTickerForQuote === upperTicker &&
                    typeof selectedPChange === 'number' &&
                    Number.isFinite(selectedPChange)
                      ? selectedPChange
                      : row.changePct;
                  const isPositive = ch == null ? true : ch >= 0;
                  const bookmarked = isBookmarkedTicker(row.ticker);
                  const aiScore = aiScoreByTicker.get(quantamentalTickerKey);
                  return (
                    <li key={row.tvSymbol} className={`border-b border-white/4 last:border-b-0 ${isSelected ? 'bg-white/5.5' : ''}`}>
                      <div
                        className={`flex items-stretch gap-0 transition-colors ${
                          isSelected ? '' : 'hover:bg-white/3'
                        }`}
                      >

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
                                  AI {aiScore.quantamentalScore}%
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
                          <div className="mt-1 flex items-center gap-2 text-[11px] text-gray-500">
                            <span className="font-medium tabular-nums text-gray-400">₹{formatPrice(row.close)}</span>
                            <span className="text-gray-600">{row.exchange}</span>
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

        {/* ── Right Panel: Chart ── */}
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

              {/* Chart area */}
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
