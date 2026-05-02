'use client';

import * as React from 'react';
import { SlidersHorizontal, Wallet, Save } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { cn } from '@/lib/utils';
import { defaultPositionParameters, inputSchema } from '@/position-analysis/schema/inputSchema';
import type { PositionParameters } from '@/position-analysis/types';

export interface ParametersCardProps {
  className?: string;
  initialValues?: Partial<PositionParameters>;
  onSave?: (values: PositionParameters) => void;
}

function formatNum(n: number): string {
  if (!Number.isFinite(n)) return '';
  return String(n);
}

function parseOptionalNum(raw: string): number {
  const t = raw.trim().replace(/,/g, '');
  if (t === '' || t === '-') return 0;
  const n = Number(t);
  return Number.isFinite(n) ? n : 0;
}

export function ParametersCard({ className, initialValues, onSave }: ParametersCardProps) {
  const [values, setValues] = React.useState<PositionParameters>(() => ({
    ...defaultPositionParameters,
    ...initialValues,
  }));
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>({});
  const [saveError, setSaveError] = React.useState<string | null>(null);

  const stopLossToggleValue = React.useMemo(
    () => [values.stopLossModel] as ['percent'] | ['absolute'],
    [values.stopLossModel],
  );

  const handleSave = () => {
    setSaveError(null);
    setFieldErrors({});
    const result = inputSchema.safeParse(values);
    if (!result.success) {
      const next: Record<string, string> = {};
      for (const issue of result.error.issues) {
        const key = issue.path.join('.') || '_root';
        if (!next[key]) next[key] = issue.message;
      }
      setFieldErrors(next);
      setSaveError('Please fix the highlighted fields.');
      return;
    }
    onSave?.(result.data);
  };

  return (
    <div
      data-testid="parameters-card"
      className={cn(
        'rounded-2xl border border-white/10 bg-[#121214] p-4 shadow-lg shadow-black/40',
        className,
      )}
    >
      <Card className="border-white/10 bg-[#161618] text-gray-100 shadow-none ring-1 ring-white/5">
        <CardHeader className="border-b border-white/10 pb-4">
          <div className="flex items-start gap-3">
            <div
              className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-violet-600 text-white shadow-sm ring-1 ring-violet-400/30"
              aria-hidden
            >
              <SlidersHorizontal className="size-5" />
            </div>
            <div className="min-w-0 space-y-1">
              <CardTitle className="text-lg font-semibold text-gray-100">Parameters</CardTitle>
              <CardDescription className="text-sm text-gray-500">
                Adjust your strategy metrics in real-time.
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-5 pt-5">
          <div className="space-y-2">
            <Label htmlFor="win-rate" className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
              Win rate % (e.g. 55)
            </Label>
            <Input
              id="win-rate"
              data-testid="input-win-rate"
              inputMode="decimal"
              className="h-10 border-white/10 bg-[#0a0a0b] text-gray-100 placeholder:text-gray-600 focus-visible:border-violet-500/50"
              value={formatNum(values.winRate)}
              onChange={(e) =>
                setValues((s) => ({ ...s, winRate: parseOptionalNum(e.target.value) }))
              }
              aria-invalid={!!fieldErrors.winRate}
            />
            {fieldErrors.winRate ? (
              <p className="text-xs text-red-400">{fieldErrors.winRate}</p>
            ) : null}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label
                htmlFor="avg-win"
                className="text-[11px] font-semibold uppercase tracking-wide text-gray-500"
              >
                ₹ Average win
              </Label>
              <Input
                id="avg-win"
                data-testid="input-average-win"
                inputMode="decimal"
                className="h-10 border-white/10 bg-[#0a0a0b] text-gray-100 placeholder:text-gray-600 focus-visible:border-violet-500/50"
                value={formatNum(values.averageWin)}
                onChange={(e) =>
                  setValues((s) => ({ ...s, averageWin: parseOptionalNum(e.target.value) }))
                }
                aria-invalid={!!fieldErrors.averageWin}
              />
              {fieldErrors.averageWin ? (
                <p className="text-xs text-red-400">{fieldErrors.averageWin}</p>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label
                htmlFor="avg-loss"
                className="text-[11px] font-semibold uppercase tracking-wide text-gray-500"
              >
                ₹ Average loss
              </Label>
              <Input
                id="avg-loss"
                data-testid="input-average-loss"
                inputMode="decimal"
                className="h-10 border-white/10 bg-[#0a0a0b] text-gray-100 placeholder:text-gray-600 focus-visible:border-violet-500/50"
                value={formatNum(values.averageLoss)}
                onChange={(e) =>
                  setValues((s) => ({ ...s, averageLoss: parseOptionalNum(e.target.value) }))
                }
                aria-invalid={!!fieldErrors.averageLoss}
              />
              {fieldErrors.averageLoss ? (
                <p className="text-xs text-red-400">{fieldErrors.averageLoss}</p>
              ) : null}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="total-capital" className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
              Total capital
            </Label>
            <div className="relative">
              <Wallet
                className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-violet-400/80"
                aria-hidden
              />
              <Input
                id="total-capital"
                data-testid="input-total-capital"
                inputMode="decimal"
                className="h-10 border-white/10 bg-[#0a0a0b] pl-10 text-gray-100 placeholder:text-gray-600 focus-visible:border-violet-500/50"
                value={formatNum(values.totalCapital)}
                onChange={(e) =>
                  setValues((s) => ({ ...s, totalCapital: parseOptionalNum(e.target.value) }))
                }
                aria-invalid={!!fieldErrors.totalCapital}
              />
            </div>
            {fieldErrors.totalCapital ? (
              <p className="text-xs text-red-400">{fieldErrors.totalCapital}</p>
            ) : null}
          </div>

          <div
            data-testid="stop-loss-section"
            className="space-y-3 rounded-xl border border-white/10 bg-zinc-900/50 p-4 ring-1 ring-white/5"
          >
            <p className="text-[11px] font-semibold uppercase tracking-wide text-violet-300/90">
              Stop-loss model for position sizing
            </p>
            <ToggleGroup
              spacing={0}
              multiple={false}
              value={stopLossToggleValue}
              onValueChange={(next) => {
                const v = next[0];
                if (v === 'percent' || v === 'absolute') {
                  setValues((s) => ({ ...s, stopLossModel: v }));
                }
              }}
              className="grid w-full grid-cols-2 gap-0 overflow-hidden rounded-lg border border-white/10 bg-zinc-950/90 p-0.5 shadow-inner"
            >
              <ToggleGroupItem
                value="percent"
                data-testid="toggle-percent-stop"
                className={cn(
                  'h-10 w-full rounded-md border-0 text-sm font-medium transition-colors',
                  'rounded-none rounded-l-md first:rounded-l-md',
                  'aria-pressed:!bg-violet-600 aria-pressed:!text-white',
                  'data-[state=on]:!bg-violet-600 data-[state=on]:!text-white data-[state=on]:shadow-sm',
                  'data-[state=on]:hover:!bg-violet-500',
                  'data-[state=off]:!bg-transparent data-[state=off]:!text-gray-400',
                  'data-[state=off]:hover:!bg-white/5 data-[state=off]:hover:!text-gray-200',
                )}
              >
                Percent stop
              </ToggleGroupItem>
              <ToggleGroupItem
                value="absolute"
                data-testid="toggle-absolute-stop"
                className={cn(
                  'h-10 w-full rounded-md border-0 text-sm font-medium transition-colors',
                  'rounded-none rounded-r-md last:rounded-r-md',
                  'aria-pressed:!bg-violet-600 aria-pressed:!text-white',
                  'data-[state=on]:!bg-violet-600 data-[state=on]:!text-white data-[state=on]:shadow-sm',
                  'data-[state=on]:hover:!bg-violet-500',
                  'data-[state=off]:!bg-transparent data-[state=off]:!text-gray-400',
                  'data-[state=off]:hover:!bg-white/5 data-[state=off]:hover:!text-gray-200',
                )}
              >
                Absolute stop
              </ToggleGroupItem>
            </ToggleGroup>

            <div className="space-y-2">
              <Label
                htmlFor="stop-loss-field"
                className="text-[11px] font-semibold uppercase tracking-wide text-gray-500"
              >
                {values.stopLossModel === 'percent'
                  ? 'Stop loss % (e.g. 3 for 3%)'
                  : 'Stop loss ₹ (absolute amount)'}
              </Label>
              <Input
                id="stop-loss-field"
                data-testid="input-stop-loss"
                inputMode="decimal"
                className="h-10 border-white/10 bg-[#0a0a0b] text-gray-100 placeholder:text-gray-600 focus-visible:border-violet-500/50"
                value={
                  values.stopLossModel === 'percent'
                    ? formatNum(values.stopLossPercent)
                    : formatNum(values.stopLossAbsolute)
                }
                onChange={(e) => {
                  const n = parseOptionalNum(e.target.value);
                  setValues((s) =>
                    s.stopLossModel === 'percent'
                      ? { ...s, stopLossPercent: n }
                      : { ...s, stopLossAbsolute: n },
                  );
                }}
                aria-invalid={
                  !!(values.stopLossModel === 'percent'
                    ? fieldErrors.stopLossPercent
                    : fieldErrors.stopLossAbsolute)
                }
              />
              {values.stopLossModel === 'percent' && fieldErrors.stopLossPercent ? (
                <p className="text-xs text-red-400">{fieldErrors.stopLossPercent}</p>
              ) : null}
              {values.stopLossModel === 'absolute' && fieldErrors.stopLossAbsolute ? (
                <p className="text-xs text-red-400">{fieldErrors.stopLossAbsolute}</p>
              ) : null}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label
                htmlFor="fees"
                className="text-[11px] font-semibold uppercase tracking-wide text-gray-500"
              >
                Fees per trade
              </Label>
              <Input
                id="fees"
                data-testid="input-fees"
                inputMode="decimal"
                className="h-10 border-white/10 bg-[#0a0a0b] text-gray-100 placeholder:text-gray-600 focus-visible:border-violet-500/50"
                value={formatNum(values.feesPerTrade)}
                onChange={(e) =>
                  setValues((s) => ({ ...s, feesPerTrade: parseOptionalNum(e.target.value) }))
                }
                aria-invalid={!!fieldErrors.feesPerTrade}
              />
              {fieldErrors.feesPerTrade ? (
                <p className="text-xs text-red-400">{fieldErrors.feesPerTrade}</p>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label
                htmlFor="tax"
                className="text-[11px] font-semibold uppercase tracking-wide text-gray-500"
              >
                % Tax rate (e.g. 2 or 0.02 for 0.02%)
              </Label>
              <Input
                id="tax"
                data-testid="input-tax-rate"
                inputMode="decimal"
                className="h-10 border-white/10 bg-[#0a0a0b] text-gray-100 placeholder:text-gray-600 focus-visible:border-violet-500/50"
                value={formatNum(values.taxRate)}
                onChange={(e) =>
                  setValues((s) => ({ ...s, taxRate: parseOptionalNum(e.target.value) }))
                }
                aria-invalid={!!fieldErrors.taxRate}
              />
              {fieldErrors.taxRate ? (
                <p className="text-xs text-red-400">{fieldErrors.taxRate}</p>
              ) : null}
            </div>
          </div>

          {saveError ? (
            <p className="text-sm text-red-400" role="alert">
              {saveError}
            </p>
          ) : null}
        </CardContent>

        <CardFooter className="border-t border-white/10 bg-[#141416]">
          <Button
            type="button"
            variant="secondary"
            data-testid="button-save-simulation"
            className="h-11 w-full gap-2 rounded-lg border-white/10 bg-white/5 text-gray-100 hover:bg-white/10"
            onClick={handleSave}
          >
            <Save className="size-4" />
            Save Simulation
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
