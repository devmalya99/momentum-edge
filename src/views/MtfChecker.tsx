'use client';

import * as React from 'react';

import { ParametersCard } from '@/position-analysis/components/ParametersCard';
import { PositionSizeCalculatorCard } from '@/position-analysis/components/PositionSizeCalculatorCard';
import { PositionSizingResults } from '@/position-analysis/components/PositionSizingResults';
import type { PositionParameters } from '@/position-analysis/types';

export default function MtfChecker() {
  const [savedParameters, setSavedParameters] = React.useState<PositionParameters | null>(null);

  return (
    <div className="space-y-8">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight text-gray-100">Position Size Analysis</h1>
        <p className="text-sm text-gray-400">
          Configure simulation parameters, save, and review recommended size and risk.
        </p>
      </header>

      <div className="grid gap-8 lg:grid-cols-2">
        <div className="mx-auto w-full max-w-lg space-y-8 lg:mx-0 lg:max-w-none">
          <ParametersCard onSave={(p) => setSavedParameters(p)} />

          {savedParameters ? (
            <div className="space-y-2">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Results</h2>
              <PositionSizingResults parameters={savedParameters} />
            </div>
          ) : (
            <p className="text-sm text-gray-500">
              Save your simulation to see recommended position size and max loss.
            </p>
          )}
        </div>

        <div className="mx-auto w-full max-w-lg lg:mx-0 lg:max-w-none">
          <PositionSizeCalculatorCard />
        </div>
      </div>
    </div>
  );
}
