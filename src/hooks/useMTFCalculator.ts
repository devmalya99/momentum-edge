import { useMemo } from 'react';
import { calculateMtfMetrics, type MtfResult } from '@/utils/mtfCalculations';

interface UseMtfCalculatorInput {
  totalInvested: number;
  marginPercent: number;
  annualInterestRate: number;
  expectedAnnualReturnRate: number;
}

export function useMTFCalculator(input: UseMtfCalculatorInput): MtfResult {
  return useMemo(
    () =>
      calculateMtfMetrics({
        totalInvested: input.totalInvested,
        marginPercent: input.marginPercent,
        annualInterestRate: input.annualInterestRate,
        expectedAnnualReturnRate: input.expectedAnnualReturnRate,
      }),
    [
      input.totalInvested,
      input.marginPercent,
      input.annualInterestRate,
      input.expectedAnnualReturnRate,
    ],
  );
}
