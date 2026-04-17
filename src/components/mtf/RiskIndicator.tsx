import type { RiskLevel } from '@/utils/mtfCalculations';

interface RiskIndicatorProps {
  riskLevel: RiskLevel;
  expectedReturn: number;
  yearlyCost: number;
}

const RISK_STYLES: Record<RiskLevel, string> = {
  LOW: 'text-green-300 bg-green-500/10 border-green-500/30',
  MODERATE: 'text-yellow-300 bg-yellow-500/10 border-yellow-500/30',
  SEVERE: 'text-orange-300 bg-orange-500/10 border-orange-500/30',
  FATAL: 'text-red-300 bg-red-500/10 border-red-500/30',
};

export default function RiskIndicator({ riskLevel, expectedReturn, yearlyCost }: RiskIndicatorProps) {
  const showWarning = riskLevel === 'SEVERE' || riskLevel === 'FATAL';

  return (
    <div className="p-6 rounded-3xl bg-white/5 border border-white/10 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-bold uppercase tracking-widest text-purple-300">Risk Engine</h3>
        <span className={`px-3 py-1 rounded-full text-xs font-bold border ${RISK_STYLES[riskLevel]}`}>
          {riskLevel} RISK
        </span>
      </div>

      <p className="text-sm text-gray-400">
        Expected return (10%) is compared against yearly leverage cost to classify margin stress.
      </p>

      {showWarning ? (
        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          Warning: Financing cost is heavily consuming your projected returns. Reduce leverage or
          improve expected edge before increasing position size.
        </div>
      ) : null}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="p-4 rounded-2xl bg-[#0a0a0b] border border-white/5">
          <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-1">
            Expected Return (Annual)
          </div>
          <div className="text-lg font-bold">₹{expectedReturn.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</div>
        </div>
        <div className="p-4 rounded-2xl bg-[#0a0a0b] border border-white/5">
          <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-1">
            Yearly Interest Burden
          </div>
          <div className="text-lg font-bold">₹{yearlyCost.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</div>
        </div>
      </div>
    </div>
  );
}
