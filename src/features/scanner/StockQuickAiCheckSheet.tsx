'use client';

import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, ExternalLink, Loader2, RefreshCcw, Sparkles } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { MembershipUpgradePrompt } from '@/components/membership/MembershipUpgradePrompt';
import { useMembership } from '@/hooks/useMembership';
import { useQuickAiCheckQuery, useRefreshQuickAiCheck } from '@/features/ai/useQuickAiCheckQuery';
import { businessEvaluationSummariesQueryKey } from '@/lib/ai/quick-ai-check-client';
import { normalizeBusinessTicker, type QuickAiCheckVerdict } from '@/lib/ai/quick-ai-check';

type StockQuickAiCheckSheetProps = {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  ticker: string;
  companyName: string;
};

function verdictClassName(verdict: QuickAiCheckVerdict): string {
  if (verdict === 'Strong') {
    return 'border-emerald-400/30 bg-emerald-500/10 text-emerald-200';
  }
  if (verdict === 'Weak') {
    return 'border-red-400/30 bg-red-500/10 text-red-200';
  }
  if (verdict === 'Mixed') {
    return 'border-amber-400/30 bg-amber-500/10 text-amber-200';
  }
  return 'border-white/10 bg-white/5 text-gray-300';
}

export default function StockQuickAiCheckSheet({
  open,
  onOpenChange,
  ticker,
  companyName,
}: StockQuickAiCheckSheetProps) {
  const queryClient = useQueryClient();
  const { isPremium } = useMembership();
  const normalizedTicker = normalizeBusinessTicker(ticker);
  const refreshQuickAiCheck = useRefreshQuickAiCheck();
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const q = useQuickAiCheckQuery(
    { ticker: normalizedTicker, companyName },
    {
      enabled: open && normalizedTicker.length > 0 && isPremium,
    },
  );

  const onRefresh = async () => {
    if (!normalizedTicker) return;
    setRefreshError(null);
    setRefreshing(true);
    try {
      await refreshQuickAiCheck({ ticker: normalizedTicker, companyName });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to refresh Business Evaluation';
      setRefreshError(message);
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (!q.isSuccess || !normalizedTicker) return;
    void queryClient.invalidateQueries({
      queryKey: businessEvaluationSummariesQueryKey([normalizedTicker]),
    });
  }, [q.isSuccess, q.dataUpdatedAt, normalizedTicker, queryClient]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full border-white/10 bg-[#0e1014] text-gray-100 sm:max-w-xl lg:max-w-2xl"
      >
        <SheetHeader className="border-b border-white/10 bg-[#12151b] pb-3">
          <div className="flex items-center gap-2 text-cyan-300">
            <Sparkles className="h-4 w-4" aria-hidden />
            <span className="text-[10px] font-bold uppercase tracking-widest">Business Evaluation</span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <SheetTitle className="text-white">{normalizedTicker || 'Select a stock'}</SheetTitle>
            {q.data ? (
              <span className="rounded-lg border border-cyan-400/30 bg-cyan-500/15 px-2.5 py-1 text-xs font-bold text-cyan-200">
                {q.data.category}
              </span>
            ) : null}
          </div>
          {companyName ? (
            <SheetDescription className="text-gray-400">{companyName}</SheetDescription>
          ) : null}
        </SheetHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4 pt-4">
          {!normalizedTicker ? (
            <p className="text-sm text-gray-500">Pick a stock to run a quick grounded business evaluation.</p>
          ) : !isPremium ? (
            <MembershipUpgradePrompt reason="ai" className="mt-2" />
          ) : q.isPending ? (
            <div className="flex items-center gap-2 text-sm text-gray-400">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              Running Business Evaluation...
            </div>
          ) : q.isError ? (
            <div className="flex items-start gap-2 rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 text-sm text-amber-100">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" aria-hidden />
              <div className="space-y-2">
                <p>{q.error instanceof Error ? q.error.message : 'Failed to generate Business Evaluation.'}</p>
                <button
                  type="button"
                  onClick={() => void onRefresh()}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-300 hover:underline"
                >
                  <RefreshCcw className="h-3 w-3" aria-hidden />
                  Try again
                </button>
              </div>
            </div>
          ) : q.data ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-[#141925] p-3">
                <div>
                  <p className="text-[11px] uppercase tracking-wide text-gray-400">Business Category</p>
                  <p className="mt-1 text-lg font-semibold text-white">{q.data.category}</p>
                </div>
                <button
                  type="button"
                  onClick={() => void onRefresh()}
                  disabled={refreshing}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-gray-200 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {refreshing ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                  ) : (
                    <RefreshCcw className="h-3.5 w-3.5" aria-hidden />
                  )}
                  Refresh
                </button>
              </div>
              {refreshError ? <p className="text-xs text-amber-200">{refreshError}</p> : null}

              <section className="rounded-xl border border-white/10 bg-[#11141b] p-3">
                <h3 className="text-xs font-bold uppercase tracking-wide text-cyan-300">Quick View</h3>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-gray-200">
                  {q.data.summary}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {q.data.ratingReasons.map((reason) => (
                    <span
                      key={reason}
                      className="rounded-md border border-cyan-400/25 bg-cyan-500/10 px-2 py-1 text-[11px] text-cyan-100"
                    >
                      {reason}
                    </span>
                  ))}
                </div>
              </section>

              <section className="rounded-xl border border-white/10 bg-[#11141b] p-3">
                <h3 className="text-xs font-bold uppercase tracking-wide text-cyan-300">Factor Check</h3>
                <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {q.data.factors.map((factor) => (
                    <div key={factor.name} className="rounded-lg border border-white/10 bg-[#0f131b] p-2.5">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-[12px] font-semibold text-white">{factor.name}</p>
                        <span
                          className={`rounded-md border px-2 py-0.5 text-[10px] font-bold ${verdictClassName(factor.verdict)}`}
                        >
                          {factor.verdict}
                        </span>
                      </div>
                      <p className="mt-2 text-[12px] leading-relaxed text-gray-300">
                        {factor.note || 'Limited recent evidence surfaced for a confident call.'}
                      </p>
                    </div>
                  ))}
                </div>
              </section>

              {q.data.sources.length > 0 ? (
                <section className="rounded-xl border border-white/10 bg-[#11141b] p-3">
                  <h3 className="text-xs font-bold uppercase tracking-wide text-cyan-300">Grounded Sources</h3>
                  <ul className="mt-2 space-y-2 text-[12px] text-gray-300">
                    {q.data.sources.slice(0, 6).map((source) => (
                      <li key={source.uri}>
                        <a
                          href={source.uri}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-start gap-1.5 hover:text-cyan-200"
                        >
                          <ExternalLink className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
                          <span>{source.title}</span>
                        </a>
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}
            </div>
          ) : null}

          <p className="mt-6 border-t border-white/10 pt-3 text-[11px] text-gray-500">
            Simplified Gemini evaluation with Google Search grounding. Useful for a fast read, but it can still miss nuance.
          </p>
        </div>
      </SheetContent>
    </Sheet>
  );
}
