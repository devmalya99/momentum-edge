import { computeTradeDecision } from '@/position-analysis/core/computeTradeDecision';
import { formatInr, formatPercentOfCapital } from '@/position-analysis/core/computePositionSizing';
import { cn } from '@/lib/utils';
import { PositionParameters } from '../types';
import React from 'react';

export function PositionSizingResults({ parameters, className }: { parameters: PositionParameters, className?: string }) {
  const decision = React.useMemo(
    () => computeTradeDecision(parameters),
    [parameters],
  );

  // 🚫 HARD STOP — no mixed states
  if (decision.decision === 'DO_NOT_TRADE') {
    return (
      <div
        data-testid="position-sizing-results-empty"
        className={cn(
          'rounded-2xl border border-amber-500/25 bg-amber-950/25 px-4 py-8 text-center text-sm text-amber-200',
          className,
        )}
      >
        ⚠ {decision.reason}
      </div>
    );
  }

  // ✅ Safe — now we KNOW it's valid
  const {
    positionSize,
    percentOfCapital,
    maxLoss,
    riskLevel,
  } = decision;

  return (
    <div data-testid="position-sizing-results" className={cn('space-y-4', className)}>
      
      {/* Decision Signal */}
      <section
        data-testid="decision-signal-card"
        className="rounded-2xl border border-emerald-500/25 bg-emerald-950/30 px-6 py-5"
      >
        <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">
          Decision signal
        </p>
        <p className="mt-2 text-sm font-medium text-emerald-300/95">
          ✔ Positive edge after costs
        </p>
      </section>

      {/* Hero */}
      <section className="rounded-2xl border border-violet-500/20 bg-violet-950/35 px-6 py-10 text-center">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-violet-300/90">
          Recommended position size
        </p>
        <p className="mt-3 text-3xl font-bold text-gray-100">
          {formatInr(positionSize)}
        </p>
        <p className="mt-2 text-base text-gray-400">
          {formatPercentOfCapital(percentOfCapital)}
        </p>
      </section>

      {/* Max Loss */}
      <section className="flex items-center justify-between rounded-2xl border border-red-500/20 bg-red-950/35 px-6 py-5">
        <span className="text-base font-medium text-gray-300">Max Loss</span>
        <span className="text-lg font-bold text-red-400">
          {formatInr(maxLoss)}
        </span>
      </section>

      {/* Risk Context (NEW — important) */}
      <section className="rounded-xl border border-white/10 px-4 py-3 text-sm text-gray-400">
        Risk Level: <span className="font-medium text-gray-200">{riskLevel}</span>
      </section>
    </div>
  );
}