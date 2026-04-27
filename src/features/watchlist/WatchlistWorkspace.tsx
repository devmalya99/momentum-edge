'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { BookmarkCheck, LineChart, Loader2, Plus, Search, Trash2, ListPlus, Pencil, Sparkles } from 'lucide-react';
import { useQueries, useQuery } from '@tanstack/react-query';
import NseEquityCandleChartWidget from '@/components/NseEquityCandleChartWidget';
import TradingViewAdvancedChartWidget from '@/components/TradingViewAdvancedChartWidget';
import TechnicalChartScoreControl, {
  compactStockTagLabel,
  stockTagBadgeClass,
} from '@/components/TechnicalChartScoreControl';
import {
  quantamentalScoreTickerKey,
  useAiStockOverviewScoresQuery,
} from '@/features/ai/useAiStockOverviewScoresQuery';
import RelativeTurnoverFilterControl from '@/features/relative-turnover/RelativeTurnoverFilterControl';
import TurnoverAccelerationBadge from '@/features/turnover-acceleration/TurnoverAccelerationBadge';
import { useStockMetricsBackgroundQueue } from '@/features/stock-metrics/useStockMetricsBackgroundQueue';
import { useStockTagsQuery } from '@/features/stock-tags/useStockTagsQuery';
import StockAiOverviewSheet from '@/features/scanner/StockAiOverviewSheet';
import { toTradingViewSymbol, watchlistSymbolToTradingView } from '@/lib/tradingview-symbol';
import { fetchNseEquityQuoteRow } from '@/lib/nse-quote-client';
import { useTradeStore } from '@/store/useTradeStore';
import { useRelativeTurnoverStore } from '@/store/useRelativeTurnoverStore';
import { useTurnoverAccelerationStore } from '@/store/useTurnoverAccelerationStore';
import type { NseEquitySearchHit } from '@/app/api/nse/equity-search/route';
import type { NseIndexSearchHit } from '@/app/api/nse/market-search/route';
import { DEFAULT_WATCHLIST_LIST_ID } from '@/lib/watchlist-defaults';
import { useAuthStore } from '@/store/useAuthStore';

const FIVE_MIN_MS = 5 * 60 * 1000;

type WatchlistSortMode = 'added' | 'pct_desc' | 'pct_asc';

function newItemId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export default function WatchlistWorkspace() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryList = searchParams.get('list');
  const queryItem = searchParams.get('item');
  const legacySymbol = searchParams.get('symbol');

  const watchlist = useTradeStore((s) => s.watchlist);
  const watchlistLists = useTradeStore((s) => s.watchlistLists);
  const removeFromWatchlist = useTradeStore((s) => s.removeFromWatchlist);
  const authUser = useAuthStore((s) => s.user);
  const canEditStockTags = authUser?.role === 'admin';
  const addToWatchlist = useTradeStore((s) => s.addToWatchlist);
  const addManyToWatchlist = useTradeStore((s) => s.addManyToWatchlist);
  const createWatchlistList = useTradeStore((s) => s.createWatchlistList);
  const renameWatchlistList = useTradeStore((s) => s.renameWatchlistList);
  const deleteWatchlistList = useTradeStore((s) => s.deleteWatchlistList);

  const [searchDraft, setSearchDraft] = useState('');
  const [debouncedQ, setDebouncedQ] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedQ(searchDraft.trim()), 350);
    return () => window.clearTimeout(t);
  }, [searchDraft]);

  const searchQuery = useQuery({
    queryKey: ['nse-market-search', debouncedQ],
    queryFn: async () => {
      const res = await fetch(`/api/nse/market-search?q=${encodeURIComponent(debouncedQ)}`, {
        cache: 'no-store',
      });
      const payload = (await res.json()) as {
        equities?: NseEquitySearchHit[];
        indices?: NseIndexSearchHit[];
        error?: string;
      };
      if (!res.ok) {
        throw new Error(typeof payload?.error === 'string' ? payload.error : 'Search failed');
      }
      return {
        equities: Array.isArray(payload.equities) ? payload.equities : [],
        indices: Array.isArray(payload.indices) ? payload.indices : [],
      };
    },
    enabled: debouncedQ.length >= 2,
    staleTime: 60_000,
  });

  const activeListId = useMemo(() => {
    if (queryList && watchlistLists.some((l) => l.id === queryList)) return queryList;
    return watchlistLists[0]?.id ?? DEFAULT_WATCHLIST_LIST_ID;
  }, [queryList, watchlistLists]);

  const itemsForList = useMemo(
    () => watchlist.filter((w) => w.listId === activeListId).sort((a, b) => b.addedAt - a.addedAt),
    [watchlist, activeListId],
  );

  const [sortMode, setSortMode] = useState<WatchlistSortMode>('added');
  const [chartMode, setChartMode] = useState<'kline' | 'tradingview'>('kline');
  const [aiSheetOpen, setAiSheetOpen] = useState(false);
  const [activeTagFilters, setActiveTagFilters] = useState<string[]>([]);
  const [minRelativeTurnoverPct, setMinRelativeTurnoverPct] = useState(0);
  const [minTurnoverSurgePct, setMinTurnoverSurgePct] = useState(0);

  const symbolsForQuotes = useMemo(() => {
    const s = new Set<string>();
    for (const w of itemsForList) {
      if (w.kind === 'equity') s.add(w.symbol.trim().toUpperCase());
    }
    return [...s];
  }, [itemsForList]);
  const aiScoreTickers = useMemo(
    () => itemsForList.filter((item) => item.kind === 'equity').map((item) => item.symbol),
    [itemsForList],
  );
  const { scoreByTicker: aiScoreByTicker } = useAiStockOverviewScoresQuery(aiScoreTickers);
  const technicalScoreTickers = useMemo(
    () => itemsForList.filter((item) => item.kind === 'equity').map((item) => item.symbol),
    [itemsForList],
  );
  const { hasReadyMetrics } = useStockMetricsBackgroundQueue(technicalScoreTickers);
  const relativeStoreBySymbol = useRelativeTurnoverStore((s) => s.bySymbol);
  const getValidRelativeMetric = useRelativeTurnoverStore((s) => s.getValidMetric);
  const accelerationStoreBySymbol = useTurnoverAccelerationStore((s) => s.bySymbol);
  const getValidAccelerationMetric = useTurnoverAccelerationStore((s) => s.getValidMetric);
  const relativeTurnoverBySymbol = useMemo(() => {
    const map = new Map<string, ReturnType<typeof getValidRelativeMetric>>();
    for (const ticker of technicalScoreTickers) {
      const key = ticker.trim().toUpperCase();
      const metric = getValidRelativeMetric(key);
      if (metric) map.set(key, metric);
    }
    return map;
  }, [technicalScoreTickers, getValidRelativeMetric, relativeStoreBySymbol]);
  const turnoverAccelerationBySymbol = useMemo(() => {
    const map = new Map<string, ReturnType<typeof getValidAccelerationMetric>>();
    for (const ticker of technicalScoreTickers) {
      const key = ticker.trim().toUpperCase();
      const metric = getValidAccelerationMetric(key);
      if (metric) map.set(key, metric);
    }
    return map;
  }, [technicalScoreTickers, getValidAccelerationMetric, accelerationStoreBySymbol]);

  const quoteQueries = useQueries({
    queries: symbolsForQuotes.map((symbol) => ({
      queryKey: ['nse-equity-quote', symbol] as const,
      queryFn: () => fetchNseEquityQuoteRow(symbol),
      enabled: symbolsForQuotes.length > 0,
      staleTime: 0,
      gcTime: 30 * 60 * 1000,
      refetchInterval: FIVE_MIN_MS,
      refetchOnWindowFocus: true,
    })),
  });

  const quoteDataSignature = quoteQueries
    .map((q) => {
      const row = q.data;
      if (!row) return `${q.status}`;
      return `${q.status}:${row.metaData?.pChange ?? 'x'}:${row.metaData?.closePrice ?? ''}`;
    })
    .join('|');

  const symToQuoteIdx = useMemo(() => {
    const m = new Map<string, number>();
    symbolsForQuotes.forEach((sym, i) => m.set(sym, i));
    return m;
  }, [symbolsForQuotes]);

  const pChangeBySymbol = useMemo(() => {
    const m = new Map<string, number>();
    symbolsForQuotes.forEach((sym) => {
      const i = symToQuoteIdx.get(sym);
      if (i == null) return;
      const pc = quoteQueries[i]?.data?.metaData?.pChange;
      if (typeof pc === 'number' && Number.isFinite(pc)) m.set(sym, pc);
    });
    return m;
  }, [symbolsForQuotes, symToQuoteIdx, quoteDataSignature]);

  const sortedWatchlist = useMemo(() => {
    const rows = [...itemsForList];
    if (sortMode === 'added') return rows;
    rows.sort((a, b) => {
      const sa = a.symbol.trim().toUpperCase();
      const sb = b.symbol.trim().toUpperCase();
      const pa = a.kind === 'equity' ? pChangeBySymbol.get(sa) : undefined;
      const pb = b.kind === 'equity' ? pChangeBySymbol.get(sb) : undefined;
      if (pa == null && pb == null) return b.addedAt - a.addedAt;
      if (pa == null) return 1;
      if (pb == null) return -1;
      const cmp = sortMode === 'pct_desc' ? pb - pa : pa - pb;
      if (cmp !== 0) return cmp;
      return b.addedAt - a.addedAt;
    });
    return rows;
  }, [itemsForList, sortMode, pChangeBySymbol]);
  const {
    staticTags,
    stockTagsByTicker,
    isLoadingStaticTags,
    isLoadingStockTags,
    isFetchingStockTags,
    saveTags,
    isSavingTags,
  } = useStockTagsQuery(technicalScoreTickers);
  const staticTagLabelById = useMemo(() => {
    const map = new Map<string, string>();
    for (const tag of staticTags) map.set(tag.id, tag.label);
    return map;
  }, [staticTags]);
  const toggleTagFilter = useCallback((tagId: string) => {
    setActiveTagFilters((prev) =>
      prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId],
    );
  }, []);
  const matchesActiveTagFilter = useCallback(
    (symbol: string, kind: 'equity' | 'index') => {
      if (kind !== 'equity') return true;
      if (activeTagFilters.length === 0) return true;
      const tagIds = stockTagsByTicker.get(symbol.trim().toUpperCase()) ?? [];
      if (tagIds.length === 0) return true;
      return tagIds.some((tagId) => activeTagFilters.includes(tagId));
    },
    [activeTagFilters, stockTagsByTicker],
  );
  const matchesRelativeTurnoverFilter = useCallback(
    (symbol: string, kind: 'equity' | 'index') => {
      if (kind !== 'equity') return true;
      if (minRelativeTurnoverPct <= 0) return true;
      const metric = relativeTurnoverBySymbol.get(symbol.trim().toUpperCase());
      if (!metric) return false;
      return metric.relativeTurnoverPct >= minRelativeTurnoverPct;
    },
    [minRelativeTurnoverPct, relativeTurnoverBySymbol],
  );
  const matchesTurnoverSurgeFilter = useCallback(
    (symbol: string, kind: 'equity' | 'index') => {
      if (kind !== 'equity') return true;
      if (minTurnoverSurgePct <= 0) return true;
      const metric = turnoverAccelerationBySymbol.get(symbol.trim().toUpperCase());
      const surge = metric?.turnoverAccelerationPct;
      if (surge == null || !Number.isFinite(surge)) return false;
      return surge >= minTurnoverSurgePct;
    },
    [minTurnoverSurgePct, turnoverAccelerationBySymbol],
  );
  const filteredSortedWatchlist = useMemo(
    () =>
      sortedWatchlist.filter(
        (item) =>
          matchesActiveTagFilter(item.symbol, item.kind) &&
          matchesRelativeTurnoverFilter(item.symbol, item.kind) &&
          matchesTurnoverSurgeFilter(item.symbol, item.kind),
      ),
    [
      sortedWatchlist,
      matchesActiveTagFilter,
      matchesRelativeTurnoverFilter,
      matchesTurnoverSurgeFilter,
    ],
  );
  const selectedItemId = useMemo(() => {
    if (filteredSortedWatchlist.length === 0) return '';
    if (queryItem && filteredSortedWatchlist.some((w) => w.id === queryItem)) return queryItem;
    if (legacySymbol) {
      const byTv = filteredSortedWatchlist.find((w) => w.id === legacySymbol);
      if (byTv) return byTv.id;
      const symMatch = filteredSortedWatchlist.find(
        (w) => toTradingViewSymbol(w.symbol) === legacySymbol.trim(),
      );
      if (symMatch) return symMatch.id;
    }
    return filteredSortedWatchlist[0].id;
  }, [filteredSortedWatchlist, queryItem, legacySymbol]);
  const selectedWatchlistItem = useMemo(
    () => filteredSortedWatchlist.find((w) => w.id === selectedItemId) ?? null,
    [filteredSortedWatchlist, selectedItemId],
  );
  const selectedTechnicalScoreTicker =
    selectedWatchlistItem?.kind === 'equity' ? selectedWatchlistItem.symbol.trim().toUpperCase() : '';
  const selectedAiStock = useMemo(
    () =>
      selectedWatchlistItem?.kind === 'equity'
        ? {
            ticker: selectedWatchlistItem.symbol,
            companyName: selectedWatchlistItem.companyName,
          }
        : null,
    [selectedWatchlistItem],
  );

  const tradingViewSymbol = useMemo(() => {
    if (!selectedWatchlistItem) return '';
    return watchlistSymbolToTradingView(
      selectedWatchlistItem.symbol,
      selectedWatchlistItem.kind === 'index' ? 'index' : 'equity',
    );
  }, [selectedWatchlistItem]);

  const replaceWatchlistUrl = useCallback(
    (listId: string, itemId: string) => {
      const q = new URLSearchParams();
      q.set('list', listId);
      if (itemId) q.set('item', itemId);
      router.replace(`/watchlist?${q.toString()}`, { scroll: false });
    },
    [router],
  );

  useEffect(() => {
    if (filteredSortedWatchlist.length === 0) return;
    const want = selectedItemId;
    if (!want) return;
    const listOk = !queryList || queryList === activeListId;
    if (queryItem === want && listOk) return;
    replaceWatchlistUrl(activeListId, want);
  }, [filteredSortedWatchlist, selectedItemId, queryItem, queryList, activeListId, replaceWatchlistUrl]);

  const onPickWatchlistRow = useCallback(
    (rowId: string) => {
      replaceWatchlistUrl(activeListId, rowId);
    },
    [replaceWatchlistUrl, activeListId],
  );

  const onChangeActiveList = useCallback(
    (listId: string) => {
      const nextItems = watchlist.filter((w) => w.listId === listId).sort((a, b) => b.addedAt - a.addedAt);
      const firstId = nextItems[0]?.id ?? '';
      replaceWatchlistUrl(listId, firstId);
    },
    [watchlist, replaceWatchlistUrl],
  );

  const equityAlreadyInList = useCallback(
    (symbol: string) =>
      itemsForList.some(
        (w) => w.kind === 'equity' && w.symbol.trim().toUpperCase() === symbol.trim().toUpperCase(),
      ),
    [itemsForList],
  );

  const indexAlreadyInList = useCallback(
    (indexName: string) =>
      itemsForList.some(
        (w) => w.kind === 'index' && w.symbol.trim().toUpperCase() === indexName.trim().toUpperCase(),
      ),
    [itemsForList],
  );

  const handleAddEquityHit = useCallback(
    async (hit: NseEquitySearchHit) => {
      const sym = hit.symbol.trim().toUpperCase();
      if (equityAlreadyInList(sym)) return;
      const id = newItemId();
      await addToWatchlist({
        id,
        listId: activeListId,
        kind: 'equity',
        symbol: sym,
        companyName: (hit.companyName || hit.symbol).trim(),
      });
      onPickWatchlistRow(id);
      setSearchDraft('');
      setSearchOpen(false);
    },
    [addToWatchlist, activeListId, onPickWatchlistRow, equityAlreadyInList],
  );

  const handleAddIndexHit = useCallback(
    async (hit: NseIndexSearchHit) => {
      try {
        const indexName = hit.indexName.trim();
        if (indexAlreadyInList(indexName)) return;

        const res = await fetch(
          `/api/nse/index-constituents?index=${encodeURIComponent(indexName)}`,
          { cache: 'no-store' },
        );
        const payload = (await res.json()) as {
          indexName?: string;
          constituents?: Array<{ symbol: string; companyName: string }>;
          error?: string;
        };
        if (!res.ok) {
          throw new Error(typeof payload.error === 'string' ? payload.error : 'Failed to load index members');
        }
        const constituents = Array.isArray(payload.constituents) ? payload.constituents : [];
        const resolvedName = (payload.indexName ?? indexName).trim();

        const batch: Parameters<typeof addManyToWatchlist>[0] = [
          {
            id: newItemId(),
            listId: activeListId,
            kind: 'index',
            symbol: resolvedName,
            companyName: resolvedName,
          },
          ...constituents.map((c) => ({
            id: newItemId(),
            listId: activeListId,
            kind: 'equity' as const,
            symbol: c.symbol.trim().toUpperCase(),
            companyName: (c.companyName || c.symbol).trim(),
          })),
        ];

        await addManyToWatchlist(batch);
        const firstId = batch[0]?.id;
        if (firstId) onPickWatchlistRow(firstId);
        setSearchDraft('');
        setSearchOpen(false);
      } catch (e) {
        window.alert(e instanceof Error ? e.message : 'Failed to add index');
      }
    },
    [addManyToWatchlist, activeListId, onPickWatchlistRow, indexAlreadyInList],
  );

  const onCreateList = useCallback(async () => {
    const name = window.prompt('Watchlist name');
    if (name == null) return;
    await createWatchlistList(name);
  }, [createWatchlistList]);

  const onRenameList = useCallback(async () => {
    const current = watchlistLists.find((l) => l.id === activeListId);
    if (!current) return;
    const name = window.prompt('Rename watchlist', current.name);
    if (name == null) return;
    await renameWatchlistList(activeListId, name);
  }, [watchlistLists, activeListId, renameWatchlistList]);

  const onDeleteList = useCallback(async () => {
    if (activeListId === DEFAULT_WATCHLIST_LIST_ID) return;
    if (!window.confirm('Delete this watchlist and all symbols in it?')) return;
    await deleteWatchlistList(activeListId);
    replaceWatchlistUrl(DEFAULT_WATCHLIST_LIST_ID, '');
  }, [activeListId, deleteWatchlistList, replaceWatchlistUrl]);

  const eq = searchQuery.data?.equities ?? [];
  const idx = searchQuery.data?.indices ?? [];
  const hasSearchResults = eq.length > 0 || idx.length > 0;

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-white">Watchlist</h1>
          <p className="mt-1 text-sm text-gray-500">
            Named lists, NSE equity search, and index search. Adding an index loads the index plus all constituents so
            you can review each name and chart. Bookmarks from the Scanner go to your Main list.
          </p>
        </div>
        <div className="flex shrink-0 items-start">
          <button
            type="button"
            onClick={() => setAiSheetOpen(true)}
            disabled={!selectedAiStock}
            aria-label={
              selectedAiStock
                ? `AI overview for ${selectedAiStock.ticker}`
                : 'AI overview (select an equity stock first)'
            }
            className="inline-flex items-center gap-2 rounded-xl border border-purple-400/30 bg-purple-500/10 px-3 py-2 text-xs font-semibold text-purple-100 hover:bg-purple-500/20 disabled:opacity-50"
          >
            <Sparkles className="h-3.5 w-3.5" aria-hidden />
            AI
          </button>
        </div>
      </div>

      <StockAiOverviewSheet
        open={aiSheetOpen}
        onOpenChange={setAiSheetOpen}
        ticker={selectedAiStock?.ticker ?? ''}
        companyName={selectedAiStock?.companyName ?? ''}
      />

      <div className="flex h-[min(max(480px,calc(100dvh-14rem)),880px)] flex-col overflow-hidden rounded-3xl border border-white/10 bg-[#161618] lg:flex-row">
        <aside className="flex max-h-[40%] min-h-0 w-full shrink-0 flex-col overflow-hidden border-b border-white/10 lg:h-full lg:max-h-none lg:w-[min(100%,360px)] lg:border-b-0 lg:border-r">
          <div className="shrink-0 space-y-2 border-b border-white/5 px-3 py-3">
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={activeListId}
                onChange={(e) => onChangeActiveList(e.target.value)}
                className="min-w-0 flex-1 rounded-lg border border-white/10 bg-[#0a0a0b] px-2 py-1.5 text-xs font-semibold text-white focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                aria-label="Active watchlist"
              >
                {watchlistLists.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </select>
              <button
                type="button"
                title="New watchlist"
                onClick={() => void onCreateList()}
                className="shrink-0 rounded-lg border border-white/10 p-1.5 text-gray-400 hover:bg-white/5 hover:text-emerald-300"
              >
                <ListPlus className="h-4 w-4" aria-hidden />
              </button>
              <button
                type="button"
                title="Rename watchlist"
                onClick={() => void onRenameList()}
                className="shrink-0 rounded-lg border border-white/10 p-1.5 text-gray-400 hover:bg-white/5 hover:text-blue-300"
              >
                <Pencil className="h-4 w-4" aria-hidden />
              </button>
              {activeListId !== DEFAULT_WATCHLIST_LIST_ID ? (
                <button
                  type="button"
                  title="Delete watchlist"
                  onClick={() => void onDeleteList()}
                  className="shrink-0 rounded-lg border border-white/10 p-1.5 text-gray-400 hover:bg-white/5 hover:text-red-300"
                >
                  <Trash2 className="h-4 w-4" aria-hidden />
                </button>
              ) : null}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-[10px] font-bold uppercase tracking-widest text-gray-500">
                Symbols ({filteredSortedWatchlist.length})
              </span>
              {itemsForList.length > 0 ? (
                <div className="flex flex-wrap items-center gap-1">
                  <span className="text-[9px] uppercase tracking-wide text-gray-600">Sort</span>
                  {(
                    [
                      { id: 'added' as const, label: 'Added' },
                      { id: 'pct_desc' as const, label: '% ▼' },
                      { id: 'pct_asc' as const, label: '% ▲' },
                    ] as const
                  ).map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setSortMode(opt.id)}
                      title={
                        opt.id === 'added'
                          ? 'Newest additions first'
                          : opt.id === 'pct_desc'
                            ? 'Biggest gainers first'
                            : 'Biggest losers first'
                      }
                      className={`rounded-md px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide transition-colors ${
                        sortMode === opt.id
                          ? 'bg-blue-500/25 text-blue-200'
                          : 'text-gray-500 hover:bg-white/5 hover:text-gray-300'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
            <div className="flex flex-wrap items-center gap-1">
              <span className="mr-1 text-[9px] font-bold uppercase tracking-wide text-gray-600">Tags</span>
              {staticTags.map((tag) => {
                const active = activeTagFilters.includes(tag.id);
                return (
                  <button
                    key={`watchlist-tag-filter-${tag.id}`}
                    type="button"
                    onClick={() => toggleTagFilter(tag.id)}
                    className={`rounded-md border px-2 py-0.5 text-[10px] font-bold ${active ? stockTagBadgeClass(tag.id) : 'border-white/10 bg-white/5 text-gray-400 hover:border-white/20 hover:text-gray-200'}`}
                  >
                    {compactStockTagLabel(tag.label)}
                  </button>
                );
              })}
            </div>
            <RelativeTurnoverFilterControl
              label="Min 30D Turnover/MCap"
              value={minRelativeTurnoverPct}
              onChange={setMinRelativeTurnoverPct}
            />
            <RelativeTurnoverFilterControl
              label="Min Vol Surge"
              value={minTurnoverSurgePct}
              onChange={setMinTurnoverSurgePct}
              max={500}
              step={1}
            />
            <div className="relative z-20">
              <Search
                className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-500"
                aria-hidden
              />
              <input
                type="text"
                autoComplete="off"
                spellCheck={false}
                value={searchDraft}
                onChange={(e) => {
                  setSearchDraft(e.target.value);
                  setSearchOpen(true);
                }}
                onFocus={() => setSearchOpen(true)}
                onBlur={() => {
                  window.setTimeout(() => setSearchOpen(false), 150);
                }}
                placeholder="Search stocks & indices (e.g. TCS, NIFTY)"
                className="w-full rounded-xl border border-white/10 bg-[#0a0a0b] py-2 pl-8 pr-8 text-xs font-medium text-white placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
              />
              {searchQuery.isFetching ? (
                <Loader2
                  className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 animate-spin text-blue-400"
                  aria-hidden
                />
              ) : null}
              {searchOpen && debouncedQ.length >= 2 ? (
                <div className="absolute left-0 right-0 top-full z-30 mt-1 max-h-56 overflow-auto rounded-xl border border-white/10 bg-[#0f0f11] py-1 shadow-xl">
                  {searchQuery.isError ? (
                    <div className="px-3 py-2 text-xs text-amber-400/90">
                      {searchQuery.error instanceof Error ? searchQuery.error.message : 'Search failed'}
                    </div>
                  ) : null}
                  {searchQuery.isFetching && !hasSearchResults && !searchQuery.isError ? (
                    <div className="px-3 py-2 text-xs text-gray-500">Searching…</div>
                  ) : null}
                  {!searchQuery.isFetching && !searchQuery.isError && !hasSearchResults ? (
                    <div className="px-3 py-2 text-xs text-gray-500">No matches</div>
                  ) : null}
                  {idx.length > 0 ? (
                    <div className="px-2 py-1 text-[9px] font-bold uppercase tracking-widest text-violet-400/90">
                      Indices
                    </div>
                  ) : null}
                  {idx.map((hit) => {
                    const already = indexAlreadyInList(hit.indexName);
                    return (
                      <div
                        key={hit.indexName}
                        className="flex items-start gap-1 border-b border-white/5 px-2 py-2 last:border-0 hover:bg-white/5"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="font-mono text-xs font-bold text-violet-300">{hit.indexName}</div>
                          <div className="mt-0.5 text-[10px] uppercase tracking-wide text-gray-600">
                            Adds index + all members
                          </div>
                        </div>
                        <button
                          type="button"
                          disabled={already}
                          title={already ? 'Already in list' : 'Add index and constituents'}
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => void handleAddIndexHit(hit)}
                          className="shrink-0 rounded-lg border border-white/10 p-1.5 text-gray-400 transition-colors hover:border-emerald-400/40 hover:bg-emerald-500/10 hover:text-emerald-300 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          <Plus className="h-3.5 w-3.5" aria-hidden />
                        </button>
                      </div>
                    );
                  })}
                  {eq.length > 0 ? (
                    <div className="px-2 py-1 text-[9px] font-bold uppercase tracking-widest text-gray-500">
                      Equities
                    </div>
                  ) : null}
                  {eq.map((hit) => {
                    const already = equityAlreadyInList(hit.symbol);
                    return (
                      <div
                        key={`${hit.symbol}-${hit.series}`}
                        className="flex items-start gap-1 border-b border-white/5 px-2 py-2 last:border-0 hover:bg-white/5"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="font-mono text-xs font-bold text-blue-300">{hit.symbol}</div>
                          <div className="mt-0.5 line-clamp-2 text-[11px] text-gray-400">{hit.companyName}</div>
                          <div className="mt-0.5 text-[10px] uppercase tracking-wide text-gray-600">
                            {hit.series} · {hit.segment}
                          </div>
                        </div>
                        <button
                          type="button"
                          disabled={already}
                          title={already ? 'Already in list' : 'Add to watchlist'}
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => void handleAddEquityHit(hit)}
                          className="shrink-0 rounded-lg border border-white/10 p-1.5 text-gray-400 transition-colors hover:border-emerald-400/40 hover:bg-emerald-500/10 hover:text-emerald-300 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          <Plus className="h-3.5 w-3.5" aria-hidden />
                        </button>
                      </div>
                    );
                  })}
                </div>
              ) : null}
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-2">
            {filteredSortedWatchlist.length === 0 ? (
              <div className="px-3 py-8 text-center text-sm text-gray-500">
                {itemsForList.length === 0
                  ? 'No symbols in this list yet. Search above or bookmark from the Scanner.'
                  : 'No symbols match the selected tag filter.'}
              </div>
            ) : (
              <ul className="space-y-1">
                {filteredSortedWatchlist.map((item) => {
                  const isSelected = item.id === selectedItemId;
                  const symU = item.symbol.trim().toUpperCase();
                  const quantamentalTickerKey = quantamentalScoreTickerKey(item.symbol);
                  const readyForInteraction = item.kind === 'index' ? true : hasReadyMetrics(symU);
                  const qi = symToQuoteIdx.get(symU);
                  const q = qi != null ? quoteQueries[qi] : undefined;
                  const pc = item.kind === 'equity' ? pChangeBySymbol.get(symU) : undefined;
                  const pctBusy = item.kind === 'equity' && q?.isFetching && pc == null;
                  const pctLabel =
                    item.kind === 'index'
                      ? 'IDX'
                      : pc == null
                        ? pctBusy
                          ? '…'
                          : '—'
                        : `${pc >= 0 ? '+' : ''}${pc.toFixed(2)}%`;
                  const pctClass =
                    item.kind === 'index'
                      ? 'text-violet-300'
                      : pc == null
                        ? 'text-gray-600'
                        : pc > 0
                          ? 'text-emerald-400'
                          : pc < 0
                            ? 'text-rose-400'
                            : 'text-gray-400';
                  return (
                    <li key={item.id}>
                      <div
                        className={`flex items-start gap-2 rounded-2xl border px-3 py-3 transition-colors ${
                          readyForInteraction
                            ? isSelected
                            ? 'border-blue-500/40 bg-blue-500/10 text-white'
                            : 'border-transparent bg-transparent text-gray-300 hover:border-white/10 hover:bg-white/5'
                            : 'border-transparent bg-transparent text-gray-400 opacity-55'
                        }`}
                      >
                        <button
                          type="button"
                          disabled={!readyForInteraction}
                          onClick={() => onPickWatchlistRow(item.id)}
                          className="min-w-0 flex-1 text-left disabled:cursor-not-allowed"
                        >
                          <div className="flex items-baseline justify-between gap-2">
                            <div className="flex min-w-0 items-center gap-1.5">
                              <span className="font-bold tracking-tight">{item.symbol}</span>
                              {item.kind === 'equity' && aiScoreByTicker.has(quantamentalTickerKey) ? (
                                <span className="rounded-md border border-purple-400/30 bg-purple-500/15 px-1.5 py-0.5 text-[10px] font-bold text-purple-200">
                                  AI {aiScoreByTicker.get(quantamentalTickerKey)?.quantamentalScore}%
                                </span>
                              ) : null}
                              {item.kind === 'equity' && (stockTagsByTicker.get(symU)?.length ?? 0) > 0 ? (
                                <div className="flex items-center gap-1">
                                  {(stockTagsByTicker.get(symU) ?? []).slice(0, 2).map((tagId) => (
                                    <span
                                      key={`${item.id}-${tagId}`}
                                      className={`rounded-md border px-1.5 py-0.5 text-[10px] font-bold ${stockTagBadgeClass(tagId)}`}
                                    >
                                      {compactStockTagLabel(staticTagLabelById.get(tagId) ?? tagId)}
                                    </span>
                                  ))}
                                  {(stockTagsByTicker.get(symU)?.length ?? 0) > 2 ? (
                                    <span className="rounded-md border border-white/10 bg-white/5 px-1.5 py-0.5 text-[10px] font-bold text-gray-300">
                                      +{(stockTagsByTicker.get(symU)?.length ?? 0) - 2}
                                    </span>
                                  ) : null}
                                </div>
                              ) : null}
                            </div>
                            <span
                              className={`shrink-0 font-mono text-[11px] font-semibold tabular-nums ${pctClass}`}
                              title={
                                item.kind === 'index'
                                  ? 'Index row (chart uses NSE index series)'
                                  : 'Today vs previous close (NSE)'
                              }
                            >
                              {pctLabel}
                            </span>
                          </div>
                          <div className="mt-0.5 truncate text-[11px] text-gray-500">{item.companyName}</div>
                          {item.kind === 'equity' ? (
                            <div className="mt-1 flex items-center gap-2">
                              <span className="text-[10px] font-semibold text-cyan-300">
                                30D Turnover/MCap:{' '}
                                {relativeTurnoverBySymbol
                                  .get(symU)
                                  ?.relativeTurnoverPct.toFixed(2)
                                  .concat('%') ?? '—'}
                              </span>
                              <TurnoverAccelerationBadge
                                value={turnoverAccelerationBySymbol.get(symU)?.turnoverAccelerationPct}
                              />
                            </div>
                          ) : null}
                          <div className="mt-1 font-mono text-[10px] text-gray-600">
                            {item.kind === 'index' ? 'INDEX' : toTradingViewSymbol(item.symbol)}
                          </div>
                        </button>
                        <button
                          type="button"
                          disabled={!readyForInteraction}
                          onClick={() => {
                            void removeFromWatchlist(item.id);
                          }}
                          aria-label={`Remove ${item.symbol} from watchlist`}
                          className="shrink-0 rounded-lg border border-white/10 p-1 text-gray-500 transition-colors hover:border-red-400/30 hover:bg-red-500/10 hover:text-red-300 disabled:cursor-not-allowed disabled:opacity-40"
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
          {selectedItemId && selectedWatchlistItem ? (
            <div className="flex min-h-0 flex-1 flex-col">
              <div className="mb-2 flex shrink-0 flex-wrap items-center gap-2 text-xs text-gray-500">
                <LineChart className="h-4 w-4 text-blue-400" aria-hidden />
                <BookmarkCheck className="h-4 w-4 text-amber-300" aria-hidden />
                <span className="font-mono text-[11px] text-gray-400">
                  {selectedWatchlistItem.symbol}
                  {selectedWatchlistItem.kind === 'index' ? ' · index' : ''}
                </span>
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
              {selectedWatchlistItem.kind === 'equity' ? (
                <TechnicalChartScoreControl
                  ticker={selectedWatchlistItem.symbol}
                  staticTags={staticTags}
                  selectedTagIds={stockTagsByTicker.get(selectedTechnicalScoreTicker) ?? []}
                  canEdit={canEditStockTags}
                  isLoading={isLoadingStaticTags || isLoadingStockTags || isFetchingStockTags}
                  isSaving={isSavingTags}
                  onSaveTag={async (tagId) => {
                    await saveTags({ ticker: selectedWatchlistItem.symbol, tagId });
                  }}
                />
              ) : null}
              <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
                {chartMode === 'kline' ? (
                  <NseEquityCandleChartWidget
                    key={selectedWatchlistItem.id}
                    symbol={selectedWatchlistItem.symbol}
                    seriesKind={selectedWatchlistItem.kind === 'index' ? 'index' : 'equity'}
                    className="absolute inset-0 flex h-full min-h-0 w-full flex-col"
                  />
                ) : (
                  <TradingViewAdvancedChartWidget
                    key={`${selectedWatchlistItem.id}-${tradingViewSymbol}`}
                    symbol={tradingViewSymbol}
                    className="absolute inset-0 flex h-full min-h-0 w-full flex-col"
                  />
                )}
              </div>
            </div>
          ) : (
            <div className="flex flex-1 items-center justify-center text-sm text-gray-500">
              Select a symbol to load a chart.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
