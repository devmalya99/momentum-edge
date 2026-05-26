'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { BookmarkCheck, LineChart, Loader2, Newspaper, Plus, Search, Trash2, ListPlus, Pencil, Sparkles } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import NseEquityCandleChartWidget from '@/components/NseEquityCandleChartWidget';
import TradingViewAdvancedChartWidget from '@/components/TradingViewAdvancedChartWidget';
import TechnicalChartScoreControl, {
  compactStockTagLabel,
  stockTagBadgeClass,
} from '@/components/TechnicalChartScoreControl';
import { useBusinessEvaluationSummariesQuery } from '@/features/ai/useBusinessEvaluationSummariesQuery';
import { useStockTagsQuery } from '@/features/stock-tags/useStockTagsQuery';
import StockQuickAiCheckSheet from '@/features/scanner/StockQuickAiCheckSheet';
import StockNewsSheet from '@/features/news/StockNewsSheet';
import { toTradingViewSymbol, watchlistSymbolToTradingView } from '@/lib/tradingview-symbol';
import { useTradeStore } from '@/store/useTradeStore';
import type { NseEquitySearchHit } from '@/app/api/nse/equity-search/route';
import type { NseIndexSearchHit } from '@/app/api/nse/market-search/route';
import { DEFAULT_WATCHLIST_LIST_ID } from '@/lib/watchlist-defaults';
import { useAuthStore } from '@/store/useAuthStore';
import { useMembership } from '@/hooks/useMembership';
import { usePremiumAiGate } from '@/hooks/usePremiumAiGate';
import { BASIC_WATCHLIST_LIMIT } from '@/lib/membership/constants';
import { useMembershipUpgradeStore } from '@/store/useMembershipUpgradeStore';
import {
  normalizeBusinessTicker,
  quickAiCheckCategoryBadgeLabel,
} from '@/lib/ai/quick-ai-check';

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
  const { isPremium } = useMembership();
  const { requirePremiumForAi, guardAiSheetOpen } = usePremiumAiGate();
  const openMembershipUpgrade = useMembershipUpgradeStore((s) => s.openMembershipUpgrade);
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
  const [businessEvaluationOpen, setBusinessEvaluationOpen] = useState(false);
  const [newsSheetOpen, setNewsSheetOpen] = useState(false);
  const [activeTagFilters, setActiveTagFilters] = useState<string[]>([]);

  const {
    staticTags,
    stockTagsByTicker,
    isLoadingStaticTags,
    isLoadingStockTags,
    isFetchingStockTags,
    saveTags,
    isSavingTags,
  } = useStockTagsQuery([]);
  const staticTagLabelById = useMemo(() => {
    const map = new Map<string, string>();
    for (const tag of staticTags) map.set(tag.id, tag.label);
    return map;
  }, [staticTags]);
  const activeTagFilterSet = useMemo(() => new Set(activeTagFilters), [activeTagFilters]);
  const toggleTagFilter = useCallback((tagId: string) => {
    setActiveTagFilters((prev) =>
      prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId],
    );
  }, []);
  const matchesActiveTagFilter = useCallback(
    (symbol: string, kind: 'equity' | 'index') => {
      if (kind !== 'equity') return true;
      if (activeTagFilterSet.size === 0) return true;
      const tagIds = stockTagsByTicker.get(symbol.trim().toUpperCase()) ?? [];
      if (tagIds.length === 0) return true;
      for (const tagId of tagIds) {
        if (activeTagFilterSet.has(tagId)) return true;
      }
      return false;
    },
    [activeTagFilterSet, stockTagsByTicker],
  );
  const tagFilteredItems = useMemo(
    () => itemsForList.filter((item) => matchesActiveTagFilter(item.symbol, item.kind)),
    [itemsForList, matchesActiveTagFilter],
  );

  const selectedItemId = useMemo(() => {
    if (tagFilteredItems.length === 0) return '';
    const byAdded = [...tagFilteredItems].sort((a, b) => b.addedAt - a.addedAt);
    if (queryItem && byAdded.some((w) => w.id === queryItem)) return queryItem;
    if (legacySymbol) {
      const byTv = byAdded.find((w) => w.id === legacySymbol);
      if (byTv) return byTv.id;
      const symMatch = byAdded.find(
        (w) => toTradingViewSymbol(w.symbol) === legacySymbol.trim(),
      );
      if (symMatch) return symMatch.id;
    }
    return byAdded[0].id;
  }, [tagFilteredItems, queryItem, legacySymbol]);

  const selectedWatchlistItem = useMemo(
    () => tagFilteredItems.find((w) => w.id === selectedItemId) ?? null,
    [tagFilteredItems, selectedItemId],
  );

  const selectedEquitySymbol = useMemo(
    () =>
      selectedWatchlistItem?.kind === 'equity'
        ? selectedWatchlistItem.symbol.trim().toUpperCase()
        : '',
    [selectedWatchlistItem],
  );

  const visibleEquityTickers = useMemo(
    () =>
      tagFilteredItems
        .filter((item) => item.kind === 'equity')
        .map((item) => item.symbol.trim().toUpperCase()),
    [tagFilteredItems],
  );

  const { summaryByTicker: evaluationSummaryByTicker } =
    useBusinessEvaluationSummariesQuery(visibleEquityTickers);

  const selectedPChange: number | undefined = undefined;

  const sortedWatchlist = useMemo(() => {
    const rows = [...tagFilteredItems];
    if (sortMode === 'added') return rows;
    rows.sort((a, b) => {
      const sa = a.symbol.trim().toUpperCase();
      const sb = b.symbol.trim().toUpperCase();
      const pa =
        a.kind === 'equity' && sa === selectedEquitySymbol ? selectedPChange : undefined;
      const pb =
        b.kind === 'equity' && sb === selectedEquitySymbol ? selectedPChange : undefined;
      if (pa == null && pb == null) return b.addedAt - a.addedAt;
      if (pa == null) return 1;
      if (pb == null) return -1;
      const cmp = sortMode === 'pct_desc' ? pb - pa : pa - pb;
      if (cmp !== 0) return cmp;
      return b.addedAt - a.addedAt;
    });
    return rows;
  }, [tagFilteredItems, sortMode, selectedEquitySymbol, selectedPChange]);

  const filteredSortedWatchlist = sortedWatchlist;
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

  const canAddWatchlistCount = useCallback(
    (count: number) => {
      if (isPremium) return true;
      return watchlist.length + count <= BASIC_WATCHLIST_LIMIT;
    },
    [isPremium, watchlist.length],
  );

  const handleAddEquityHit = useCallback(
    async (hit: NseEquitySearchHit) => {
      const sym = hit.symbol.trim().toUpperCase();
      if (equityAlreadyInList(sym)) return;
      if (!canAddWatchlistCount(1)) {
        openMembershipUpgrade('watchlist');
        return;
      }
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
    [addToWatchlist, activeListId, onPickWatchlistRow, equityAlreadyInList, canAddWatchlistCount, openMembershipUpgrade],
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

        if (!canAddWatchlistCount(batch.length)) {
          openMembershipUpgrade('watchlist');
          return;
        }

        await addManyToWatchlist(batch);
        const firstId = batch[0]?.id;
        if (firstId) onPickWatchlistRow(firstId);
        setSearchDraft('');
        setSearchOpen(false);
      } catch (e) {
        window.alert(e instanceof Error ? e.message : 'Failed to add index');
      }
    },
    [addManyToWatchlist, activeListId, onPickWatchlistRow, indexAlreadyInList, canAddWatchlistCount, openMembershipUpgrade],
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
        <div className="flex shrink-0 items-start gap-2">
          <button
            type="button"
            onClick={() => {
              if (!selectedAiStock) return;
              requirePremiumForAi(() => setBusinessEvaluationOpen(true));
            }}
            disabled={!selectedAiStock}
            aria-label={
              selectedAiStock
                ? `Business Evaluation for ${selectedAiStock.ticker}`
                : 'Business Evaluation (select an equity stock first)'
            }
            title={!isPremium ? 'Premium membership required for Business Evaluation' : undefined}
            className="inline-flex items-center gap-2 rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-3 py-2 text-xs font-semibold text-emerald-100 hover:bg-emerald-500/20 disabled:opacity-50"
          >
            <Sparkles className="h-3.5 w-3.5" aria-hidden />
            Business Evaluation
          </button>
          <button
            type="button"
            onClick={() => {
              if (!selectedAiStock) return;
              setNewsSheetOpen(true);
            }}
            disabled={!selectedAiStock}
            aria-label={
              selectedAiStock
                ? `News for ${selectedAiStock.ticker}`
                : 'News (select an equity stock first)'
            }
            className="inline-flex items-center gap-2 rounded-xl border border-sky-400/30 bg-sky-500/10 px-3 py-2 text-xs font-semibold text-sky-100 hover:bg-sky-500/20 disabled:opacity-50"
          >
            <Newspaper className="h-3.5 w-3.5" aria-hidden />
            News
          </button>
        </div>
      </div>

      <StockNewsSheet
        open={newsSheetOpen}
        onOpenChange={setNewsSheetOpen}
        ticker={selectedAiStock?.ticker ?? ''}
        companyName={selectedAiStock?.companyName ?? ''}
      />
      <StockQuickAiCheckSheet
        open={businessEvaluationOpen}
        onOpenChange={(open) => guardAiSheetOpen(open, setBusinessEvaluationOpen)}
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
                  ).map((opt) => {
                    const isPctSort = opt.id !== 'added';
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        disabled={isPctSort}
                        onClick={() => setSortMode(opt.id)}
                        title={
                          opt.id === 'added'
                            ? 'Newest additions first'
                            : 'Percent sort needs a quote per symbol; only the selected row loads live %'
                        }
                        className={`rounded-md px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                          sortMode === opt.id
                            ? 'bg-blue-500/25 text-blue-200'
                            : 'text-gray-500 hover:bg-white/5 hover:text-gray-300'
                        }`}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              ) : null}
            </div>
            <div className="flex flex-wrap items-center gap-1">
              <span className="mr-1 text-[9px] font-bold uppercase tracking-wide text-gray-600">Tags</span>
              {staticTags.map((tag) => {
                const active = activeTagFilterSet.has(tag.id);
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
                          className="shrink-0 rounded-lg border border-white/10 p-1.5 text-white/60 transition-colors hover:border-emerald-400/40 hover:bg-emerald-500/10 hover:text-emerald-200 disabled:cursor-not-allowed disabled:opacity-40"
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
                          className="shrink-0 rounded-lg border border-white/10 p-1.5 text-white/60 transition-colors hover:border-emerald-400/40 hover:bg-emerald-500/10 hover:text-emerald-200 disabled:cursor-not-allowed disabled:opacity-40"
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
                  const summaryKey = normalizeBusinessTicker(item.symbol);
                  const isSelectedEquity =
                    item.kind === 'equity' && isSelected && symU === selectedEquitySymbol;
                  void isSelectedEquity;
                  void selectedPChange;
                  const pctLabel = item.kind === 'index' ? 'IDX' : '—';
                  const pctClass =
                    item.kind === 'index'
                      ? 'text-violet-300'
                      : 'text-gray-600';
                  return (
                    <li key={item.id}>
                      <div
                        className={`flex items-start gap-2 rounded-2xl border px-3 py-3 transition-colors ${
                          isSelected
                            ? 'border-blue-500/40 bg-blue-500/10 text-white'
                            : 'border-transparent bg-transparent text-gray-300 hover:border-white/10 hover:bg-white/5'
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => onPickWatchlistRow(item.id)}
                          className="min-w-0 flex-1 text-left disabled:cursor-not-allowed"
                        >
                          <div className="flex items-baseline justify-between gap-2">
                            <div className="flex min-w-0 items-center gap-1.5">
                              <span className="font-bold tracking-tight">{item.symbol}</span>
                              {item.kind === 'equity' && evaluationSummaryByTicker.has(summaryKey) ? (
                                <span
                                  className="rounded-md border border-purple-400/30 bg-purple-500/15 px-1.5 py-0.5 text-[10px] font-bold text-purple-200"
                                  title={evaluationSummaryByTicker
                                    .get(summaryKey)
                                    ?.ratingReasons.join(' · ')}
                                >
                                  {quickAiCheckCategoryBadgeLabel(
                                    evaluationSummaryByTicker.get(summaryKey)!.category,
                                  )}
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
                                  : isSelected
                                    ? 'Today vs previous close (NSE)'
                                    : 'Select row to load live %'
                              }
                            >
                              {pctLabel}
                            </span>
                          </div>
                          <div className="mt-0.5 truncate text-[11px] text-gray-500">{item.companyName}</div>
                          <div className="mt-1 font-mono text-[10px] text-gray-600">
                            {item.kind === 'index' ? 'INDEX' : toTradingViewSymbol(item.symbol)}
                          </div>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            void removeFromWatchlist(item.id);
                          }}
                          aria-label={`Remove ${item.symbol} from watchlist`}
                          className="shrink-0 rounded-lg border border-white/10 p-1 text-white/60 transition-colors hover:border-red-400/30 hover:bg-red-500/10 hover:text-red-200 disabled:cursor-not-allowed disabled:opacity-40"
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
