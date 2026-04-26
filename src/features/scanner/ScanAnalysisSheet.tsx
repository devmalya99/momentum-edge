'use client';

import { useCallback, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  AlertTriangle,
  Bot,
  ChevronDown,
  ChevronUp,
  Loader2,
  Newspaper,
  RefreshCcw,
  Search,
  Sparkles,
} from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  analyseScanApiResponseSchema,
  type AnalyseScanApiResponse,
  type AnalysedScanItem,
  stockNewsApiResponseSchema,
  stockTriggerApiResponseSchema,
  type StockNewsItem,
} from '@/lib/ai/analyse-scan';

type ScanAnalysisStock = {
  symbol: string;
  name: string;
};

type ScanAnalysisSheetProps = {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  scannerName: string;
  stocks: ScanAnalysisStock[];
};

type IndustryGroup = {
  key: string;
  sector: string;
  industry: string;
  items: AnalysedScanItem[];
};

async function fetchScanAnalysis(
  scannerName: string,
  stocks: ScanAnalysisStock[],
): Promise<AnalyseScanApiResponse> {
  const res = await fetch('/api/ai/analyse-scan', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Requested-With': 'XMLHttpRequest',
    },
    body: JSON.stringify({ scannerName, stocks }),
  });
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown> & {
    error?: string;
  };
  if (!res.ok) throw new Error(json.error || 'Failed to analyse scan.');
  return analyseScanApiResponseSchema.parse(json);
}

function SkeletonAnalysis() {
  return (
    <div className="space-y-3">
      {[0, 1, 2].map((idx) => (
        <div key={idx} className="rounded-2xl border border-white/10 bg-[#11141b] p-4">
          <div className="h-4 w-36 animate-pulse rounded bg-white/10" />
          <div className="mt-3 grid grid-cols-3 gap-2">
            <div className="h-7 animate-pulse rounded-lg bg-white/8" />
            <div className="h-7 animate-pulse rounded-lg bg-white/8" />
            <div className="h-7 animate-pulse rounded-lg bg-white/8" />
          </div>
          <div className="mt-4 space-y-2">
            <div className="h-12 animate-pulse rounded-xl bg-white/6" />
            <div className="h-12 animate-pulse rounded-xl bg-white/6" />
          </div>
        </div>
      ))}
    </div>
  );
}

function groupByIndustry(items: AnalysedScanItem[]): IndustryGroup[] {
  const groups = new Map<string, IndustryGroup>();
  for (const item of items) {
    const key = item.industry.trim() || item.sector.trim() || 'Other';
    const existing = groups.get(key);
    if (existing) {
      existing.items.push(item);
    } else {
      groups.set(key, {
        key,
        sector: item.sector,
        industry: key,
        items: [item],
      });
    }
  }
  return [...groups.values()].sort((a, b) => b.items.length - a.items.length || a.key.localeCompare(b.key));
}

async function fetchStockNews(symbol: string): Promise<StockNewsItem[]> {
  const qs = new URLSearchParams({ symbol });
  const res = await fetch(`/api/news?${qs.toString()}`, { cache: 'no-store' });
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown> & { error?: string };
  if (!res.ok) throw new Error(json.error || 'Failed to load news.');
  return stockNewsApiResponseSchema.parse(json).items;
}

async function fetchStockTrigger(
  symbol: string,
  name: string,
  segment: string,
): Promise<string[]> {
  const res = await fetch('/api/ai/stock-trigger', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Requested-With': 'XMLHttpRequest',
    },
    body: JSON.stringify({ symbol, name, segment }),
  });
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown> & { error?: string };
  if (!res.ok) throw new Error(json.error || 'Failed to run catalyst check.');
  return stockTriggerApiResponseSchema.parse(json).bullets;
}

export default function ScanAnalysisSheet({
  open,
  onOpenChange,
  scannerName,
  stocks,
}: ScanAnalysisSheetProps) {
  const requestStocks = useMemo(
    () =>
      stocks
        .filter((stock) => stock.symbol.trim() && stock.name.trim())
        .slice(0, 150),
    [stocks],
  );
  const symbolsKey = useMemo(
    () => requestStocks.map((stock) => stock.symbol.trim().toUpperCase()).join('|'),
    [requestStocks],
  );
  const q = useQuery({
    queryKey: ['ai', 'analyse-scan', scannerName, symbolsKey],
    queryFn: () => fetchScanAnalysis(scannerName, requestStocks),
    enabled: open && requestStocks.length > 0,
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
    retry: false,
  });
  const groups = useMemo(() => groupByIndustry(q.data?.items ?? []), [q.data?.items]);
  const [searchText, setSearchText] = useState('');
  const [expandedNewsSymbols, setExpandedNewsSymbols] = useState<Record<string, boolean>>({});
  const [expandedTriggerSymbols, setExpandedTriggerSymbols] = useState<Record<string, boolean>>({});
  const [newsLoadingBySymbol, setNewsLoadingBySymbol] = useState<Record<string, boolean>>({});
  const [triggerLoadingBySymbol, setTriggerLoadingBySymbol] = useState<Record<string, boolean>>({});
  const [newsBySymbol, setNewsBySymbol] = useState<Record<string, StockNewsItem[]>>({});
  const [triggerBySymbol, setTriggerBySymbol] = useState<Record<string, string[]>>({});
  const [newsErrorBySymbol, setNewsErrorBySymbol] = useState<Record<string, string>>({});
  const [triggerErrorBySymbol, setTriggerErrorBySymbol] = useState<Record<string, string>>({});
  const normalizedSearch = searchText.trim().toUpperCase();
  const filteredGroups = useMemo(() => {
    if (!normalizedSearch) return groups;
    return groups
      .map((group) => ({
        ...group,
        items: group.items.filter((item) => {
          const haystack = [
            item.symbol,
            item.name,
            item.segment,
            item.industry,
            item.sector,
          ]
            .join(' ')
            .toUpperCase();
          return haystack.includes(normalizedSearch);
        }),
      }))
      .filter((group) => group.items.length > 0);
  }, [groups, normalizedSearch]);

  const onToggleNews = useCallback(async (item: AnalysedScanItem) => {
    const symbol = item.symbol.trim().toUpperCase();
    const nextExpanded = !expandedNewsSymbols[symbol];
    setExpandedNewsSymbols((prev) => ({ ...prev, [symbol]: nextExpanded }));
    if (!nextExpanded || newsBySymbol[symbol] || newsLoadingBySymbol[symbol]) return;
    setNewsLoadingBySymbol((prev) => ({ ...prev, [symbol]: true }));
    setNewsErrorBySymbol((prev) => ({ ...prev, [symbol]: '' }));
    try {
      const items = await fetchStockNews(symbol);
      setNewsBySymbol((prev) => ({ ...prev, [symbol]: items }));
    } catch (e) {
      setNewsErrorBySymbol((prev) => ({
        ...prev,
        [symbol]: e instanceof Error ? e.message : 'Failed to load news.',
      }));
    } finally {
      setNewsLoadingBySymbol((prev) => ({ ...prev, [symbol]: false }));
    }
  }, [expandedNewsSymbols, newsBySymbol, newsLoadingBySymbol]);

  const onToggleTrigger = useCallback(async (item: AnalysedScanItem) => {
    const symbol = item.symbol.trim().toUpperCase();
    const nextExpanded = !expandedTriggerSymbols[symbol];
    setExpandedTriggerSymbols((prev) => ({ ...prev, [symbol]: nextExpanded }));
    if (!nextExpanded || triggerBySymbol[symbol] || triggerLoadingBySymbol[symbol]) return;
    setTriggerLoadingBySymbol((prev) => ({ ...prev, [symbol]: true }));
    setTriggerErrorBySymbol((prev) => ({ ...prev, [symbol]: '' }));
    try {
      const bullets = await fetchStockTrigger(symbol, item.name, item.segment);
      setTriggerBySymbol((prev) => ({ ...prev, [symbol]: bullets }));
    } catch (e) {
      setTriggerErrorBySymbol((prev) => ({
        ...prev,
        [symbol]: e instanceof Error ? e.message : 'Failed to run catalyst check.',
      }));
    } finally {
      setTriggerLoadingBySymbol((prev) => ({ ...prev, [symbol]: false }));
    }
  }, [expandedTriggerSymbols, triggerBySymbol, triggerLoadingBySymbol]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full border-white/10 bg-[#0e1014] text-gray-100 sm:max-w-xl lg:max-w-2xl"
      >
        <SheetHeader className="border-b border-white/10 bg-[#12151b] pb-3">
          <div className="flex items-center gap-2 text-cyan-300">
            <Sparkles className="h-4 w-4" aria-hidden />
            <span className="text-[10px] font-bold uppercase tracking-widest">
              Thematic momentum
            </span>
          </div>
          <SheetTitle className="text-white">Where is smart money hiding?</SheetTitle>
          <SheetDescription className="text-gray-400">
            {scannerName} scan, {requestStocks.length} visible stocks analysed by micro-theme.
          </SheetDescription>
        </SheetHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4 pt-4">
          <div className="mb-3">
            <label className="relative block">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-500" aria-hidden />
              <input
                type="text"
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                placeholder="Search symbol, company, segment..."
                className="w-full rounded-lg border border-white/10 bg-[#12151b] py-2 pl-8 pr-3 text-[12px] text-gray-100 outline-none placeholder:text-gray-500 focus:border-cyan-400/35"
              />
            </label>
          </div>
          {requestStocks.length === 0 ? (
            <p className="rounded-xl border border-white/10 bg-white/5 p-3 text-sm text-gray-400">
              No stocks are visible in this scan yet.
            </p>
          ) : q.isPending ? (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm text-gray-400">
                <Loader2 className="h-4 w-4 animate-spin text-cyan-300" aria-hidden />
                Finding hidden sector rotation…
              </div>
              <SkeletonAnalysis />
            </div>
          ) : q.isError ? (
            <div className="flex items-start gap-2 rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 text-sm text-gray-300">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" aria-hidden />
              <div className="space-y-2">
                <p>{q.error instanceof Error ? q.error.message : 'Failed to analyse scan.'}</p>
                <button
                  type="button"
                  onClick={() => void q.refetch()}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-300 hover:underline"
                >
                  <RefreshCcw className="h-3 w-3" aria-hidden /> Try again
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="rounded-xl border border-cyan-400/20 bg-cyan-500/8 p-3">
                <p className="text-[11px] font-bold uppercase tracking-wide text-cyan-200">
                  Dominant industries
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {filteredGroups.slice(0, 6).map((group) => (
                    <span
                      key={`summary-${group.key}`}
                      className="rounded-lg border border-white/10 bg-black/25 px-2.5 py-1 text-[11px] font-semibold text-gray-200"
                    >
                      {group.industry} <span className="text-cyan-300">{group.items.length}</span>
                    </span>
                  ))}
                </div>
              </div>

              {filteredGroups.length === 0 ? (
                <p className="rounded-xl border border-white/10 bg-white/5 p-3 text-sm text-gray-400">
                  No stocks matched your search.
                </p>
              ) : null}

              {filteredGroups.map((group) => (
                <section key={group.key} className="rounded-2xl border border-white/10 bg-[#11141b] p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-bold text-white">{group.industry}</h3>
                      <p className="mt-1 text-[11px] text-gray-500">
                        {group.sector}
                      </p>
                    </div>
                    <span className="rounded-lg border border-cyan-400/25 bg-cyan-500/12 px-2 py-1 text-[11px] font-bold text-cyan-200">
                      {group.items.length}
                    </span>
                  </div>

                  <ul className="mt-3 space-y-2">
                    {group.items.map((item) => {
                      const symbolKey = item.symbol.trim().toUpperCase();
                      return (
                      <li key={`${group.key}-${item.symbol}`} className="rounded-xl border border-white/8 bg-[#0d1016] p-2.5">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-[12px] font-bold text-gray-100">{item.symbol}</p>
                            <p className="mt-0.5 truncate text-[11px] text-gray-500">{item.name}</p>
                          </div>
                          <span className="shrink-0 rounded-md border border-violet-400/25 bg-violet-500/12 px-2 py-0.5 text-[10px] font-semibold text-violet-200">
                            {item.segment}
                          </span>
                        </div>
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={() => void onToggleNews(item)}
                            className="inline-flex items-center gap-1 rounded-md border border-white/10 bg-white/5 px-2 py-1 text-[10px] font-semibold text-gray-200 hover:bg-white/10"
                          >
                            <Newspaper className="h-3 w-3" aria-hidden />
                            Latest News
                            {expandedNewsSymbols[symbolKey] ? (
                              <ChevronUp className="h-3 w-3" aria-hidden />
                            ) : (
                              <ChevronDown className="h-3 w-3" aria-hidden />
                            )}
                          </button>
                          <button
                            type="button"
                            onClick={() => void onToggleTrigger(item)}
                            className="inline-flex items-center gap-1 rounded-md border border-cyan-400/25 bg-cyan-500/12 px-2 py-1 text-[10px] font-semibold text-cyan-100 hover:bg-cyan-500/20"
                          >
                            <Bot className="h-3 w-3" aria-hidden />
                            AI Catalyst Check
                            {expandedTriggerSymbols[symbolKey] ? (
                              <ChevronUp className="h-3 w-3" aria-hidden />
                            ) : (
                              <ChevronDown className="h-3 w-3" aria-hidden />
                            )}
                          </button>
                        </div>

                        {expandedNewsSymbols[symbolKey] ? (
                          <div className="mt-2 rounded-lg border border-white/10 bg-[#10141c] p-2.5">
                            {newsLoadingBySymbol[symbolKey] ? (
                              <div className="flex items-center gap-1.5 text-[11px] text-gray-400">
                                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                                Loading latest news...
                              </div>
                            ) : newsErrorBySymbol[symbolKey] ? (
                              <p className="text-[11px] text-amber-300">{newsErrorBySymbol[symbolKey]}</p>
                            ) : (newsBySymbol[symbolKey] ?? []).length === 0 ? (
                              <p className="text-[11px] text-gray-500">No recent news found.</p>
                            ) : (
                              <ul className="space-y-1.5">
                                {(newsBySymbol[symbolKey] ?? []).map((news) => (
                                  <li key={news.id}>
                                    <a
                                      href={news.link}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="text-[11px] text-blue-300 hover:underline"
                                    >
                                      {news.title}
                                    </a>
                                  </li>
                                ))}
                              </ul>
                            )}
                          </div>
                        ) : null}

                        {expandedTriggerSymbols[symbolKey] ? (
                          <div className="mt-2 rounded-lg border border-cyan-400/25 bg-cyan-500/10 p-2.5">
                            {triggerLoadingBySymbol[symbolKey] ? (
                              <div className="flex items-center gap-1.5 text-[11px] text-cyan-100">
                                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                                Running catalyst check...
                              </div>
                            ) : triggerErrorBySymbol[symbolKey] ? (
                              <p className="text-[11px] text-amber-200">{triggerErrorBySymbol[symbolKey]}</p>
                            ) : (
                              <ul className="list-disc space-y-1 pl-4 text-[11px] text-cyan-100">
                                {(triggerBySymbol[symbolKey] ?? []).map((bullet) => (
                                  <li key={`${item.symbol}-${bullet}`}>{bullet}</li>
                                ))}
                              </ul>
                            )}
                          </div>
                        ) : null}
                      </li>
                      );
                    })}
                  </ul>
                </section>
              ))}

              <p className="border-t border-white/10 pt-3 text-[11px] text-gray-500">
                Generated {q.data ? new Date(q.data.meta.generatedAt).toLocaleString('en-IN') : ''}. AI classifications may be wrong; use this as a discovery aid, not advice.
              </p>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
