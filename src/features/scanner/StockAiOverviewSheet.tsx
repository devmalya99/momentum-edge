'use client';

import { AlertTriangle, Loader2, RefreshCcw, Sparkles } from 'lucide-react';
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
import { useBusinessAnalysisCache } from '@/features/ai/useBusinessAnalysisQuery';
import { useBusinessAnalysisStream } from '@/features/ai/useBusinessAnalysisStream';
import { normalizeBusinessTicker, type BusinessAnalysisResponse } from '@/lib/ai/business-analysis';
import {
  buildBasicAnalysisResponse,
  mergeExtendedAnalysisResponse,
} from '@/lib/ai/business-analysis-client';
import { businessAnalysisLog } from '@/lib/ai/business-analysis-stream-log';

type StockAiOverviewSheetProps = {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  ticker: string;
  companyName: string;
};

type BasicStreamObject = {
  story?: string;
  tailwinds?: string[];
  business_exposure?: string[];
};

type ExtendedStreamObject = {
  business_strength?: string[];
  recent_transformations?: string[];
  proof?: string[];
};

export default function StockAiOverviewSheet({
  open,
  onOpenChange,
  ticker,
  companyName,
}: StockAiOverviewSheetProps) {
  const { getCached, setCached } = useBusinessAnalysisCache();
  const { isPremium } = useMembership();
  const normalizedTicker = normalizeBusinessTicker(ticker);
  const [analysis, setAnalysis] = useState<BusinessAnalysisResponse | null>(null);
  const [refreshError, setRefreshError] = useState<string | null>(null);

  const basicStream = useBusinessAnalysisStream<BasicStreamObject>('basic');
  const extendedStream = useBusinessAnalysisStream<ExtendedStreamObject>('extended');

  const runBasicSubmit = async (input: Record<string, unknown>) => {
    setRefreshError(null);
    try {
      const object = await basicStream.submit(input);
      if (!object?.story && !(object?.tailwinds?.length) && !(object?.business_exposure?.length)) {
        setRefreshError('Failed to parse business analysis response.');
        return;
      }
      const payload = buildBasicAnalysisResponse({
        ticker: normalizedTicker,
        companyName,
        report: {
          story: object.story ?? '',
          tailwinds: object.tailwinds ?? [],
          business_exposure: object.business_exposure ?? [],
        },
      });
      setAnalysis(payload);
      setCached(normalizedTicker, payload);
      businessAnalysisLog.ui('basic-finish-success', {
        story: object.story,
        tailwindCount: object.tailwinds?.length ?? 0,
        exposureCount: object.business_exposure?.length ?? 0,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load business analysis';
      setRefreshError(message);
    }
  };

  const runExtendedSubmit = async (input: Record<string, unknown>) => {
    setRefreshError(null);
    try {
      const object = await extendedStream.submit(input);
      if (!object) {
        setRefreshError('Failed to parse extended business analysis response.');
        return;
      }
      setAnalysis((current) => {
        const base =
          current ??
          buildBasicAnalysisResponse({
            ticker: normalizedTicker,
            companyName,
            report: { story: '', tailwinds: [], business_exposure: [] },
          });
        const payload = mergeExtendedAnalysisResponse(base, {
          business_strength: object.business_strength ?? [],
          recent_transformations: object.recent_transformations ?? [],
          proof: object.proof ?? [],
        });
        setCached(normalizedTicker, payload);
        return payload;
      });
      businessAnalysisLog.ui('extended-finish-success', {
        strengthCount: object.business_strength?.length ?? 0,
        transformCount: object.recent_transformations?.length ?? 0,
        proofCount: object.proof?.length ?? 0,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to load extended business analysis';
      setRefreshError(message);
    }
  };

  useEffect(() => {
    if (!open || !isPremium || !normalizedTicker) return;

    const cached = getCached(normalizedTicker) as BusinessAnalysisResponse | undefined;
    setRefreshError(null);
    basicStream.clear();
    extendedStream.clear();

    if (cached) {
      businessAnalysisLog.ui('react-query-cache-hit', { ticker: normalizedTicker });
      setAnalysis(cached);
      return;
    }

    businessAnalysisLog.ui('basic-submit', { ticker: normalizedTicker, companyName });
    setAnalysis(null);
    void runBasicSubmit({
      ticker: normalizedTicker,
      companyName,
      detailLevel: 'basic',
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load when sheet opens for this ticker
  }, [open, isPremium, normalizedTicker, companyName]);

  const extendedFetched = analysis?.meta.extendedFetched === true;
  const showExtended = extendedFetched || extendedStream.isLoading || Boolean(extendedStream.object);
  const loadingBasic = basicStream.isLoading;
  const loadingMore = extendedStream.isLoading;

  const story = basicStream.object?.story ?? analysis?.report.story ?? '';
  const tailwinds = (basicStream.object?.tailwinds ?? analysis?.report.tailwinds ?? []).filter(
    (item): item is string => typeof item === 'string' && item.length > 0,
  );
  const businessExposure = (
    basicStream.object?.business_exposure ??
    analysis?.report.business_exposure ??
    []
  ).filter((item): item is string => typeof item === 'string' && item.length > 0);
  const businessStrength = (
    extendedStream.object?.business_strength ??
    analysis?.report.business_strength ??
    []
  ).filter((item): item is string => typeof item === 'string' && item.length > 0);
  const recentTransformations = (
    extendedStream.object?.recent_transformations ??
    analysis?.report.recent_transformations ??
    []
  ).filter((item): item is string => typeof item === 'string' && item.length > 0);
  const proof = (extendedStream.object?.proof ?? analysis?.report.proof ?? []).filter(
    (item): item is string => typeof item === 'string' && item.length > 0,
  );

  const hasBasicContent =
    Boolean(story) || tailwinds.length > 0 || businessExposure.length > 0;
  const showReportShell = Boolean(analysis) || loadingBasic || loadingMore || hasBasicContent;
  const isSearching = loadingBasic && !hasBasicContent;
  const loadError = refreshError || basicStream.error?.message || extendedStream.error?.message;

  const onRefresh = () => {
    if (!normalizedTicker) return;
    if (extendedFetched) {
      businessAnalysisLog.ui('extended-submit-refresh', { ticker: normalizedTicker });
      void runExtendedSubmit({
        ticker: normalizedTicker,
        companyName,
        detailLevel: 'extended',
        refresh: true,
      });
      return;
    }
    businessAnalysisLog.ui('basic-submit-refresh', { ticker: normalizedTicker });
    void runBasicSubmit({
      ticker: normalizedTicker,
      companyName,
      detailLevel: 'basic',
      refresh: true,
    });
  };

  const onLoadMore = () => {
    if (!normalizedTicker) return;
    businessAnalysisLog.ui('extended-submit-load-more', { ticker: normalizedTicker });
    void runExtendedSubmit({
      ticker: normalizedTicker,
      companyName,
      detailLevel: 'extended',
      refresh: false,
    });
  };

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
            <button
              type="button"
              onClick={onRefresh}
              disabled={loadingBasic || loadingMore}
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/20 bg-white/5 px-2.5 py-1 text-xs font-semibold text-gray-200 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loadingBasic || loadingMore ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
              ) : (
                <RefreshCcw className="h-3.5 w-3.5" aria-hidden />
              )}
              Refresh
            </button>
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
          ) : loadError && !showReportShell ? (
            <div className="flex items-start gap-2 rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 text-sm text-amber-100">
              <AlertTriangle
                className="mt-0.5 h-4 w-4 shrink-0 text-amber-400"
                aria-hidden
              />
              <div className="space-y-2">
                <p>{loadError}</p>
                <button
                  type="button"
                  onClick={onRefresh}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-300 hover:underline"
                >
                  <RefreshCcw className="h-3 w-3" aria-hidden /> Try again
                </button>
              </div>
            </div>
          ) : showReportShell ? (
            <div className="space-y-3 rounded-xl border border-white/10 bg-[#11141b] p-3 text-sm leading-relaxed text-gray-200">
              {isSearching ? (
                <div className="flex items-center gap-2 rounded-lg border border-purple-400/20 bg-purple-500/5 px-3 py-2 text-xs text-purple-200">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                  Searching recent news and sector context…
                </div>
              ) : null}
              <section>
                <h3 className="text-xs font-bold uppercase tracking-wide text-purple-300">Story</h3>
                <div className="mt-2">
                  {story ? (
                    <span className="inline-flex rounded-full border border-fuchsia-400/35 bg-fuchsia-500/10 px-2.5 py-1 text-[11px] font-semibold text-fuchsia-200">
                      {story}
                    </span>
                  ) : loadingBasic ? (
                    <span className="inline-flex items-center gap-1.5 text-xs text-gray-500">
                      <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
                      Finding story...
                    </span>
                  ) : (
                    <span className="text-xs text-gray-500">No clear story</span>
                  )}
                </div>
              </section>
              <section>
                <h3 className="text-xs font-bold uppercase tracking-wide text-purple-300">Tailwinds</h3>
                <div className="mt-2 flex flex-wrap gap-2">
                  {tailwinds.map((item: string) => (
                    <span
                      key={`tailwind-${item}`}
                      className="rounded-md border border-emerald-400/25 bg-emerald-500/10 px-2 py-1 text-[11px] text-emerald-100"
                    >
                      {item}
                    </span>
                  ))}
                  {tailwinds.length === 0 && loadingBasic ? (
                    <span className="inline-flex items-center gap-1.5 text-xs text-gray-500">
                      <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
                      Scanning tailwinds...
                    </span>
                  ) : null}
                  {tailwinds.length === 0 && !loadingBasic ? (
                    <span className="text-xs text-gray-500">No meaningful tailwinds found.</span>
                  ) : null}
                </div>
              </section>
              <section>
                <h3 className="text-xs font-bold uppercase tracking-wide text-purple-300">Business Exposure</h3>
                <div className="mt-2 flex flex-wrap gap-2">
                  {businessExposure.map((item: string) => (
                    <span
                      key={`exposure-${item}`}
                      className="rounded-md border border-cyan-400/25 bg-cyan-500/10 px-2 py-1 text-[11px] text-cyan-100"
                    >
                      {item}
                    </span>
                  ))}
                  {businessExposure.length === 0 && loadingBasic ? (
                    <span className="inline-flex items-center gap-1.5 text-xs text-gray-500">
                      <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
                      Mapping exposure...
                    </span>
                  ) : null}
                  {businessExposure.length === 0 && !loadingBasic ? (
                    <span className="text-xs text-gray-500">No direct exposure found.</span>
                  ) : null}
                </div>
              </section>
              {showExtended ? (
                <>
                  <section>
                    <h3 className="text-xs font-bold uppercase tracking-wide text-purple-300">Business Strength</h3>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {businessStrength.map((item: string) => (
                        <span
                          key={`strength-${item}`}
                          className="rounded-md border border-violet-400/25 bg-violet-500/10 px-2 py-1 text-[11px] text-violet-100"
                        >
                          {item}
                        </span>
                      ))}
                      {businessStrength.length === 0 && loadingMore ? (
                        <span className="inline-flex items-center gap-1.5 text-xs text-gray-500">
                          <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
                          Evaluating strengths...
                        </span>
                      ) : null}
                      {businessStrength.length === 0 && !loadingMore ? (
                        <span className="text-xs text-gray-500">No unique proposition identified.</span>
                      ) : null}
                    </div>
                  </section>
                  <section>
                    <h3 className="text-xs font-bold uppercase tracking-wide text-purple-300">Recent Transformations</h3>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {recentTransformations.map((item: string) => (
                        <span
                          key={`transform-${item}`}
                          className="rounded-md border border-blue-400/25 bg-blue-500/10 px-2 py-1 text-[11px] text-blue-100"
                        >
                          {item}
                        </span>
                      ))}
                      {recentTransformations.length === 0 && loadingMore ? (
                        <span className="inline-flex items-center gap-1.5 text-xs text-gray-500">
                          <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
                          Checking recent moves...
                        </span>
                      ) : null}
                      {recentTransformations.length === 0 && !loadingMore ? (
                        <span className="text-xs text-gray-500">No major transformation detected recently.</span>
                      ) : null}
                    </div>
                  </section>
                  <section>
                    <h3 className="text-xs font-bold uppercase tracking-wide text-purple-300">Proof</h3>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {proof.map((item: string) => (
                        <span
                          key={`proof-${item}`}
                          className="rounded-md border border-amber-400/25 bg-amber-500/10 px-2 py-1 text-[11px] text-amber-100"
                        >
                          {item}
                        </span>
                      ))}
                      {proof.length === 0 && loadingMore ? (
                        <span className="inline-flex items-center gap-1.5 text-xs text-gray-500">
                          <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
                          Gathering proof...
                        </span>
                      ) : null}
                      {proof.length === 0 && !loadingMore ? (
                        <span className="text-xs text-gray-500">No evidence found.</span>
                      ) : null}
                    </div>
                  </section>
                </>
              ) : (
                <section>
                  <button
                    type="button"
                    onClick={onLoadMore}
                    disabled={loadingMore}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-violet-400/30 bg-violet-500/10 px-3 py-2.5 text-sm font-semibold text-violet-100 transition hover:bg-violet-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {loadingMore ? (
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                    ) : null}
                    {loadingMore ? 'Loading more insights…' : 'Show More Insights'}
                  </button>
                </section>
              )}
              {refreshError ? (
                <p className="text-xs text-amber-200">{refreshError}</p>
              ) : null}
              <p className="text-[11px] text-gray-500">
                Compact momentum extractor view for fast stock scanning.
              </p>
            </div>
          ) : null}
          <p className="mt-6 border-t border-white/10 pt-3 text-[11px] text-gray-500">
            Generated by Gemini with Google Search grounding and TradingView context — may contain inaccuracies. Not investment advice.
          </p>
        </div>
      </SheetContent>
    </Sheet>
  );
}
