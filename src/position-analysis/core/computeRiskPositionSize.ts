export type RiskPositionSizeInput = {
  capital: number;
  riskPercent: number;
  stopLossPercent: number;
  entryPrice?: number;
};

export type RiskPositionSizeResult = {
  riskAmount: number;
  positionSize: number;
  quantity: number | null;
  effectiveRiskPercent: number;
  isRiskCapped: boolean;
  exceedsCapital: boolean;
  stopLossHitLoss: number;
  tenLossDrawdownAmount: number;
  tenLossDrawdownPercent: number;
};

export const MAX_RISK_PERCENT = 2;

export function computeRiskPositionSize(input: RiskPositionSizeInput): RiskPositionSizeResult | null {
  if (!Number.isFinite(input.capital) || input.capital <= 0) return null;
  if (!Number.isFinite(input.riskPercent) || input.riskPercent <= 0) return null;
  if (!Number.isFinite(input.stopLossPercent) || input.stopLossPercent <= 0) return null;

  const effectiveRiskPercent = Math.min(input.riskPercent, MAX_RISK_PERCENT);
  const isRiskCapped = input.riskPercent > MAX_RISK_PERCENT;

  const riskAmount = input.capital * (effectiveRiskPercent / 100);
  const positionSize = riskAmount / (input.stopLossPercent / 100);

  const hasValidEntryPrice = Number.isFinite(input.entryPrice) && (input.entryPrice ?? 0) > 0;
  const quantity = hasValidEntryPrice ? positionSize / (input.entryPrice as number) : null;

  return {
    riskAmount,
    positionSize,
    quantity,
    effectiveRiskPercent,
    isRiskCapped,
    exceedsCapital: positionSize > input.capital,
    stopLossHitLoss: riskAmount,
    tenLossDrawdownAmount: riskAmount * 10,
    tenLossDrawdownPercent: effectiveRiskPercent * 10,
  };
}
