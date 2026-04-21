'use client';

import { useEffect, useMemo, useCallback, useState, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  AlertTriangle,
  Bookmark,
  BookmarkCheck,
  CheckCircle2,
  Circle,
  LineChart,
  Loader2,
  RefreshCcw,
  Sparkles,
  Upload,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import NseEquityCandleChartWidget from '@/components/NseEquityCandleChartWidget';
import TradingViewAdvancedChartWidget from '@/components/TradingViewAdvancedChartWidget';
import TechnicalChartScoreControl, {
  compactStockTagLabel,
  stockTagBadgeClass,
} from '@/components/TechnicalChartScoreControl';
import { useAthScannerGlobalQuery } from '@/features/52wScanner/useAthScannerGlobalQuery';
import StockAiOverviewSheet from '@/features/52wScanner/StockAiOverviewSheet';
import { useTradingViewIndiaScreenerQuery } from '@/features/52wScanner/useTradingViewIndiaScreenerQuery';
import { useAiStockOverviewScoresQuery } from '@/features/ai/useAiStockOverviewScoresQuery';
import { useStockTagsQuery } from '@/features/stock-tags/useStockTagsQuery';
import { tradingViewScreenerRowToListItem } from '@/lib/tradingview-india-screener';
import { parseAthRowsFromScreenerXlsx } from '@/lib/screener-ath-xlsx';
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

type ScannerTab = '52h' | 'monthly' | '3m' | '1y-top' | 'short-term-pullback' | 'ath-scanner';

function tabFromSearchParams(tabParam: string | null): ScannerTab {
  if (tabParam === 'monthly') return 'monthly';
  if (tabParam === '3m') return '3m';
  if (tabParam === '1y-top') return '1y-top';
  if (tabParam === 'short-term-pullback') return 'short-term-pullback';
  if (tabParam === 'ath-scanner') return 'ath-scanner';
  return '52h';
}

/** 0 reading → 1 workbook ready → 2 parsed (stockCount) → 3 saved → 4 refreshed & finished */
type AthUploadProgressState =
  | null
  | {
      fileName: string;
      milestone: number;
      stockCount: number | null;
      error: string | null;
    };

export default function Scanner52wWorkspace() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const querySymbol = searchParams.get('symbol');
  const scannerTab = tabFromSearchParams(searchParams.get('tab'));

  const athXlsxInputRef = useRef<HTMLInputElement>(null);
  const lastAthServerUpdatedAt = useRef<string | null>(null);
  const [chartMode, setChartMode] = useState<'kline' | 'tradingview'>('kline');
  const [aiSheetOpen, setAiSheetOpen] = useState(false);
  const [athParseError, setAthParseError] = useState<string | null>(null);
  const [athUploadProgress, setAthUploadProgress] = useState<AthUploadProgressState>(null);
  /** ATH list bookmark icons follow this list only (reset on each upload), not global watchlist membership. */
  const [athWatchlistUiTickers, setAthWatchlistUiTickers] = useState<string[]>([]);

  const scanner52hQuery = useTradingViewIndiaScreenerQuery('monthly', scannerTab === '52h');
  const monthlyQuery = useTradingViewIndiaScreenerQuery('monthly', scannerTab === 'monthly');
  const threeMonthQuery = useTradingViewIndiaScreenerQuery('3m', scannerTab === '3m');
  const oneYearTopQuery = useTradingViewIndiaScreenerQuery('1y-top', scannerTab === '1y-top');
  const pullbackQuery = useTradingViewIndiaScreenerQuery(
    'short-term-pullback',
    scannerTab === 'short-term-pullback',
  );
  const scanner52hRows = useMemo(
    () => (scanner52hQuery.data?.data ?? []).map(tradingViewScreenerRowToListItem),
    [scanner52hQuery.data?.data],
  );
  const monthlyRows = useMemo(
    () => (monthlyQuery.data?.data ?? []).map(tradingViewScreenerRowToListItem),
    [monthlyQuery.data?.data],
  );
  const pullbackRows = useMemo(
    () => (pullbackQuery.data?.data ?? []).map(tradingViewScreenerRowToListItem),
    [pullbackQuery.data?.data],
  );
  const threeMonthRows = useMemo(
    () => (threeMonthQuery.data?.data ?? []).map(tradingViewScreenerRowToListItem),
    [threeMonthQuery.data?.data],
  );
  const oneYearTopRows = useMemo(
    () => (oneYearTopQuery.data?.data ?? []).map(tradingViewScreenerRowToListItem),
    [oneYearTopQuery.data?.data],
  );
  const isTvTab =
    scannerTab === '52h' ||
    scannerTab === 'monthly' ||
    scannerTab === '3m' ||
    scannerTab === '1y-top' ||
    scannerTab === 'short-term-pullback';
  const isAthTab = scannerTab === 'ath-scanner';
  const tvRows =
    scannerTab === '52h'
      ? scanner52hRows
      : scannerTab === 'monthly'
        ? monthlyRows
        : scannerTab === '3m'
          ? threeMonthRows
        : scannerTab === '1y-top'
          ? oneYearTopRows
          : scannerTab === 'short-term-pullback'
            ? pullbackRows
            : [];
  const tvQuery =
    scannerTab === '52h'
      ? scanner52hQuery
      : scannerTab === 'monthly'
        ? monthlyQuery
        : scannerTab === '3m'
          ? threeMonthQuery
        : scannerTab === '1y-top'
          ? oneYearTopQuery
          : scannerTab === 'short-term-pullback'
            ? pullbackQuery
            : null;

  const athGlobalQuery = useAthScannerGlobalQuery(isAthTab);
  const athRows = athGlobalQuery.data?.rows ?? [];
  const scannerListTickers = useMemo(() => {
    if (scannerTab === 'ath-scanner') return athRows.map((row) => row.ticker);
    if (isTvTab) return tvRows.map((row) => row.ticker);
    return [];
  }, [scannerTab, athRows, isTvTab, tvRows]);
  const { scoreByTicker: aiScoreByTicker } = useAiStockOverviewScoresQuery(scannerListTickers);

  const watchlist = useTradeStore((s) => s.watchlist);
  const toggleWatchlist = useTradeStore((s) => s.toggleWatchlist);
  const addToWatchlist = useTradeStore((s) => s.addToWatchlist);
  const removeFromWatchlist = useTradeStore((s) => s.removeFromWatchlist);
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
      return tagIds.some((tagId) => activeTagFilters.includes(tagId));
    },
    [activeTagFilters, stockTagsByTicker],
  );
  const filteredTvRows = useMemo(
    () => tvRows.filter((row) => matchesActiveTagFilter(row.ticker)),
    [tvRows, matchesActiveTagFilter],
  );
  const filteredAthRows = useMemo(
    () => athRows.filter((row) => matchesActiveTagFilter(row.ticker)),
    [athRows, matchesActiveTagFilter],
  );
  const selectedTvSymbol = useMemo(() => {
    if (scannerTab === 'ath-scanner') {
      if (filteredAthRows.length === 0) return '';
      if (querySymbol && filteredAthRows.some((r) => r.tvSymbol === querySymbol)) return querySymbol;
      return filteredAthRows[0].tvSymbol;
    }
    if (isTvTab) {
      if (filteredTvRows.length === 0) return '';
      if (querySymbol && filteredTvRows.some((r) => r.tvSymbol === querySymbol)) return querySymbol;
      return filteredTvRows[0].tvSymbol;
    }
    return querySymbol?.trim() ?? '';
  }, [scannerTab, filteredAthRows, isTvTab, filteredTvRows, querySymbol]);

  const chartNseSymbol = useMemo(() => {
    if (scannerTab === 'ath-scanner') {
      const r = athRows.find((x) => x.tvSymbol === selectedTvSymbol);
      return r?.ticker ?? '';
    }
    if (isTvTab) {
      const item = tvRows.find((row) => row.tvSymbol === selectedTvSymbol);
      return item?.isNse ? item.ticker : '';
    }
    return '';
  }, [scannerTab, athRows, isTvTab, tvRows, selectedTvSymbol]);

  const selectedStock = useMemo<{ ticker: string; companyName: string } | null>(() => {
    if (scannerTab === 'ath-scanner') {
      const r = athRows.find((x) => x.tvSymbol === selectedTvSymbol);
      return r ? { ticker: r.ticker, companyName: r.companyName } : null;
    }
    if (isTvTab) {
      const r = tvRows.find((x) => x.tvSymbol === selectedTvSymbol);
      return r ? { ticker: r.ticker, companyName: r.companyName } : null;
    }
    return null;
  }, [scannerTab, athRows, isTvTab, tvRows, selectedTvSymbol]);
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
    if (scannerTab !== 'ath-scanner') return;
    if (filteredAthRows.length === 0) return;
    if (!querySymbol || !filteredAthRows.some((r) => r.tvSymbol === querySymbol)) {
      const params = new URLSearchParams(searchParams.toString());
      params.set('tab', 'ath-scanner');
      params.set('symbol', filteredAthRows[0].tvSymbol);
      router.replace(`/52w-scanner?${params.toString()}`, { scroll: false });
    }
  }, [scannerTab, filteredAthRows, querySymbol, router, searchParams]);

  useEffect(() => {
    const u = athGlobalQuery.data?.updatedAt ?? null;
    if (!u) return;
    if (lastAthServerUpdatedAt.current !== null && u !== lastAthServerUpdatedAt.current) {
      setAthWatchlistUiTickers([]);
    }
    lastAthServerUpdatedAt.current = u;
  }, [athGlobalQuery.data?.updatedAt]);

  useEffect(() => {
    if (scannerTab !== 'ath-scanner') setAthUploadProgress(null);
  }, [scannerTab]);

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
    else if (scannerTab === '3m') void threeMonthQuery.refetch();
    else if (scannerTab === '1y-top') void oneYearTopQuery.refetch();
    else if (scannerTab === 'short-term-pullback') void pullbackQuery.refetch();
  }, [scannerTab, scanner52hQuery, monthlyQuery, threeMonthQuery, oneYearTopQuery, pullbackQuery]);

  const onAthToggleWatchlist = useCallback(
    async (ticker: string, companyName: string) => {
      const sym = ticker.trim().toUpperCase();
      const listId = DEFAULT_WATCHLIST_LIST_ID;
      const inGlobal = watchlist.some(
        (w) => w.listId === listId && w.kind === 'equity' && w.symbol.trim().toUpperCase() === sym,
      );
      const inLocalUi = athWatchlistUiTickers.includes(sym);
      const showingBookmarked = inLocalUi || inGlobal;
      if (showingBookmarked) {
        const existing = watchlist.find(
          (w) => w.listId === listId && w.kind === 'equity' && w.symbol.trim().toUpperCase() === sym,
        );
        if (existing) await removeFromWatchlist(existing.id);
        setAthWatchlistUiTickers((prev) => prev.filter((t) => t !== sym));
        return;
      }
      await addToWatchlist({
        listId,
        kind: 'equity',
        symbol: ticker,
        companyName: companyName.trim() ? companyName : ticker,
      });
      const added = useTradeStore
        .getState()
        .watchlist.some(
          (w) => w.listId === listId && w.kind === 'equity' && w.symbol.trim().toUpperCase() === sym,
        );
      if (added) setAthWatchlistUiTickers((prev) => (prev.includes(sym) ? prev : [...prev, sym]));
    },
    [addToWatchlist, removeFromWatchlist, watchlist, athWatchlistUiTickers],
  );

  const onAthXlsxChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      e.target.value = '';
      if (!file) return;
      setAthParseError(null);
      setAthUploadProgress({ fileName: file.name, milestone: 0, stockCount: null, error: null });
      const dismissProgress = (ms: number) => {
        window.setTimeout(() => setAthUploadProgress(null), ms);
      };
      try {
        const buf = await file.arrayBuffer();
        setAthUploadProgress({ fileName: file.name, milestone: 1, stockCount: null, error: null });
        const workbook = XLSX.read(buf, { type: 'array' });
        const parsed = parseAthRowsFromScreenerXlsx(workbook);
        if (parsed.length === 0) {
          const msg =
            'No Screener company rows found. Export a Screener screen to Excel (with /company/TICKER/ links) and try again.';
          setAthParseError(msg);
          setAthUploadProgress({
            fileName: file.name,
            milestone: 2,
            stockCount: 0,
            error: msg,
          });
          setAthWatchlistUiTickers([]);
          dismissProgress(10_000);
          return;
        }
        setAthUploadProgress({
          fileName: file.name,
          milestone: 2,
          stockCount: parsed.length,
          error: null,
        });
        const saveRes = await fetch('/api/ath-scanner/global', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sourceFileName: file.name, rows: parsed }),
        });
        const saveJson = (await saveRes.json().catch(() => ({}))) as { error?: string };
        if (!saveRes.ok) {
          const msg =
            typeof saveJson.error === 'string' ? saveJson.error : 'Failed to save the list to the server.';
          setAthParseError(msg);
          setAthUploadProgress({
            fileName: file.name,
            milestone: 2,
            stockCount: parsed.length,
            error: msg,
          });
          dismissProgress(12_000);
          return;
        }
        setAthUploadProgress({
          fileName: file.name,
          milestone: 3,
          stockCount: parsed.length,
          error: null,
        });
        setAthWatchlistUiTickers([]);
        await queryClient.invalidateQueries({ queryKey: ['ath-scanner', 'global'] });
        const params = new URLSearchParams(searchParams.toString());
        params.set('tab', 'ath-scanner');
        params.set('symbol', parsed[0].tvSymbol);
        router.replace(`/52w-scanner?${params.toString()}`, { scroll: false });
        setAthUploadProgress({
          fileName: file.name,
          milestone: 4,
          stockCount: parsed.length,
          error: null,
        });
        dismissProgress(6500);
      } catch {
        const msg = 'Failed to read the Excel file.';
        setAthParseError(msg);
        setAthUploadProgress((prev) =>
          prev
            ? { ...prev, error: msg }
            : { fileName: file.name, milestone: 0, stockCount: null, error: msg },
        );
        setAthWatchlistUiTickers([]);
        dismissProgress(10_000);
      }
    },
    [queryClient, router, searchParams],
  );

  const listFetching =
    scannerTab === 'ath-scanner'
      ? athGlobalQuery.isFetching
      : isTvTab
        ? (tvQuery?.isFetching ?? false)
        : isFetching;
  const listLoading =
    scannerTab === 'ath-scanner'
      ? athGlobalQuery.isPending
      : isTvTab
        ? (tvQuery?.isLoading ?? false)
        : false;
  const listError =
    scannerTab === 'ath-scanner' ? null : isTvTab ? (tvQuery?.error ?? null) : null;

  return (
    <div className="space-y-5">
      <input
        ref={athXlsxInputRef}
        type="file"
        accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        className="sr-only"
        aria-hidden
        onChange={onAthXlsxChange}
      />
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-white">Scanner</h1>
          <p className="mt-1 text-sm text-gray-500">
            {scannerTab === 'monthly'
              ? 'Monthly high screen (TradingView India): pick a symbol for K-line (NSE) or TradingView on the right.'
              : scannerTab === '3m'
                ? '3M momentum screen (TradingView India): strong 3-month performers with liquidity and technical strength filters.'
                : scannerTab === '1y-top'
                  ? '1Y Top screen (TradingView India): strongest 1-year movers with liquidity and market cap filters.'
              : scannerTab === 'short-term-pullback'
                ? 'Short-term pullback screen (TradingView India): names pulling back after a rally—pick a symbol to chart.'
                : scannerTab === 'ath-scanner'
                  ? 'ATH list is shared for everyone: upload a Screener.in Excel export to replace it, or open the tab to use the latest list. Chart uses BSE:TICKER; bookmark a row to add it to your watchlist.'
                  : '52W H scanner (TradingView India): select any symbol to view K-line (NSE) or TradingView chart on the right.'}
          </p>
          {scannerTab === 'ath-scanner' && athGlobalQuery.data?.sourceFileName ? (
            <p className="mt-1 text-[11px] text-gray-600">Current file: {athGlobalQuery.data.sourceFileName}</p>
          ) : null}
          {scannerTab === 'ath-scanner' && athGlobalQuery.data?.unavailable ? (
            <p className="mt-1 text-[11px] text-amber-600/90">
              Server database is not configured; ATH upload will not persist for others until DATABASE_URL is set.
            </p>
          ) : null}
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
                  52 H
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
                  Monthly H
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-xs text-left leading-snug">
                  TradingView India monthly-high screener—surfaces names making fresh monthly highs for swing and
                  trend context alongside the 52-week list.
                </TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger
                  type="button"
                  onClick={() => setScannerTab('3m')}
                  className={`rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${
                    scannerTab === '3m'
                      ? 'border-blue-500/50 bg-blue-500/15 text-blue-100'
                      : 'border-white/10 bg-white/5 text-gray-400 hover:border-white/20 hover:text-gray-200'
                  }`}
                >
                  3 M
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-xs text-left leading-snug">
                  TradingView India 3-month momentum screen—focuses on strong relative strength and liquidity for swing setups.
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
              <Tooltip>
                <TooltipTrigger
                  type="button"
                  onClick={() => setScannerTab('short-term-pullback')}
                  className={`rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${
                    scannerTab === 'short-term-pullback'
                      ? 'border-blue-500/50 bg-blue-500/15 text-blue-100'
                      : 'border-white/10 bg-white/5 text-gray-400 hover:border-white/20 hover:text-gray-200'
                  }`}
                >
                  Short Term Pullback
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-xs text-left leading-snug">
                  TradingView India screen for stocks in a short-term pullback after a broader rally—EMA stack and
                  momentum filters, same chart flow as Monthly H.
                </TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger
                  type="button"
                  onClick={() => setScannerTab('ath-scanner')}
                  className={`rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${
                    scannerTab === 'ath-scanner'
                      ? 'border-blue-500/50 bg-blue-500/15 text-blue-100'
                      : 'border-white/10 bg-white/5 text-gray-400 hover:border-white/20 hover:text-gray-200'
                  }`}
                >
                  ATH scanner
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-xs text-left leading-snug">
                  Shared ATH list from the database—any signed-in user can refresh the file for everyone. Symbols come
                  from /company/TICKER/ URLs. Bookmark a row to add it only to your watchlist.
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
          {scannerTab !== 'ath-scanner' ? (
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
          ) : null}
        </div>
      </div>

      <StockAiOverviewSheet
        open={aiSheetOpen}
        onOpenChange={setAiSheetOpen}
        ticker={selectedStock?.ticker ?? ''}
        companyName={selectedStock?.companyName ?? ''}
      />

      {scannerTab === 'ath-scanner' && athUploadProgress ? (
        <div
          className={`rounded-2xl border px-4 py-3 ${
            athUploadProgress.error
              ? 'border-red-500/30 bg-red-500/10'
              : 'border-blue-500/25 bg-blue-500/[0.07]'
          }`}
          role="status"
          aria-live="polite"
        >
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500">ATH file upload</p>
          <ul className="mt-3 space-y-2.5 text-sm text-gray-200">
            <li className="flex items-start gap-2.5">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" aria-hidden />
              <span>
                <span className="font-semibold text-white">File uploaded</span>
                <span className="mt-0.5 block text-xs text-gray-500">{athUploadProgress.fileName}</span>
              </span>
            </li>
            <li className="flex items-start gap-2.5">
              {athUploadProgress.milestone >= 1 ? (
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" aria-hidden />
              ) : athUploadProgress.milestone === 0 && !athUploadProgress.error ? (
                <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin text-blue-400" aria-hidden />
              ) : (
                <Circle className="mt-0.5 h-4 w-4 shrink-0 text-gray-600" aria-hidden />
              )}
              <span>
                <span className={athUploadProgress.milestone >= 1 ? 'font-medium text-white' : 'text-gray-500'}>
                  Workbook loaded into memory
                </span>
                {athUploadProgress.milestone === 0 && !athUploadProgress.error ? (
                  <span className="mt-0.5 block text-xs text-gray-500">Reading bytes from disk…</span>
                ) : null}
              </span>
            </li>
            <li className="flex items-start gap-2.5">
              {(athUploadProgress.milestone >= 2 &&
                athUploadProgress.stockCount != null &&
                athUploadProgress.stockCount > 0) ? (
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" aria-hidden />
              ) : athUploadProgress.milestone === 1 && !athUploadProgress.error ? (
                <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin text-blue-400" aria-hidden />
              ) : athUploadProgress.error && athUploadProgress.stockCount === 0 ? (
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" aria-hidden />
              ) : (
                <Circle className="mt-0.5 h-4 w-4 shrink-0 text-gray-600" aria-hidden />
              )}
              <span>
                <span
                  className={
                    athUploadProgress.milestone >= 2 &&
                    athUploadProgress.stockCount != null &&
                    athUploadProgress.stockCount > 0
                      ? 'font-medium text-white'
                      : 'text-gray-500'
                  }
                >
                  Parsing complete
                </span>
                {athUploadProgress.milestone === 1 && !athUploadProgress.error ? (
                  <span className="mt-0.5 block text-xs text-gray-500">Scanning Screener company links…</span>
                ) : null}
                {athUploadProgress.milestone >= 2 &&
                athUploadProgress.stockCount != null &&
                athUploadProgress.stockCount > 0 ? (
                  <span className="mt-0.5 block text-xs text-emerald-200/90">
                    Fetched{' '}
                    <span className="font-mono font-bold text-emerald-100">
                      {athUploadProgress.stockCount}
                    </span>{' '}
                    {athUploadProgress.stockCount === 1 ? 'stock' : 'stocks'} from the file
                  </span>
                ) : null}
              </span>
            </li>
            <li className="flex items-start gap-2.5">
              {athUploadProgress.milestone >= 3 && !athUploadProgress.error ? (
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" aria-hidden />
              ) : athUploadProgress.milestone === 2 &&
                (athUploadProgress.stockCount ?? 0) > 0 &&
                !athUploadProgress.error ? (
                <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin text-blue-400" aria-hidden />
              ) : athUploadProgress.error && (athUploadProgress.stockCount ?? 0) > 0 ? (
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" aria-hidden />
              ) : (
                <Circle className="mt-0.5 h-4 w-4 shrink-0 text-gray-600" aria-hidden />
              )}
              <span>
                <span
                  className={
                    athUploadProgress.milestone >= 3 && !athUploadProgress.error
                      ? 'font-medium text-white'
                      : 'text-gray-500'
                  }
                >
                  Shared scanner updated
                </span>
                {athUploadProgress.milestone === 2 && athUploadProgress.stockCount && !athUploadProgress.error ? (
                  <span className="mt-0.5 block text-xs text-gray-500">Writing rows to the database…</span>
                ) : null}
              </span>
            </li>
            <li className="flex items-start gap-2.5">
              {athUploadProgress.milestone >= 4 && !athUploadProgress.error ? (
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" aria-hidden />
              ) : athUploadProgress.milestone === 3 && !athUploadProgress.error ? (
                <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin text-blue-400" aria-hidden />
              ) : athUploadProgress.error && athUploadProgress.milestone >= 3 ? (
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" aria-hidden />
              ) : (
                <Circle className="mt-0.5 h-4 w-4 shrink-0 text-gray-600" aria-hidden />
              )}
              <span>
                <span
                  className={
                    athUploadProgress.milestone >= 4 && !athUploadProgress.error
                      ? 'font-medium text-emerald-100'
                      : 'text-gray-500'
                  }
                >
                  Scanner list refreshed
                </span>
                {athUploadProgress.milestone === 3 && !athUploadProgress.error ? (
                  <span className="mt-0.5 block text-xs text-gray-500">Fetching the latest list for this screen…</span>
                ) : null}
                {athUploadProgress.milestone >= 4 && !athUploadProgress.error ? (
                  <span className="mt-0.5 block text-xs text-emerald-200/80">
                    ATH scanner is up to date — this panel will hide in a few seconds.
                  </span>
                ) : null}
              </span>
            </li>
          </ul>
          {athUploadProgress.error ? (
            <p className="mt-3 border-t border-white/10 pt-3 text-sm text-red-300">{athUploadProgress.error}</p>
          ) : null}
        </div>
      ) : null}

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

      {isAthTab && athRows.length === 0 ? (
        athGlobalQuery.isPending ? (
          <div className="flex min-h-[min(520px,calc(100dvh-16rem))] flex-col items-center justify-center gap-3 rounded-3xl border border-dashed border-white/15 bg-[#161618] px-6 py-16 text-center">
            <Loader2 className="h-9 w-9 animate-spin text-blue-400" aria-hidden />
            <p className="text-sm text-gray-400">Loading shared ATH list…</p>
          </div>
        ) : (
          <div className="flex min-h-[min(520px,calc(100dvh-16rem))] flex-col items-center justify-center gap-4 rounded-3xl border border-dashed border-white/15 bg-[#161618] px-6 py-16 text-center">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <Upload className="mx-auto h-10 w-10 text-blue-400" aria-hidden />
            </div>
            <div>
              <p className="text-lg font-bold text-white">ATH scanner</p>
              <p className="mt-2 max-w-md text-sm text-gray-500">
                No shared list yet, or it failed to load. Export a Screener.in screen to Excel (.xlsx) and upload—rows
                are stored for everyone. Bookmark a row to add it to your watchlist only.
              </p>
            </div>
            {athGlobalQuery.isError ? (
              <p className="max-w-md text-sm text-amber-400/90">
                {athGlobalQuery.error instanceof Error ? athGlobalQuery.error.message : 'Could not load the shared list.'}
                {' '}
                <button
                  type="button"
                  onClick={() => void athGlobalQuery.refetch()}
                  className="font-semibold text-blue-300 underline-offset-2 hover:underline"
                >
                  Retry
                </button>
              </p>
            ) : null}
            <button
              type="button"
              onClick={() => athXlsxInputRef.current?.click()}
              className="inline-flex items-center gap-2 rounded-xl border border-blue-500/40 bg-blue-500/15 px-4 py-2.5 text-sm font-semibold text-blue-100 hover:bg-blue-500/25"
            >
              <Upload className="h-4 w-4" aria-hidden />
              Choose Excel file
            </button>
            {athParseError ? <p className="max-w-md text-sm text-red-400">{athParseError}</p> : null}
          </div>
        )
      ) : (
        <div className="flex h-[min(max(480px,calc(100dvh-14rem)),880px)] flex-col overflow-hidden rounded-3xl border border-white/10 bg-[#161618] lg:flex-row">
          <aside className="flex max-h-[40%] min-h-0 w-full shrink-0 flex-col overflow-hidden border-b border-white/10 lg:h-full lg:max-h-none lg:w-[min(100%,360px)] lg:border-b-0 lg:border-r">
            <div className="flex shrink-0 items-center justify-between gap-2 border-b border-white/5 px-4 py-3">
              <span className="text-[10px] font-bold uppercase tracking-widest text-gray-500">
                {scannerTab === '52h'
                  ? `52W H scanner (${filteredTvRows.length}${scanner52hQuery.data?.totalCount != null ? ` / ${scanner52hQuery.data.totalCount}` : ''})`
                  : scannerTab === 'monthly'
                  ? `Monthly screen (${filteredTvRows.length}${monthlyQuery.data?.totalCount != null ? ` / ${monthlyQuery.data.totalCount}` : ''})`
                  : scannerTab === '3m'
                    ? `3M screen (${filteredTvRows.length}${threeMonthQuery.data?.totalCount != null ? ` / ${threeMonthQuery.data.totalCount}` : ''})`
                  : scannerTab === '1y-top'
                    ? `1Y Top (${filteredTvRows.length}${oneYearTopQuery.data?.totalCount != null ? ` / ${oneYearTopQuery.data.totalCount}` : ''})`
                  : scannerTab === 'short-term-pullback'
                    ? `Short-term pullback (${filteredTvRows.length}${pullbackQuery.data?.totalCount != null ? ` / ${pullbackQuery.data.totalCount}` : ''})`
                    : scannerTab === 'ath-scanner'
                      ? `ATH list (${filteredAthRows.length})`
                      : `Scanner (${filteredTvRows.length})`}
              </span>
              <div className="flex shrink-0 items-center gap-2">
                {scannerTab === 'ath-scanner' ? (
                  <button
                    type="button"
                    onClick={() => athXlsxInputRef.current?.click()}
                    className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-gray-300 hover:bg-white/10"
                  >
                    Replace file
                  </button>
                ) : null}
                {listFetching || listLoading ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-400" aria-hidden />
                ) : null}
              </div>
            </div>
            <div className="flex shrink-0 flex-wrap items-center gap-1 border-b border-white/5 px-4 py-2">
              <span className="mr-1 text-[9px] font-bold uppercase tracking-wide text-gray-600">Tags</span>
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
              {scannerTab === 'ath-scanner' ? (
                filteredAthRows.length === 0 ? (
                  <div className="px-3 py-8 text-center text-sm text-gray-500">
                    No symbols match the selected tag filter.
                  </div>
                ) : (
                  <ul className="space-y-1">
                    {filteredAthRows.map((row, athIdx) => {
                  const isSelected = row.tvSymbol === selectedTvSymbol;
                  const sym = row.ticker.trim().toUpperCase();
                  const bookmarked =
                    athWatchlistUiTickers.includes(sym) || isBookmarkedTicker(row.ticker);
                  return (
                    <li key={`ath-${athIdx}-${sym}`}>
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
                                        key={`${row.ticker}-${tagId}`}
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
                            <span className="shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-bold text-gray-500">
                              ATH
                            </span>
                          </div>
                          <div className="mt-2 text-[11px] text-gray-500">
                            <a
                              href={row.screenerUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="truncate text-blue-400/90 hover:underline"
                              onClick={(ev) => ev.stopPropagation()}
                            >
                              Screener
                            </a>
                          </div>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            void onAthToggleWatchlist(row.ticker, row.companyName);
                          }}
                          aria-label={
                            bookmarked ? `Remove ${row.ticker} from watchlist` : `Add ${row.ticker} to watchlist`
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
              <div className="px-3 py-8 text-center text-sm text-gray-500">
                {scannerTab === 'monthly'
                  ? 'Loading monthly screen…'
                  : scannerTab === '3m'
                    ? 'Loading 3M screen…'
                    : scannerTab === '1y-top'
                      ? 'Loading 1Y Top screen…'
                    : 'Loading short-term pullback screen…'}
              </div>
            ) : filteredTvRows.length === 0 ? (
              <div className="px-3 py-8 text-center text-sm text-gray-500">
                No symbols matched this TradingView screen right now.
              </div>
            ) : (
              <ul className="space-y-1">
                {filteredTvRows.map((row) => {
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
                  : scannerTab === '3m'
                    ? 'Loading 3M screen…'
                    : scannerTab === '1y-top'
                      ? 'Loading 1Y Top screen…'
                  : 'Loading short-term pullback screen…'
                : 'Select a stock from the scanner to load a chart.'}
            </div>
          )}
        </div>
      </div>
      )}
    </div>
  );
}
