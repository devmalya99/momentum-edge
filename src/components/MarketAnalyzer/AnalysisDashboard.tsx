'use client';

/**
 * Presentation-only Market Analyzer panel.
 * Parent (MarketView) owns fetch, synthesis, and hook orchestration.
 */

import { BarChart3, Loader2 } from 'lucide-react';
import { IndexScoreSelect } from '@/components/MarketAnalyzer/IndexScoreSelect';
import { useIndexScoreCatalogQuery } from '@/features/market-analyzer/query/use-index-score-catalog-query';
import type { IndexAnalyzerResult, MarketVerdict, TargetIndex } from '@/types/marketAnalyzer';
import type { PortfolioExposureState } from '@/hooks/useMarketAnalyzer';

export type AnalysisDashboardProps = {
  selectedIndex: TargetIndex;
  onIndexChange: (index: TargetIndex) => void;
  onAnalyze: () => void;
  loading: boolean;
  error: string | null;
  indexResult: IndexAnalyzerResult | null;
  portfolioExposure: PortfolioExposureState | null;
  portfolioLoading: boolean;
  portfolioError: string | null;
};

const VERDICT_STYLES: Record<MarketVerdict, string> = {
  Breakdown: 'bg-rose-950 border-rose-800 text-rose-400',
  Grinding: 'bg-orange-950 border-orange-800 text-orange-400',
  Transition: 'bg-amber-950 border-amber-800 text-amber-400',
  'Stage 2': 'bg-blue-950 border-blue-800 text-blue-400',
  Momentum: 'bg-emerald-950 border-emerald-800 text-emerald-400',
  'Extreme Alignment': 'bg-fuchsia-950 border-fuchsia-800 text-fuchsia-400',
};

function MetricBlock({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-[#0a0a0b] px-4 py-4">
      <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500">{label}</p>
      <p className="mt-2 text-2xl font-black tabular-nums text-gray-100">{value}</p>
      {sub ? <p className="mt-1 text-[11px] text-gray-500">{sub}</p> : null}
    </div>
  );
}

export function AnalysisDashboard({
  selectedIndex,
  onIndexChange,
  onAnalyze,
  loading,
  error,
  indexResult,
  portfolioExposure,
  portfolioLoading,
  portfolioError,
}: AnalysisDashboardProps) {
  const {
    scores,
    groups,
    warming: scoresWarming,
    scoredCount,
    totalIndexes,
  } = useIndexScoreCatalogQuery();

  const verdictStyle = indexResult ? VERDICT_STYLES[indexResult.verdict] : '';
  const showResults = indexResult || portfolioExposure || portfolioLoading;

  return (
    <section className="p-8 rounded-3xl bg-[#161618] border border-white/5 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h2 className="text-sm font-bold text-gray-500 uppercase tracking-widest flex items-center gap-2">
            <BarChart3 className="text-violet-400" size={16} />
            Market Analyzer
          </h2>
          <p className="text-xs text-gray-500 mt-1 max-w-xl">
            Portfolio exposure is set once per day from macro data. Index analysis updates position
            size and verdict when you change the index.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-xs text-gray-400">
            <span className="font-bold uppercase tracking-wide whitespace-nowrap">Index</span>
            <IndexScoreSelect
              selectedIndex={selectedIndex}
              onSelect={onIndexChange}
              disabled={loading}
              groups={groups}
              scores={scores}
              warming={scoresWarming}
              scoredCount={scoredCount}
              totalIndexes={totalIndexes}
            />
          </label>

          <button
            type="button"
            onClick={onAnalyze}
            disabled={loading}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-violet-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Analyzing Matrix…
              </>
            ) : (
              'Analyse Market'
            )}
          </button>
        </div>
      </div>

      {portfolioError ? (
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3 text-sm text-amber-200">
          Portfolio exposure: {portfolioError}
        </div>
      ) : null}

      {error ? (
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3 text-sm text-amber-200">
          {error}
        </div>
      ) : null}

      {portfolioLoading && !portfolioExposure ? (
        <div className="rounded-2xl border border-white/10 bg-[#0a0a0b] px-4 py-5 flex items-center gap-3 text-sm text-gray-400">
          <Loader2 size={18} className="animate-spin text-violet-400" />
          Loading today&apos;s portfolio exposure…
        </div>
      ) : null}

      {portfolioExposure ? (
        <div className="rounded-2xl border border-violet-500/25 bg-violet-500/5 px-5 py-5">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-violet-300/80">
                Total portfolio exposure
              </p>
              <p className="mt-1 text-[11px] text-gray-500">
                Macro view · cached for {portfolioExposure.asOf}
                {portfolioExposure.fromCache ? ' (saved today)' : ''}
              </p>
            </div>
            <p className="text-4xl font-black tabular-nums text-violet-100">
              {portfolioExposure.equityExposure}
            </p>
          </div>
          <p className="mt-3 text-sm text-gray-300 leading-relaxed">{portfolioExposure.summary}</p>
        </div>
      ) : null}

      {indexResult ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="space-y-3">
            <MetricBlock
              label="Position size"
              value={indexResult.positionSizingGuidance}
              sub={`For ${selectedIndex.replace(/_/g, ' ')}`}
            />
            <div
              className={`rounded-2xl border px-4 py-4 text-center ${verdictStyle}`}
              role="status"
            >
              <p className="text-[10px] font-bold uppercase tracking-widest opacity-80">
                Market verdict
              </p>
              <p className="mt-2 text-3xl font-black">{indexResult.verdict}</p>
            </div>
          </div>

          <div className="lg:col-span-2 rounded-2xl border border-white/10 bg-[#0a0a0b] p-4 sm:p-5 overflow-hidden flex flex-col min-h-48">
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-3">
              Desk rationale
            </p>
            <p className="text-sm text-gray-300 leading-relaxed overflow-y-auto max-h-64 pr-1">
              {indexResult.explanation}
            </p>
          </div>
        </div>
      ) : showResults ? null : (
        <p className="text-sm text-gray-500">
          Select an index and run analysis. Portfolio exposure loads once per trading day.
        </p>
      )}
    </section>
  );
}
