'use client';

import { useEffect, useMemo, useState } from 'react';
import SliderInput from '@/components/mtf/SliderInput';
import CostDisplay from '@/components/mtf/CostDisplay';
import RiskIndicator from '@/components/mtf/RiskIndicator';
import { useMTFCalculator } from '@/hooks/useMTFCalculator';
import { formatInr } from '@/lib/format-inr';
import { useQuery } from '@tanstack/react-query';

const MIN_MARGIN = 10_000;
const DEFAULT_INTEREST_RATE = 16;
const EXPECTED_RETURN_RATE = 10;
const SLIDER_DEBOUNCE_MS = 120;

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedValue(value), delayMs);
    return () => window.clearTimeout(timeout);
  }, [value, delayMs]);

  return debouncedValue;
}

export default function MtfChecker() {
  const networthMasterQuery = useQuery({
    queryKey: ['networth-master'],
    queryFn: async () => {
      const res = await fetch('/api/networth/master', { cache: 'no-store' });
      if (!res.ok) throw new Error('Failed to fetch networth master');
      const body = (await res.json()) as {
        master: {
          totalInvested: number;
          currentHoldingValue: number;
          marginAmount: number;
        };
      };
      return body.master;
    },
    retry: 1,
  });

  const master = networthMasterQuery.data;
  const totalInvestedGross = Math.max(0, Number(master?.totalInvested ?? 0));
  const marginOnRecord = Math.max(0, Number(master?.marginAmount ?? 0));
  /** Own capital = gross holdings cost minus margin (borrowed). */
  const ownCapitalFromMaster = Math.max(0, totalInvestedGross - marginOnRecord);
  const hasMasterHoldings = totalInvestedGross > 0;

  const [manualOwnCapital, setManualOwnCapital] = useState(MIN_MARGIN);
  const [marginRaw, setMarginRaw] = useState(MIN_MARGIN);
  const [interestRate, setInterestRate] = useState(DEFAULT_INTEREST_RATE);
  const [seededMarginFromMaster, setSeededMarginFromMaster] = useState(false);

  const ownCapitalBase = hasMasterHoldings
    ? Math.max(MIN_MARGIN, ownCapitalFromMaster)
    : Math.max(MIN_MARGIN, Number(manualOwnCapital) || 0);

  const maxMargin = Math.max(MIN_MARGIN, ownCapitalBase * 3);

  useEffect(() => {
    setMarginRaw((m) => clamp(m, MIN_MARGIN, maxMargin));
  }, [maxMargin]);

  useEffect(() => {
    if (seededMarginFromMaster) return;
    if (!master) return;
    const m = Math.max(0, Number(master.marginAmount ?? 0));
    if (m <= 0) {
      setSeededMarginFromMaster(true);
      return;
    }
    setMarginRaw(clamp(m, MIN_MARGIN, maxMargin));
    setSeededMarginFromMaster(true);
  }, [master, maxMargin, seededMarginFromMaster]);

  const marginDebounced = useDebouncedValue(marginRaw, SLIDER_DEBOUNCE_MS);

  const totalInvestedForCalc = ownCapitalBase + marginDebounced;
  const marginPercentOnExposure =
    totalInvestedForCalc > 0 ? (marginDebounced / totalInvestedForCalc) * 100 : 0;

  const metrics = useMTFCalculator({
    totalInvested: Math.max(MIN_MARGIN, totalInvestedForCalc),
    marginPercent: clamp(marginPercentOnExposure, 0, 95),
    annualInterestRate: interestRate,
    expectedAnnualReturnRate: EXPECTED_RETURN_RATE,
  });

  const marginPctOfOwnCapital =
    ownCapitalBase > 0 ? (marginDebounced / ownCapitalBase) * 100 : 0;

  const detailRows = useMemo(
    () => [
      { label: 'Margin amount (slider)', value: formatInr(marginDebounced) },
      { label: 'Own capital (total_invested − margin)', value: formatInr(ownCapitalBase) },
      {
        label: 'Margin % on own capital',
        value: `${marginPctOfOwnCapital.toFixed(2)}%`,
      },
    ],
    [marginDebounced, ownCapitalBase, marginPctOfOwnCapital],
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-black text-white">MTF Checker</h1>
        <p className="mt-2 text-sm text-gray-400">
          Slider is margin borrowed (₹). Max is 3× your own capital (gross holdings cost minus margin
          on file). Interest cost applies to the margin amount.
        </p>
        {hasMasterHoldings ? (
          <p className="mt-2 text-xs text-cyan-400/90">
            From balance sheet: <span className="font-mono">total_invested</span>{' '}
            {formatInr(totalInvestedGross)} (gross), own capital {formatInr(ownCapitalFromMaster)}.
          </p>
        ) : (
          <p className="mt-2 text-xs text-amber-400/90">
            No holdings master row yet. Enter your own capital below so the slider range can be set
            (max = 3× that amount).
          </p>
        )}
      </div>

      {!hasMasterHoldings ? (
        <label className="block p-4 rounded-2xl bg-white/5 border border-white/10">
          <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-2">
            Your own capital (₹)
          </div>
          <input
            type="number"
            min={MIN_MARGIN}
            step={1000}
            value={manualOwnCapital}
            onChange={(e) => {
              const n = Number(e.target.value);
              setManualOwnCapital(
                Number.isFinite(n) && n >= MIN_MARGIN ? n : MIN_MARGIN,
              );
            }}
            className="w-full bg-[#0a0a0b] border border-white/10 rounded-xl px-3 py-2 text-sm outline-none focus:border-cyan-500/60"
          />
        </label>
      ) : null}

      <SliderInput
        value={marginRaw}
        min={MIN_MARGIN}
        max={maxMargin}
        step={1000}
        onChange={setMarginRaw}
        title="Margin used (₹)"
        hint={`Up to ${formatInr(maxMargin)} (3× own capital ${formatInr(ownCapitalBase)})`}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="p-4 rounded-2xl bg-white/5 border border-white/10">
          <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-2">
            Annual interest rate (%)
          </div>
          <input
            type="number"
            min={0}
            max={60}
            step={0.1}
            value={interestRate}
            onChange={(event) => setInterestRate(clamp(Number(event.target.value) || 0, 0, 60))}
            className="w-full bg-[#0a0a0b] border border-white/10 rounded-xl px-3 py-2 text-sm outline-none focus:border-cyan-500/60"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {detailRows.map((row) => (
          <div key={row.label} className="p-5 rounded-2xl bg-white/5 border border-white/10">
            <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-2">
              {row.label}
            </div>
            <div className="text-xl font-black text-white">{row.value}</div>
          </div>
        ))}
      </div>

      <CostDisplay
        dailyCost={metrics.dailyCost}
        weeklyCost={metrics.weeklyCost}
        monthlyCost={metrics.monthlyCost}
        yearlyCost={metrics.yearlyCost}
      />

      <RiskIndicator
        riskLevel={metrics.riskLevel}
        expectedReturn={metrics.expectedReturn}
        yearlyCost={metrics.yearlyCost}
      />
    </div>
  );
}
