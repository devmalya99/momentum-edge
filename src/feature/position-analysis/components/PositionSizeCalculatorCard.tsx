'use client';

import * as React from 'react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  computeRiskPositionSize,
  MAX_RISK_PERCENT,
} from '@/position-analysis/core/computeRiskPositionSize';

const CAPITAL_STORAGE_KEY = 'position-size-calculator-capital';

function parseOptionalNum(raw: string): number {
  const cleaned = raw.trim().replace(/,/g, '');
  if (cleaned === '' || cleaned === '-') return 0;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatInr(value: number): string {
  return `₹${new Intl.NumberFormat('en-IN', {
    maximumFractionDigits: 0,
  }).format(Math.round(value))}`;
}

export function PositionSizeCalculatorCard() {
  const [capital, setCapital] = React.useState(100000);
  const [riskPercent, setRiskPercent] = React.useState(1);
  const [stopLossPercent, setStopLossPercent] = React.useState(3);
  const [entryPrice, setEntryPrice] = React.useState<number | ''>('');

  React.useEffect(() => {
    const saved = window.localStorage.getItem(CAPITAL_STORAGE_KEY);
    if (!saved) return;
    const parsed = Number(saved);
    if (Number.isFinite(parsed) && parsed > 0) {
      setCapital(parsed);
    }
  }, []);

  React.useEffect(() => {
    if (capital > 0) {
      window.localStorage.setItem(CAPITAL_STORAGE_KEY, String(capital));
    }
  }, [capital]);

  const result = React.useMemo(
    () =>
      computeRiskPositionSize({
        capital,
        riskPercent,
        stopLossPercent,
        entryPrice: entryPrice === '' ? undefined : entryPrice,
      }),
    [capital, riskPercent, stopLossPercent, entryPrice],
  );

  return (
    <Card data-testid="position-size-calculator-card" className="border-white/10 bg-[#161618] text-gray-100">
      <CardHeader className="border-b border-white/10">
        <CardTitle className="text-lg">Position Size Calculator</CardTitle>
        <p className="text-sm text-gray-400">Know your max buy size in seconds without breaking risk rules.</p>
      </CardHeader>

      <CardContent className="space-y-6 pt-5">
        <section className="space-y-4">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Inputs</p>

          <div className="space-y-2">
            <Label htmlFor="psc-capital">Trading Capital (₹)</Label>
            <Input
              id="psc-capital"
              inputMode="decimal"
              value={capital}
              onChange={(e) => setCapital(parseOptionalNum(e.target.value))}
              className="border-white/10 bg-[#0a0a0b]"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-4">
              <Label htmlFor="psc-risk-slider">Risk per Trade (%)</Label>
              <Input
                id="psc-risk-input"
                inputMode="decimal"
                value={riskPercent}
                onChange={(e) => setRiskPercent(parseOptionalNum(e.target.value))}
                className="h-9 w-24 border-white/10 bg-[#0a0a0b] text-right"
              />
            </div>
            <input
              id="psc-risk-slider"
              type="range"
              min={0.25}
              max={2}
              step={0.25}
              value={Math.min(Math.max(riskPercent, 0.25), 2)}
              onChange={(e) => setRiskPercent(Number(e.target.value))}
              className="w-full accent-violet-500"
            />
            <p className="text-xs text-gray-500">Suggested range: 0.25% to 2%</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="psc-stop-loss">Stop Loss (%)</Label>
            <Input
              id="psc-stop-loss"
              inputMode="decimal"
              value={stopLossPercent}
              onChange={(e) => setStopLossPercent(parseOptionalNum(e.target.value))}
              className="border-white/10 bg-[#0a0a0b]"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="psc-entry-price">Entry Price (optional, ₹)</Label>
            <Input
              id="psc-entry-price"
              inputMode="decimal"
              value={entryPrice}
              onChange={(e) => {
                const next = e.target.value.trim();
                setEntryPrice(next === '' ? '' : parseOptionalNum(next));
              }}
              className="border-white/10 bg-[#0a0a0b]"
            />
          </div>
        </section>

        <section className="space-y-4 rounded-xl border border-violet-500/20 bg-violet-950/30 p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-violet-300/90">Output</p>

          {result ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-400">Risk Amount</span>
                <span className="font-semibold text-gray-100">{formatInr(result.riskAmount)}</span>
              </div>

              <div className="rounded-lg border border-violet-400/30 bg-black/20 p-3 text-center">
                <p className="text-xs uppercase tracking-wide text-violet-200/80">Position Size</p>
                <p className="mt-1 text-3xl font-bold leading-none text-white">
                  {formatInr(result.positionSize)}
                </p>
              </div>

              {result.quantity !== null ? (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-400">Quantity</span>
                  <span className="font-semibold text-gray-100">{Math.floor(result.quantity)}</span>
                </div>
              ) : null}

              <div className="space-y-1 text-xs text-gray-400">
                <p>If SL hits: you lose {formatInr(result.stopLossHitLoss)}</p>
                <p>
                  10 consecutive losses: -{formatInr(result.tenLossDrawdownAmount)} (-
                  {result.tenLossDrawdownPercent.toFixed(1)}%)
                </p>
              </div>

              {result.isRiskCapped ? (
                <p className="text-xs text-amber-300">
                  Risk is capped at {MAX_RISK_PERCENT}%. Entered value was reduced automatically.
                </p>
              ) : null}

              {result.exceedsCapital ? (
                <p className="text-sm font-medium text-red-300">Position exceeds available capital</p>
              ) : null}
            </div>
          ) : (
            <p className="text-sm text-amber-200">
              Enter valid inputs. Stop loss must be greater than 0 and capital/risk must be positive.
            </p>
          )}
        </section>
      </CardContent>
    </Card>
  );
}
