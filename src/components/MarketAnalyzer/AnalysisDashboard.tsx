'use client';

/**
 * Presentation-only Market Analyzer panel.
 * Parent (MarketView) owns fetch, synthesis, and hook orchestration.
 */

import { BarChart3, Loader2 } from 'lucide-react';
import { TARGET_INDEX_OPTIONS, targetIndexLabel } from '@/lib/market-analyzer/index-config';
import type { AnalyzerResult, MarketVerdict, TargetIndex } from '@/types/marketAnalyzer';

export type AnalysisDashboardProps = {
  selectedIndex: TargetIndex;
  onIndexChange: (index: TargetIndex) => void;
  onAnalyze: () => void;
  loading: boolean;
  error: string | null;
  result: AnalyzerResult | null;
};

const VERDICT_STYLES: Record<MarketVerdict, string> = {
  Calm: 'bg-slate-500/20 text-slate-200 border-slate-400/30',
  Breeze: 'bg-emerald-500/20 text-emerald-200 border-emerald-400/35',
  Gale: 'bg-amber-500/20 text-amber-200 border-amber-400/35',
  Storm: 'bg-orange-500/20 text-orange-200 border-orange-400/35',
  Hurricane: 'bg-rose-500/20 text-rose-200 border-rose-400/35',
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
  result,
}: AnalysisDashboardProps) {
  const verdictStyle = result ? VERDICT_STYLES[result.verdict] : '';

  return (
    <section className="p-8 rounded-3xl bg-[#161618] border border-white/5 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h2 className="text-sm font-bold text-gray-500 uppercase tracking-widest flex items-center gap-2">
            <BarChart3 className="text-violet-400" size={16} />
            Market Analyzer
          </h2>
          <p className="text-xs text-gray-500 mt-1 max-w-xl">
            AI desk read on trend, volatility, breadth, and calendar risk — outputs position size and
            exposure guidance for the selected index.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-xs text-gray-400">
            <span className="font-bold uppercase tracking-wide whitespace-nowrap">Index</span>
            <select
              value={selectedIndex}
              onChange={(e) => onIndexChange(e.target.value as TargetIndex)}
              disabled={loading}
              aria-label="Target index for market analysis"
              className="cursor-pointer rounded-xl border border-white/10 bg-[#0a0a0b] px-3 py-2.5 text-sm font-semibold text-gray-200 outline-none transition-colors hover:border-white/20 focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/30 min-w-44 disabled:opacity-50"
            >
              {TARGET_INDEX_OPTIONS.map((idx) => (
                <option key={idx} value={idx}>
                  {targetIndexLabel(idx)}
                </option>
              ))}
            </select>
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

      {error ? (
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3 text-sm text-amber-200">
          {error}
        </div>
      ) : null}

      {result ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="space-y-3">
            <MetricBlock
              label="Position size"
              value={result.positionSizingGuidance}
              sub="Suggested allocation per mandate"
            />
            <MetricBlock
              label="Equity exposure"
              value={result.equityExposure}
              sub="Including leverage ceiling"
            />
            <div
              className={`rounded-2xl border px-4 py-4 text-center ${verdictStyle}`}
              role="status"
            >
              <p className="text-[10px] font-bold uppercase tracking-widest opacity-80">
                Market verdict
              </p>
              <p className="mt-2 text-3xl font-black">{result.verdict}</p>
            </div>
          </div>

          <div className="lg:col-span-2 rounded-2xl border border-white/10 bg-[#0a0a0b] p-4 sm:p-5 overflow-hidden flex flex-col min-h-[12rem]">
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-3">
              Desk rationale
            </p>
            <p className="text-sm text-gray-300 leading-relaxed overflow-y-auto max-h-64 pr-1">
              {result.explanation}
            </p>
          </div>
        </div>
      ) : (
        <p className="text-sm text-gray-500">
          Select an index and run analysis to receive position sizing and exposure guidance.
        </p>
      )}
    </section>
  );
}
