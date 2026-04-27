'use client';

import { AlertTriangle, Loader2, RefreshCcw, Sparkles } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo } from 'react';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import type {
  FinancialMetricRating,
  QualitativeVerdict,
  QuantamentalScoredResult,
  QuantamentalVerdict,
  ValuationRating,
} from '@/lib/validations/stock-schema';
import { quantamentalScoredResultSchema } from '@/lib/validations/stock-schema';

const SECTION_MAX = {
  financial: 20,
  qualitative: 50,
  valuation: 10,
  technical: 20,
} as const;

type StockAiOverviewSheetProps = {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  ticker: string;
  companyName: string;
};

const financialMetricLabels: Record<
  keyof QuantamentalScoredResult['data']['analysis']['financialAnalysis']['metrics'],
  string
> = {
  revenueGrowth: 'Revenue Growth',
  epsGrowth: 'EPS Growth',
  marginExpansion: 'Margin Expansion',
  freeCashFlow: 'Operating Cash Flow Strength',
};

function ratingChipClass(rating: FinancialMetricRating): string {
  if (rating === 'hyper') return 'border-emerald-400/40 bg-emerald-500/20 text-emerald-200';
  if (rating === 'good') return 'border-blue-400/40 bg-blue-500/20 text-blue-200';
  if (rating === 'avg') return 'border-amber-400/40 bg-amber-500/20 text-amber-200';
  return 'border-rose-400/40 bg-rose-500/20 text-rose-200';
}

function verdictChipClass(verdict: QualitativeVerdict): string {
  if (verdict === 'yes') return 'border-emerald-400/40 bg-emerald-500/15 text-emerald-200';
  if (verdict === 'neutral') return 'border-amber-400/40 bg-amber-500/15 text-amber-200';
  return 'border-rose-400/40 bg-rose-500/15 text-rose-200';
}

function valuationChipClass(rating: ValuationRating): string {
  if (rating === 'undervalued') return 'border-emerald-400/40 bg-emerald-500/15 text-emerald-200';
  if (rating === 'fair') return 'border-blue-400/40 bg-blue-500/15 text-blue-200';
  return 'border-rose-400/40 bg-rose-500/15 text-rose-200';
}

function scoreBarClass(score: number): string {
  if (score >= 80) return 'bg-emerald-500';
  if (score >= 65) return 'bg-blue-500';
  if (score >= 40) return 'bg-amber-500';
  return 'bg-rose-500';
}

function verdictChipClassFromScore(verdict: QuantamentalVerdict): string {
  if (verdict === 'Strong Buy') return 'border-emerald-400/40 bg-emerald-500/15 text-emerald-200';
  if (verdict === 'Accumulate') return 'border-blue-400/40 bg-blue-500/15 text-blue-200';
  if (verdict === 'Hold') return 'border-amber-400/40 bg-amber-500/15 text-amber-200';
  return 'border-rose-400/40 bg-rose-500/15 text-rose-200';
}

function toPercent(value: number, max: number): number {
  if (!Number.isFinite(value) || max <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((value / max) * 100)));
}

async function fetchStockOverview(
  ticker: string,
  companyName: string,
): Promise<QuantamentalScoredResult> {
  const res = await fetch('/api/analyze', {
    method: 'POST',
    headers: {
      'Content-Type': 'text/plain',
      'X-Requested-With': 'XMLHttpRequest',
    },
    body: `Analyze ${ticker}${companyName ? ` (${companyName})` : ''}`,
  });
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown> & {
    error?: string;
  };
  if (!res.ok) throw new Error(json.error || 'Failed to generate overview.');
  return quantamentalScoredResultSchema.parse(json);
}

export default function StockAiOverviewSheet({
  open,
  onOpenChange,
  ticker,
  companyName,
}: StockAiOverviewSheetProps) {
  const queryClient = useQueryClient();
  const normalizedTicker = ticker.trim().toUpperCase();
  const q = useQuery({
    queryKey: ['ai', 'quantamental-overview', normalizedTicker],
    queryFn: () => fetchStockOverview(ticker, companyName),
    enabled: open && normalizedTicker.length > 0,
    staleTime: 5 * 60_000,
    gcTime: 10 * 60_000,
    refetchOnWindowFocus: false,
    retry: false,
  });

  useEffect(() => {
    if (!q.isSuccess) return;
    void queryClient.invalidateQueries({ queryKey: ['ai', 'quantamental-scores'] });
  }, [q.isSuccess, q.dataUpdatedAt, queryClient]);

  const quantamentalScore = useMemo(() => {
    if (!q.data) return null;
    const value = q.data.scores.total;
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
            {quantamentalScore != null ? (
              <div className="flex items-center gap-2">
                <span className="rounded-lg border border-emerald-400/30 bg-emerald-500/15 px-2.5 py-1 text-xs font-bold text-emerald-200">
                  {quantamentalScore}%
                </span>
                {q.data && (
                  <span
                    className={`rounded-md border px-2 py-1 text-[10px] font-semibold uppercase tracking-wide ${verdictChipClassFromScore(q.data.verdict)}`}
                  >
                    {q.data.verdict}
                  </span>
                )}
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
              Generating quantamental overview...
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
                  Quantamental framework (backend-scored)
                </p>
                <p className="mt-1 text-xs text-gray-300">
                  AI outputs categories only, and backend computes weighted math so scoring stays deterministic.
                </p>
              </div>
              <div className="space-y-4 rounded-xl border border-white/10 bg-[#11141b] p-3 text-sm leading-relaxed text-gray-200">
                <section>
                  <h3 className="text-xs font-bold uppercase tracking-wide text-purple-300">Overall Score</h3>
                  <div className="mt-2 rounded-lg border border-white/10 bg-[#0d1016] p-3">
                    <div className="flex items-center justify-between text-xs text-gray-300">
                      <span>Quantamental score</span>
                      <span className="font-bold text-white">
                        {q.data?.scores.total} / 100 ({toPercent(q.data?.scores.total ?? 0, 100)}%)
                      </span>
                    </div>
                    <div className="mt-2 h-2.5 rounded-full bg-white/10">
                      <div
                        className={`h-full rounded-full ${scoreBarClass(q.data?.scores.total ?? 0)}`}
                        style={{ width: `${q.data?.scores.total ?? 0}%` }}
                      />
                    </div>
                    <div className="mt-3 grid grid-cols-1 gap-2 text-xs text-gray-300 sm:grid-cols-2">
                      <div className="rounded-md border border-white/10 bg-white/3 p-2">
                        Financial: {q.data?.scores.financial}/{SECTION_MAX.financial} (
                        {toPercent(q.data?.scores.financial ?? 0, SECTION_MAX.financial)}%)
                      </div>
                      <div className="rounded-md border border-white/10 bg-white/3 p-2">
                        Qualitative: {q.data?.scores.qualitative}/{SECTION_MAX.qualitative} (
                        {toPercent(q.data?.scores.qualitative ?? 0, SECTION_MAX.qualitative)}%)
                      </div>
                      <div className="rounded-md border border-white/10 bg-white/3 p-2">
                        Valuation: {q.data?.scores.valuation}/{SECTION_MAX.valuation} (
                        {toPercent(q.data?.scores.valuation ?? 0, SECTION_MAX.valuation)}%)
                      </div>
                      <div className="rounded-md border border-white/10 bg-white/3 p-2">
                        Technical: {q.data?.scores.technical}/{SECTION_MAX.technical} (
                        {toPercent(q.data?.scores.technical ?? 0, SECTION_MAX.technical)}%)
                      </div>
                    </div>
                  </div>
                </section>

                <section>
                  <h3 className="text-xs font-bold uppercase tracking-wide text-purple-300">Fundamental Story</h3>
                  <div className="mt-2 rounded-lg border border-white/10 bg-[#0f131b] p-3 text-[13px]">
                    <p className="whitespace-pre-wrap text-gray-200">
                      {q.data?.data.analysis.fundamentalStory.companyOverview.whatItDoes}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <span className="rounded-md border border-white/10 bg-white/4 px-2 py-1 text-[11px] text-gray-300">
                        Fastest Segment:{' '}
                        {q.data?.data.analysis.fundamentalStory.companyOverview.revenueSegments.fastestGrowing}
                      </span>
                    </div>
                  </div>
                </section>

                <section>
                  <h3 className="text-xs font-bold uppercase tracking-wide text-purple-300">Financial Analysis (4 Metrics)</h3>
                  <div className="mt-2 grid grid-cols-1 gap-2">
                    {(Object.keys(financialMetricLabels) as Array<keyof typeof financialMetricLabels>).map((key) => {
                      const rating = q.data?.data.analysis.financialAnalysis.metrics[key];
                      if (!rating) return null;
                      return (
                        <div key={key} className="rounded-lg border border-white/10 bg-[#0f131b] p-2.5">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-[12px] font-semibold text-white">{financialMetricLabels[key]}</p>
                            <span className={`rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase ${ratingChipClass(rating)}`}>
                              {rating}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>

                <section>
                  <h3 className="text-xs font-bold uppercase tracking-wide text-purple-300">Qualitative Analysis</h3>
                  <ul className="mt-2 space-y-2">
                    {q.data?.data.analysis.qualitativeAnalysis.metrics.map((item) => (
                      <li key={item.category} className="rounded-lg border border-white/10 bg-[#0f131b] p-2.5">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-[12px] font-semibold text-white">{item.category}</p>
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
                  <h3 className="text-xs font-bold uppercase tracking-wide text-purple-300">Valuation Analysis</h3>
                  <div className="mt-2 space-y-2">
                    <div className="rounded-lg border border-white/10 bg-[#0f131b] p-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-[12px] font-semibold text-white">Vs Industry</p>
                        <span
                          className={`rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase ${valuationChipClass(
                            q.data?.data.analysis.valuationAnalysis.vsIndustry.rating ?? 'fair',
                          )}`}
                        >
                          {q.data?.data.analysis.valuationAnalysis.vsIndustry.rating}
                        </span>
                      </div>
                      <p className="mt-1 text-[12px] text-gray-300">
                        {q.data?.data.analysis.valuationAnalysis.vsIndustry.evidence}
                      </p>
                    </div>
                    <div className="rounded-lg border border-white/10 bg-[#0f131b] p-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-[12px] font-semibold text-white">Vs History</p>
                        <span
                          className={`rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase ${valuationChipClass(
                            q.data?.data.analysis.valuationAnalysis.vsHistory.rating ?? 'fair',
                          )}`}
                        >
                          {q.data?.data.analysis.valuationAnalysis.vsHistory.rating}
                        </span>
                      </div>
                      <p className="mt-1 text-[12px] text-gray-300">
                        {q.data?.data.analysis.valuationAnalysis.vsHistory.evidence}
                      </p>
                    </div>
                  </div>
                </section>

                <section>
                  <h3 className="text-xs font-bold uppercase tracking-wide text-purple-300">Technical Analysis</h3>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <div className="rounded-lg border border-white/10 bg-[#0f131b] p-2.5">
                      <p className="text-[11px] uppercase tracking-wide text-gray-400">Trend</p>
                      <p className="mt-1 text-[12px] font-semibold text-white">
                        {q.data?.data.analysis.technicalAnalysis.trend.status}
                      </p>
                      <p className="mt-1 text-[12px] text-gray-300">
                        {q.data?.data.analysis.technicalAnalysis.trend.explanation}
                      </p>
                    </div>
                    <div className="rounded-lg border border-white/10 bg-[#0f131b] p-2.5">
                      <p className="text-[11px] uppercase tracking-wide text-gray-400">Relative Strength</p>
                      <p className="mt-1 text-[12px] font-semibold text-white">
                        {q.data?.data.analysis.technicalAnalysis.relativeStrength.status}
                      </p>
                    </div>
                    <div className="rounded-lg border border-white/10 bg-[#0f131b] p-2.5">
                      <p className="text-[11px] uppercase tracking-wide text-gray-400">Momentum RSI</p>
                      <p className="mt-1 text-[12px] font-semibold text-white">
                        {q.data?.data.analysis.technicalAnalysis.momentumRSI.status}
                      </p>
                    </div>
                    <div className="rounded-lg border border-white/10 bg-[#0f131b] p-2.5">
                      <p className="text-[11px] uppercase tracking-wide text-gray-400">Volume Accumulation</p>
                      <p className="mt-1 text-[12px] font-semibold text-white">
                        {q.data?.data.analysis.technicalAnalysis.volumeAccumulation.status}
                      </p>
                    </div>
                  </div>
                </section>

                <section>
                  <h3 className="text-xs font-bold uppercase tracking-wide text-purple-300">Investment Thesis</h3>
                  <div className="space-y-3">
                    <div className="rounded-lg border border-emerald-400/20 bg-emerald-500/10 p-3">
                      <p className="text-[11px] font-bold uppercase tracking-wide text-emerald-200">Top reasons to own</p>
                      <ul className="mt-1 list-disc space-y-1 pl-4 text-[13px] text-gray-200">
                        {q.data?.data.analysis.fundamentalStory.investmentThesis.top5ReasonsToOwn.map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                    </div>
                    <div className="rounded-lg border border-rose-400/20 bg-rose-500/10 p-3">
                      <p className="text-[11px] font-bold uppercase tracking-wide text-rose-200">Top risks</p>
                      <ul className="mt-1 list-disc space-y-1 pl-4 text-[13px] text-gray-200">
                        {q.data?.data.analysis.fundamentalStory.investmentThesis.top3Risks.map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                    </div>
                    <div className="rounded-lg border border-blue-400/20 bg-blue-500/10 p-3">
                      <p className="text-[11px] font-bold uppercase tracking-wide text-blue-200">Growth triggers</p>
                      <p className="mt-1 whitespace-pre-wrap text-[13px] text-gray-200">
                        {q.data?.data.analysis.fundamentalStory.investmentThesis.growthTriggers}
                      </p>
                    </div>
                  </div>
                </section>

                <section>
                  <h3 className="text-xs font-bold uppercase tracking-wide text-purple-300">Competitive Positioning</h3>
                  <div className="rounded-lg border border-white/10 bg-[#0f131b] p-3 text-[13px]">
                    <p className="text-gray-200">
                      {q.data?.data.analysis.fundamentalStory.competitivePositioning.moatAndMarketLeadership}
                    </p>
                    <p className="mt-2 text-gray-300">
                      {q.data?.data.analysis.fundamentalStory.competitivePositioning.specialtiesAndDifferentiation}
                    </p>
                  </div>
                </section>

                <section>
                  <h3 className="text-xs font-bold uppercase tracking-wide text-purple-300">Cashflow & Visibility</h3>
                  <div className="rounded-lg border border-white/10 bg-[#0f131b] p-3 text-[13px]">
                    <p className="text-gray-200">
                      OCF vs MCap (5Y): {q.data?.data.analysis.fundamentalStory.capitalAndCashflowAnalysis.ocfVsMarketCap5Yr}
                    </p>
                    <p className="mt-2 text-gray-300">
                      Debt (4Y): {q.data?.data.analysis.fundamentalStory.capitalAndCashflowAnalysis.debtCondition4Yr}
                    </p>
                    <p className="mt-2 text-gray-300">
                      Capex self-funding: {q.data?.data.analysis.fundamentalStory.capitalAndCashflowAnalysis.capexSelfFundingAbility}
                    </p>
                    <p className="mt-2 text-gray-300">
                      Order-book visibility: {q.data?.data.analysis.fundamentalStory.futureVisibility.orderBookHealthVsMarketCap}
                    </p>
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
