'use client';

import { AlertTriangle, Loader2, Newspaper, RefreshCcw } from 'lucide-react';
import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { StockNewsSearchSections } from '@/components/ai/StockNewsSearchSections';
import { TradingViewNewsList } from '@/components/news/TradingViewNewsList';
import {
  useRefreshStockNewsSearch,
  useStockNewsSearchQuery,
} from '@/features/ai/useStockNewsSearchQuery';
import { useTradingViewSymbolNewsQuery } from '@/features/news/useTradingViewSymbolNewsQuery';
import { tradingViewNewsQueryKey } from '@/lib/news/tradingview-news-client';

type StockNewsSheetProps = {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  ticker: string;
  companyName: string;
};

export default function StockNewsSheet({
  open,
  onOpenChange,
  ticker,
  companyName,
}: StockNewsSheetProps) {
  const queryClient = useQueryClient();
  const normalizedTicker = ticker.trim().toUpperCase();
  const refreshStockNewsSearch = useRefreshStockNewsSearch();
  const [refreshing, setRefreshing] = useState(false);

  const enabled = open && normalizedTicker.length > 0;

  const tradingViewQuery = useTradingViewSymbolNewsQuery(normalizedTicker, { enabled });
  const aiNewsQuery = useStockNewsSearchQuery(normalizedTicker, { enabled });

  const onRefresh = async () => {
    if (!normalizedTicker) return;
    setRefreshing(true);
    try {
      await Promise.all([
        refreshStockNewsSearch(normalizedTicker),
        queryClient.invalidateQueries({
          queryKey: tradingViewNewsQueryKey(normalizedTicker),
        }),
        tradingViewQuery.refetch(),
      ]);
    } finally {
      setRefreshing(false);
    }
  };

  const isFetching =
    refreshing || tradingViewQuery.isFetching || aiNewsQuery.isFetching;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex w-full flex-col border-white/10 bg-[#0e1014] text-gray-100 sm:max-w-lg"
      >
        <SheetHeader className="shrink-0 border-b border-white/10 bg-[#12151b] pb-3">
          <div className="flex items-center gap-2 text-sky-300">
            <Newspaper className="h-4 w-4" aria-hidden />
            <span className="text-[10px] font-bold uppercase tracking-widest">News</span>
          </div>
          <SheetTitle className="text-left text-lg text-white">
            {normalizedTicker || '—'}
          </SheetTitle>
          <SheetDescription className="text-left text-gray-400">
            {companyName.trim() || 'NSE equity'} · TradingView headlines + AI research (12h cache)
          </SheetDescription>
          <button
            type="button"
            onClick={() => void onRefresh()}
            disabled={isFetching || !normalizedTicker}
            className="mt-2 inline-flex w-fit items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] font-medium text-gray-300 hover:bg-white/10 disabled:opacity-50"
          >
            {isFetching ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
            ) : (
              <RefreshCcw className="h-3.5 w-3.5" aria-hidden />
            )}
            Refresh all
          </button>
        </SheetHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-1 py-4">
          {!normalizedTicker ? (
            <p className="px-2 text-sm text-gray-500">Select a stock to load news.</p>
          ) : (
            <div className="space-y-6 px-2">
              <section>
                <h3 className="mb-3 text-[11px] font-bold uppercase tracking-widest text-gray-400">
                  TradingView headlines
                </h3>
                {tradingViewQuery.isLoading ? (
                  <div className="flex items-center gap-2 text-sm text-gray-400">
                    <Loader2 className="h-4 w-4 animate-spin text-cyan-400" aria-hidden />
                    Loading headlines…
                  </div>
                ) : null}
                {tradingViewQuery.isError ? (
                  <div className="flex items-start gap-2 rounded-lg border border-amber-500/25 bg-amber-500/10 p-3 text-sm text-amber-200">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                    <span>
                      {tradingViewQuery.error instanceof Error
                        ? tradingViewQuery.error.message
                        : 'Failed to load TradingView news.'}
                    </span>
                  </div>
                ) : null}
                {tradingViewQuery.data ? (
                  <TradingViewNewsList
                    items={tradingViewQuery.data.items}
                    sections={tradingViewQuery.data.sections}
                  />
                ) : null}
              </section>

              <section className="border-t border-white/10 pt-6">
                <h3 className="mb-3 text-[11px] font-bold uppercase tracking-widest text-violet-300">
                  AI research · last 2 months
                </h3>
                {aiNewsQuery.isLoading ? (
                  <div className="flex items-center gap-2 text-sm text-gray-400">
                    <Loader2 className="h-4 w-4 animate-spin text-violet-400" aria-hidden />
                    Searching live sources…
                  </div>
                ) : null}
                {aiNewsQuery.isError ? (
                  <div className="flex items-start gap-2 rounded-lg border border-amber-500/25 bg-amber-500/10 p-3 text-sm text-amber-200">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                    <span>
                      {aiNewsQuery.error instanceof Error
                        ? aiNewsQuery.error.message
                        : 'Failed to load AI news.'}
                    </span>
                  </div>
                ) : null}
                {aiNewsQuery.data ? <StockNewsSearchSections result={aiNewsQuery.data} /> : null}
              </section>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
