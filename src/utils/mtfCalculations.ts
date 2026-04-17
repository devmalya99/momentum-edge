export type RiskLevel = 'LOW' | 'MODERATE' | 'SEVERE' | 'FATAL';

export interface MtfInput {
  totalInvested: number;
  marginPercent: number;
  annualInterestRate: number;
  expectedAnnualReturnRate: number;
}

export interface MtfResult {
  marginAmount: number;
  actualInvestedAmount: number;
  marginPercentOfTotal: number;
  dailyCost: number;
  weeklyCost: number;
  monthlyCost: number;
  yearlyCost: number;
  expectedReturn: number;
  riskLevel: RiskLevel;
}

export function toDecimalFromPercent(percent: number): number {
  return percent / 100;
}

export function calculateMarginAmount(totalInvested: number, marginPercent: number): number {
  return totalInvested * toDecimalFromPercent(marginPercent);
}

export function calculateActualInvestedAmount(
  totalInvested: number,
  marginAmount: number,
): number {
  return totalInvested - marginAmount;
}

export function calculateInterestCosts(marginAmount: number, annualInterestRate: number) {
  const annualRate = toDecimalFromPercent(annualInterestRate);
  const dailyCost = (marginAmount * annualRate) / 365;

  return {
    dailyCost,
    weeklyCost: dailyCost * 7,
    monthlyCost: dailyCost * 30,
    yearlyCost: marginAmount * annualRate,
  };
}

export function classifyMtfRisk(expectedReturn: number, yearlyCost: number): RiskLevel {
  if (expectedReturn >= 2 * yearlyCost) return 'LOW';
  if (expectedReturn >= yearlyCost) return 'MODERATE';
  if (expectedReturn >= 0.5 * yearlyCost) return 'SEVERE';
  return 'FATAL';
}

export function calculateMtfMetrics(input: MtfInput): MtfResult {
  const marginAmount = calculateMarginAmount(input.totalInvested, input.marginPercent);
  const actualInvestedAmount = calculateActualInvestedAmount(input.totalInvested, marginAmount);
  const marginPercentOfTotal = input.totalInvested > 0 ? (marginAmount / input.totalInvested) * 100 : 0;
  const { dailyCost, weeklyCost, monthlyCost, yearlyCost } = calculateInterestCosts(
    marginAmount,
    input.annualInterestRate,
  );
  const expectedReturn =
    input.totalInvested * toDecimalFromPercent(input.expectedAnnualReturnRate);
  const riskLevel = classifyMtfRisk(expectedReturn, yearlyCost);

  return {
    marginAmount,
    actualInvestedAmount,
    marginPercentOfTotal,
    dailyCost,
    weeklyCost,
    monthlyCost,
    yearlyCost,
    expectedReturn,
    riskLevel,
  };
}
