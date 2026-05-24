'use client';

import { AlertTriangle, Loader2, Newspaper, RefreshCcw } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { stockNewsApiResponseSchema } from '@/lib/ai/analyse-scan';
import { formatPublishedLabel } from '@/lib/news/fetch-tradingview-symbol-news';

type StockNewsSheetProps = {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  ticker: string;
  companyName: string;
};

async function fetchSymbolNews(symbol: string) {
  const qs = new URLSearchParams({ symbol });
  const res = await fetch(`/api/news?${qs.toString()}`, { cache: 'no-store' });
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown> & {
    error?: string;
  };
  if (!res.ok) {
    throw new Error(typeof json.error === 'string' ? json.error : 'Failed to fetch news');
  }
  return stockNewsApiResponseSchema.parse(json);
}

export default function StockNewsSheet({
  open,
  onOpenChange,
  ticker,
  companyName,
}: StockNewsSheetProps) {
  const queryClient = useQueryClient();
  const normalizedTicker = ticker.trim().toUpperCase();

  const q = useQuery({
    queryKey: ['news', 'symbol', normalizedTicker],
    queryFn: () => fetchSymbolNews(normalizedTicker),
    enabled: open && normalizedTicker.length > 0,
    staleTime: 2 * 60_000,
    gcTime: 10 * 60_000,
    refetchOnWindowFocus: false,
  });

  const onRefresh = () => {
    void queryClient.invalidateQueries({ queryKey: ['news', 'symbol', normalizedTicker] });
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex w-full flex-col border-white/10 bg-[#0e1014] text-gray-100 sm:max-w-lg"
      >
        <SheetHeader className="shrink-0 border-b border-white/10 bg-[#12151b] pb-3">
          <div className="flex items-center gap-2 text-cyan-300">
            <Newspaper className="h-4 w-4" aria-hidden />
            <span className="text-[10px] font-bold uppercase tracking-widest">Latest news</span>
          </div>
          <SheetTitle className="text-left text-lg text-white">
            {normalizedTicker || '—'}
          </SheetTitle>
          <SheetDescription className="text-left text-gray-400">
            {companyName.trim() || 'NSE equity'}
          </SheetDescription>
          <button
            type="button"
            onClick={onRefresh}
            disabled={q.isFetching}
            className="mt-2 inline-flex w-fit items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] font-medium text-gray-300 hover:bg-white/10 disabled:opacity-50"
          >
            {q.isFetching ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
            ) : (
              <RefreshCcw className="h-3.5 w-3.5" aria-hidden />
            )}
            Refresh
          </button>
        </SheetHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-1 py-4">
          {q.isLoading ? (
            <div className="flex items-center gap-2 px-2 text-sm text-gray-400">
              <Loader2 className="h-4 w-4 animate-spin text-cyan-400" aria-hidden />
              Loading headlines…
            </div>
          ) : null}

          {q.isError ? (
            <div className="mx-2 flex items-start gap-2 rounded-lg border border-amber-500/25 bg-amber-500/10 p-3 text-sm text-amber-200">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              <span>{q.error instanceof Error ? q.error.message : 'Failed to load news.'}</span>
            </div>
          ) : null}

          {q.data ? (
            <div className="space-y-4 px-2">
              {q.data.sections && q.data.sections.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {q.data.sections.map((section) => (
                    <span
                      key={section.id}
                      className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-gray-400"
                    >
                      {section.title}
                    </span>
                  ))}
                </div>
              ) : null}

              {q.data.items.length === 0 ? (
                <p className="text-sm text-gray-500">No headlines returned for this symbol.</p>
              ) : (
                <ul className="space-y-2.5">
                  {q.data.items.map((item) => (
                    <li
                      key={item.id}
                      className="rounded-xl border border-white/10 bg-[#10141c] p-3"
                    >
                      <div className="flex flex-wrap items-center gap-2 text-[10px] uppercase tracking-wide text-gray-500">
                        <span>{formatPublishedLabel(item.published)}</span>
                        {item.sourceHint ? (
                          <>
                            <span aria-hidden>·</span>
                            <span>{item.sourceHint}</span>
                          </>
                        ) : null}
                      </div>
                      {item.link ? (
                        <a
                          href={item.link}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-1 block text-[13px] font-semibold leading-snug text-blue-300 hover:underline"
                        >
                          {item.title}
                        </a>
                      ) : (
                        <p className="mt-1 text-[13px] font-semibold leading-snug text-gray-100">
                          {item.title}
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              )}

              <p className="text-[10px] text-gray-600">
                Live feed via TradingView — {q.data.items.length} headline
                {q.data.items.length === 1 ? '' : 's'}. Not investment advice.
              </p>
            </div>
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}
