'use client';

import { AlertTriangle, Loader2, RefreshCcw, Sparkles } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import type {
  FinancialRating,
  QualitativeVerdict,
  StockOverviewApiResponse,
} from '@/lib/ai/stock-overview';
import { AI_STOCK_OVERVIEW_STALE_MS, stockOverviewApiResponseSchema } from '@/lib/ai/stock-overview';

type StockAiOverviewSheetProps = {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  ticker: string;
  companyName: string;
};

const financialMetricLabels: Record<
  keyof StockOverviewApiResponse['analysis']['financialAnalysis'],
  string
> = {
  revenueGrowth: 'Revenue Growth',
  profitGrowth: 'Profit Growth',
  epsGrowth: 'EPS Growth',
  profitMarginExpansion: 'Profit Margin Expansion',
  freeCashFlowGrowth: 'Free Cash Flow Growth',
};

function ratingChipClass(rating: FinancialRating): string {
  if (rating === 'hyper') return 'border-emerald-400/40 bg-emerald-500/20 text-emerald-200';
  if (rating === 'good') return 'border-blue-400/40 bg-blue-500/20 text-blue-200';
  if (rating === 'avg') return 'border-amber-400/40 bg-amber-500/20 text-amber-200';
  return 'border-rose-400/40 bg-rose-500/20 text-rose-200';
}

function verdictChipClass(verdict: QualitativeVerdict): string {
  if (verdict === 'yes') return 'border-emerald-400/40 bg-emerald-500/15 text-emerald-200';
  if (verdict === 'no') return 'border-amber-400/40 bg-amber-500/15 text-amber-200';
  return 'border-rose-400/40 bg-rose-500/15 text-rose-200';
}

function scoreBarClass(score: number): string {
  if (score >= 75) return 'bg-emerald-500';
  if (score >= 55) return 'bg-blue-500';
  if (score >= 40) return 'bg-amber-500';
  return 'bg-rose-500';
}

async function fetchStockOverview(
  ticker: string,
  companyName: string,
): Promise<StockOverviewApiResponse> {
  const res = await fetch('/api/ai/stock-overview', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Requested-With': 'XMLHttpRequest',
    },
    body: JSON.stringify({ ticker, companyName }),
  });
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown> & {
    error?: string;
  };
  if (!res.ok) throw new Error(json.error || 'Failed to generate overview.');
  return stockOverviewApiResponseSchema.parse(json);
}

export default function StockAiOverviewSheet({
  open,
  onOpenChange,
  ticker,
  companyName,
}: StockAiOverviewSheetProps) {
  const normalizedTicker = ticker.trim().toUpperCase();
  const q = useQuery({
    queryKey: ['ai', 'stock-overview', normalizedTicker],
    queryFn: () => fetchStockOverview(ticker, companyName),
    enabled: open && normalizedTicker.length > 0,
    staleTime: AI_STOCK_OVERVIEW_STALE_MS,
    gcTime: AI_STOCK_OVERVIEW_STALE_MS,
    refetchOnWindowFocus: false,
    retry: false,
  });
  const objectiveScore = useMemo(() => {
    if (!q.data) return null;
    const value = q.data.analysis.score.objectiveScore;
    if (!Number.isFinite(value)) return null;
    return Math.max(0, Math.min(100, Math.round(value)));
  }, [q.data]);

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
              AI overview
            </span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <SheetTitle className="text-white">
              {normalizedTicker || 'Select a stock'}
            </SheetTitle>
            {objectiveScore != null ? (
              <div className="flex items-center gap-2">
                <span className="rounded-lg border border-emerald-400/30 bg-emerald-500/15 px-2.5 py-1 text-xs font-bold text-emerald-200">
                  {objectiveScore}%
                </span>
                {q.data ? (
                  <span className="rounded-md border border-white/10 bg-white/5 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-gray-300">
                    {q.data.meta.cacheStatus}
                  </span>
                ) : null}
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
              Pick a stock from the scanner list to see an AI overview.
            </p>
          ) : q.isPending ? (
            <div className="flex items-center gap-2 text-sm text-gray-400">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              Generating overview…
            </div>
          ) : q.isError ? (
            <div className="flex items-start gap-2 rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 text-sm text-gray-300">
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
                  onClick={() => void q.refetch()}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-300 hover:underline"
                >
                  <RefreshCcw className="h-3 w-3" aria-hidden /> Try again
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="rounded-xl border border-white/10 bg-[#141925] p-3">
                <p className="text-[11px] uppercase tracking-wide text-gray-400">
                  Fast objective framework (backend-scored)
                </p>
                <p className="mt-1 text-xs text-gray-300">
                  AI writes thesis only; backend computes score from your fixed framework to keep logic consistent and cheap.
                </p>
                {q.data ? (
                  <p className="mt-2 text-[11px] text-gray-400">
                    Generated: {new Date(q.data.meta.generatedAt).toLocaleString('en-IN')} | Stale after:{' '}
                    {new Date(q.data.meta.staleAfter).toLocaleString('en-IN')}
                  </p>
                ) : null}
              </div>
              <div className="space-y-4 rounded-xl border border-white/10 bg-[#11141b] p-3 text-sm leading-relaxed text-gray-200">
                <section>
                  <h3 className="text-xs font-bold uppercase tracking-wide text-purple-300">Overall Score</h3>
                  <div className="mt-2 rounded-lg border border-white/10 bg-[#0d1016] p-3">
                    <div className="flex items-center justify-between text-xs text-gray-300">
                      <span>Objective score</span>
                      <span className="font-bold text-white">{q.data?.analysis.score.objectiveScore}%</span>
                    </div>
                    <div className="mt-2 h-2.5 rounded-full bg-white/10">
                      <div
                        className={`h-full rounded-full ${scoreBarClass(q.data?.analysis.score.objectiveScore ?? 0)}`}
                        style={{ width: `${q.data?.analysis.score.objectiveScore ?? 0}%` }}
                      />
                    </div>
                    <div className="mt-3 grid grid-cols-1 gap-2 text-xs text-gray-300 sm:grid-cols-2">
                      <div className="rounded-md border border-white/10 bg-white/3 p-2">
                        Financial: {q.data?.analysis.score.financialPoints}/50 ({q.data?.analysis.score.sectionPercentages.financial}%)
                      </div>
                      <div className="rounded-md border border-white/10 bg-white/3 p-2">
                        Qualitative: {q.data?.analysis.score.qualitativePoints}/90 ({q.data?.analysis.score.sectionPercentages.qualitative}%)
                      </div>
                    </div>
                  </div>
                </section>

                <section>
                  <h3 className="text-xs font-bold uppercase tracking-wide text-purple-300">Fundamental Story</h3>
                  <div className="mt-2 rounded-lg border border-white/10 bg-[#0f131b] p-3 text-[13px]">
                    <p className="whitespace-pre-wrap text-gray-200">{q.data?.analysis.fundamentalStory.businessExplanation}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <span className="rounded-md border border-white/10 bg-white/4 px-2 py-1 text-[11px] text-gray-300">
                        Core: {q.data?.analysis.fundamentalStory.coreSegment}
                      </span>
                      <span className="rounded-md border border-emerald-400/20 bg-emerald-500/10 px-2 py-1 text-[11px] text-emerald-200">
                        Fastest: {q.data?.analysis.fundamentalStory.mostGrowingSegment}
                      </span>
                    </div>
                  </div>
                </section>

                <section>
                  <h3 className="text-xs font-bold uppercase tracking-wide text-purple-300">Financial Analysis (5 Metrics)</h3>
                  <div className="mt-2 grid grid-cols-1 gap-2">
                    {(Object.keys(financialMetricLabels) as Array<keyof typeof financialMetricLabels>).map((key) => {
                      const item = q.data?.analysis.financialAnalysis[key];
                      if (!item) return null;
                      return (
                        <div key={key} className="rounded-lg border border-white/10 bg-[#0f131b] p-2.5">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-[12px] font-semibold text-white">{financialMetricLabels[key]}</p>
                            <span className={`rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase ${ratingChipClass(item.rating)}`}>
                              {item.rating}
                            </span>
                          </div>
                          <p className="mt-1 text-[12px] text-blue-200">Numeric: {item.numericEvidence}</p>
                          <p className="mt-1 text-[12px] text-gray-300">{item.explanation}</p>
                        </div>
                      );
                    })}
                  </div>
                </section>

                <section>
                  <h3 className="text-xs font-bold uppercase tracking-wide text-purple-300">Qualitative Analysis (9 Questions)</h3>
                  <ul className="mt-2 space-y-2">
                    {q.data?.analysis.qualitativeAnalysis.map((item) => (
                      <li key={item.id} className="rounded-lg border border-white/10 bg-[#0f131b] p-2.5">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-[12px] font-semibold text-white">{item.id}. {item.question}</p>
                          <span className={`rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase ${verdictChipClass(item.verdict)}`}>
                            {item.verdict}
                          </span>
                        </div>
                        <p className="mt-1 text-[12px] text-gray-300">{item.explanation}</p>
                      </li>
                    ))}
                  </ul>
                </section>

                <section>
                  <h3 className="text-xs font-bold uppercase tracking-wide text-purple-300">Conclusion</h3>
                  <div className="space-y-3">
                    <div className="rounded-lg border border-emerald-400/20 bg-emerald-500/10 p-3">
                      <p className="text-[11px] font-bold uppercase tracking-wide text-emerald-200">Moat / Why own</p>
                      <p className="mt-1 whitespace-pre-wrap text-[13px] text-gray-200">{q.data?.analysis.conclusion.moatAndWhyInvest}</p>
                    </div>
                    <div className="rounded-lg border border-blue-400/20 bg-blue-500/10 p-3">
                      <p className="text-[11px] font-bold uppercase tracking-wide text-blue-200">Future growth / triggers</p>
                      <p className="mt-1 whitespace-pre-wrap text-[13px] text-gray-200">{q.data?.analysis.conclusion.futureGrowthProspects}</p>
                    </div>
                    <div className="rounded-lg border border-rose-400/20 bg-rose-500/10 p-3">
                      <p className="text-[11px] font-bold uppercase tracking-wide text-rose-200">Risks / why avoid</p>
                      <p className="mt-1 whitespace-pre-wrap text-[13px] text-gray-200">{q.data?.analysis.conclusion.risksWhyAvoid}</p>
                    </div>
                  </div>
                </section>
              </div>
            </div>
          )}
          <p className="mt-6 border-t border-white/10 pt-3 text-[11px] text-gray-500">
            Generated by Gemini — may contain inaccuracies. Not investment advice.
          </p>
        </div>
      </SheetContent>
    </Sheet>
  );
}
