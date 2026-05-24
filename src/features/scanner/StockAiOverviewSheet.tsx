'use client';

import { AlertTriangle, Loader2, Plus, RefreshCcw, Sparkles } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { MembershipUpgradePrompt } from '@/components/membership/MembershipUpgradePrompt';
import { useMembership } from '@/hooks/useMembership';
import { useBusinessAnalysisQuery, useRefreshBusinessAnalysis } from '@/features/ai/useBusinessAnalysisQuery';
import {
  businessAnalysisQueryKey,
  fetchStockBusinessAnalysisHighlights,
} from '@/lib/ai/business-analysis-client';
import { hasBusinessAnalysisHighlights, normalizeBusinessTicker } from '@/lib/ai/business-analysis';

type StockAiOverviewSheetProps = {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  ticker: string;
  companyName: string;
};

function directionLabel(direction: 'up' | 'flat' | 'down'): string {
  if (direction === 'up') return 'Up';
  if (direction === 'down') return 'Down';
  return 'Flat';
}

export default function StockAiOverviewSheet({
  open,
  onOpenChange,
  ticker,
  companyName,
}: StockAiOverviewSheetProps) {
  const queryClient = useQueryClient();
  const { isPremium } = useMembership();
  const normalizedTicker = normalizeBusinessTicker(ticker);
  const refreshBusinessAnalysis = useRefreshBusinessAnalysis();
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [highlightsError, setHighlightsError] = useState<string | null>(null);
  const [highlightsLoading, setHighlightsLoading] = useState(false);
  const q = useBusinessAnalysisQuery(
    { ticker: normalizedTicker, companyName },
    {
      enabled: open && normalizedTicker.length > 0 && isPremium,
    },
  );

  const scoreRows = [
    ['Revenue Growth', q.data?.scorecard.revenueGrowth],
    ['Profit Growth', q.data?.scorecard.profitGrowth],
    ['Operating Margins', q.data?.scorecard.operatingMargins],
    ['Demand Visibility', q.data?.scorecard.demandVisibility],
    ['Order Inflow', q.data?.scorecard.orderInflows],
    ['Expansion Strategy', q.data?.scorecard.expansionCapacityGrowth],
    ['Management Execution', q.data?.scorecard.managementExecution],
    ['Balance Sheet', q.data?.scorecard.balanceSheetQuality],
    ['Cash Flow Quality', q.data?.scorecard.cashFlowStrength],
    ['Industry Tailwinds', q.data?.scorecard.industryTailwinds],
    ['Valuation Comfort', q.data?.scorecard.valuationComfort],
    ['Market Expectations', q.data?.scorecard.marketExpectations],
  ] as const;

  const onRefresh = async () => {
    if (!normalizedTicker) return;
    setRefreshError(null);
    try {
      await refreshBusinessAnalysis({ ticker: normalizedTicker, companyName });
      await q.refetch();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to refresh business analysis';
      setRefreshError(message);
    }
  };

  const onLoadHighlights = async () => {
    if (!normalizedTicker) return;
    setHighlightsError(null);
    setHighlightsLoading(true);
    try {
      const highlights = await fetchStockBusinessAnalysisHighlights({
        ticker: normalizedTicker,
        companyName,
      });
      if (q.data) {
        queryClient.setQueryData(businessAnalysisQueryKey(normalizedTicker), {
          ...q.data,
          executiveSummary: highlights.executiveSummary,
          keyPositives: highlights.keyPositives,
          keyRisks: highlights.keyRisks,
        });
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to load extended analysis';
      setHighlightsError(message);
    } finally {
      setHighlightsLoading(false);
    }
  };

  const showHighlights = q.data ? hasBusinessAnalysisHighlights(q.data) : false;

  useEffect(() => {
    if (!q.isSuccess) return;
    void queryClient.invalidateQueries({ queryKey: ['ai', 'business-analysis-summaries'] });
  }, [q.isSuccess, q.dataUpdatedAt, queryClient]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full border-white/10 bg-[#0e1014] text-gray-100 sm:max-w-xl lg:max-w-2xl"
      >
        <SheetHeader className="border-b border-white/10 bg-[#12151b] pb-3">
          <div className="flex items-center gap-2 text-purple-300">
            <Sparkles className="h-4 w-4" aria-hidden />
            <span className="text-[10px] font-bold uppercase tracking-widest">
              Business Analysis
            </span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <SheetTitle className="text-white">
              {normalizedTicker || 'Select a stock'}
            </SheetTitle>
            {q.data ? (
              <div className="flex items-center gap-2">
                <span className="rounded-lg border border-violet-400/30 bg-violet-500/15 px-2.5 py-1 text-xs font-bold text-violet-200">
                  {q.data.category}
                </span>
                <span className="rounded-md border border-cyan-400/30 bg-cyan-500/15 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-cyan-200">
                  {directionLabel(q.data.direction)}
                </span>
              </div>
            ) : null}
          </div>
          {companyName ? (
            <SheetDescription className="text-gray-400">{companyName}</SheetDescription>
          ) : null}
        </SheetHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4 pt-4">
          {!normalizedTicker ? (
            <p className="text-sm text-gray-500">
              Pick a stock from the scanner list to see Business Analysis.
            </p>
          ) : !isPremium ? (
            <MembershipUpgradePrompt reason="ai" className="mt-2" />
          ) : q.isPending ? (
            <div className="flex items-center gap-2 text-sm text-gray-400">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              Synthesizing business analysis...
            </div>
          ) : q.isError ? (
            <div className="flex items-start gap-2 rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 text-sm text-amber-100">
              <AlertTriangle
                className="mt-0.5 h-4 w-4 shrink-0 text-amber-400"
                aria-hidden
              />
              <div className="space-y-2">
                <p>
                  {q.error instanceof Error
                    ? q.error.message
                    : 'Failed to generate overview.'}
                </p>
                <button
                  type="button"
                  onClick={() => void onRefresh()}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-300 hover:underline"
                >
                  <RefreshCcw className="h-3 w-3" aria-hidden /> Try again
                </button>
                {refreshError ? (
                  <p className="text-xs text-amber-200">{refreshError}</p>
                ) : null}
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-[#141925] p-3">
                <div>
                  <p className="text-[11px] uppercase tracking-wide text-gray-400">Business Momentum Category</p>
                  <p className="mt-1 text-lg font-semibold text-white">{q.data?.category}</p>
                </div>
                <div className="text-right">
                  <p className="text-[11px] uppercase tracking-wide text-gray-400">Composite Score</p>
                  <p className="mt-1 text-lg font-semibold text-cyan-200">{q.data?.compositeScore}/100</p>
                </div>
              </div>
              {q.data?.businessSegments && q.data.businessSegments.length > 0 ? (
                <section className="rounded-xl border border-white/10 bg-[#11141b] p-3">
                  <h3 className="text-xs font-bold uppercase tracking-wide text-purple-300">
                    Business Segments
                  </h3>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {q.data.businessSegments.map((segment) => (
                      <span
                        key={segment}
                        className="rounded-full border border-amber-400/30 bg-amber-500/10 px-2.5 py-1 text-[11px] font-medium text-amber-100"
                      >
                        {segment}
                      </span>
                    ))}
                  </div>
                </section>
              ) : null}
              <div className="space-y-4 rounded-xl border border-white/10 bg-[#11141b] p-3 text-sm leading-relaxed text-gray-200">
                <section>
                  <h3 className="text-xs font-bold uppercase tracking-wide text-purple-300">Rating Reasons</h3>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {q.data?.ratingReasons.map((reason) => (
                      <span
                        key={reason}
                        className="rounded-md border border-cyan-400/25 bg-cyan-500/10 px-2 py-1 text-[11px] text-cyan-100"
                      >
                        {reason}
                      </span>
                    ))}
                  </div>
                </section>
                <section>
                  <h3 className="text-xs font-bold uppercase tracking-wide text-purple-300">Scorecard</h3>
                  <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {scoreRows.map(([label, value]) => (
                      <div key={label} className="rounded-lg border border-white/10 bg-[#0f131b] p-2.5">
                        <div className="flex items-center justify-between gap-2 text-[12px]">
                          <p className="font-semibold text-white">{label}</p>
                          <span className="font-bold text-cyan-200">{value}/10</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
                {!showHighlights ? (
                  <div className="pt-1">
                    <button
                      type="button"
                      onClick={() => void onLoadHighlights()}
                      disabled={highlightsLoading}
                      className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-violet-400/30 bg-violet-500/10 px-3 py-2.5 text-sm font-semibold text-violet-100 transition hover:bg-violet-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {highlightsLoading ? (
                        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                      ) : (
                        <Plus className="h-4 w-4" aria-hidden />
                      )}
                      {highlightsLoading ? 'Loading extended analysis…' : 'View more'}
                    </button>
                    {highlightsError ? (
                      <p className="mt-2 text-xs text-amber-200">{highlightsError}</p>
                    ) : (
                      <p className="mt-2 text-[11px] text-gray-500">
                        Loads executive summary, key positives, and key risks in a separate AI call.
                      </p>
                    )}
                  </div>
                ) : null}
                {showHighlights ? (
                  <>
                    <section>
                      <h3 className="text-xs font-bold uppercase tracking-wide text-purple-300">Executive Summary</h3>
                      <div className="mt-2 rounded-lg border border-white/10 bg-[#0f131b] p-3 text-[13px]">
                        <p className="whitespace-pre-wrap text-gray-200">{q.data?.executiveSummary}</p>
                      </div>
                    </section>
                    <section>
                      <h3 className="text-xs font-bold uppercase tracking-wide text-purple-300">Key Positives</h3>
                      <ul className="mt-2 list-disc space-y-1 pl-4 text-[13px] text-gray-200">
                        {q.data?.keyPositives.map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                    </section>
                    <section>
                      <h3 className="text-xs font-bold uppercase tracking-wide text-purple-300">Key Risks</h3>
                      <ul className="mt-2 list-disc space-y-1 pl-4 text-[13px] text-gray-200">
                        {q.data?.keyRisks.map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                    </section>
                  </>
                ) : null}
              </div>
            </div>
          )}
          <p className="mt-6 border-t border-white/10 pt-3 text-[11px] text-gray-500">
            Generated by Gemini with Google Search grounding and TradingView context — may contain inaccuracies. Not investment advice.
          </p>
        </div>
      </SheetContent>
    </Sheet>
  );
}
