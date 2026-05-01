import { calculateRisk, getVerdict } from '@/utils/calculations';

export const DELIVERY_CHARGE_RATES = {
  sttRate: 0.001,
  transactionRate: 0.0000345,
  sebiRate: 0.000001,
  gstRate: 0.18,
  stampDutyRate: 0.00015,
  dpCharge: 15.93,
  deliveryBuyBrokerage: 0,
  deliverySellBrokerage: 20,
} as const;

export type MtfInputs = {
  leverage: number;
  plannedDays: number;
  annualRate: number;
};

export function roundToTick(price: number, tick: number | null): number {
  if (tick != null && tick > 0) {
    const steps = Math.round(price / tick);
    return steps * tick;
  }
  return Math.round(price * 100) / 100;
}

export function parseMtfInputs(args: {
  mtfLeverageStr: string;
  mtfPlannedDaysStr: string;
  mtfInterestRateStr: string;
  defaultAnnualRate: number;
}): MtfInputs {
  const parsedLeverage = parseFloat(args.mtfLeverageStr.replace(',', '.'));
  const leverage = Number.isFinite(parsedLeverage) ? Math.min(5, Math.max(1, parsedLeverage)) : 1;
  const parsedDays = parseInt(args.mtfPlannedDaysStr, 10);
  const plannedDays = Number.isFinite(parsedDays) ? Math.max(1, parsedDays) : 1;
  const parsedRatePercent = parseFloat(args.mtfInterestRateStr);
  const annualRate =
    Number.isFinite(parsedRatePercent) && parsedRatePercent >= 0
      ? parsedRatePercent / 100
      : args.defaultAnnualRate;
  return { leverage, plannedDays, annualRate };
}

export function calculateScoringData(ruleScores: Record<string, number>, enabledRulesCount: number) {
  const totalScore = (Object.values(ruleScores) as number[]).reduce((a, b) => a + b, 0);
  const maxPossibleScore = enabledRulesCount;
  const percentage = maxPossibleScore > 0 ? (totalScore / maxPossibleScore) * 100 : 0;
  const verdict = getVerdict(percentage);
  return { totalScore, maxPossibleScore, percentage, verdict };
}

export function calculateRiskData(entryPrice: number, stopLoss: number, positionSize: number) {
  if (entryPrice > 0 && stopLoss > 0 && positionSize > 0) {
    return calculateRisk(entryPrice, stopLoss, positionSize);
  }
  return { totalRisk: 0, riskPercent: 0 };
}

export function calculateStopLossMoneyAtRisk(entryPrice: number, stopLoss: number, positionSize: number) {
  if (entryPrice <= 0 || stopLoss <= 0 || positionSize <= 0) return null;
  const perShare = entryPrice - stopLoss;
  if (perShare <= 0) return null;
  return { perShare, total: perShare * positionSize };
}

export function calculateRiskRewardPlan(args: {
  targetGainPercentStr: string;
  entryPrice: number;
  stopLoss: number;
  positionSize: number;
  quoteTickSize: number | null;
}) {
  const { targetGainPercentStr, entryPrice, stopLoss, positionSize, quoteTickSize } = args;
  const gainPct = parseFloat(targetGainPercentStr);
  if (!Number.isFinite(gainPct) || gainPct <= 0 || entryPrice <= 0) return null;
  if (stopLoss <= 0 || positionSize <= 0) return null;
  const riskPerShare = entryPrice - stopLoss;
  if (riskPerShare <= 0) return null;
  const rewardPerShare = entryPrice * (gainPct / 100);
  const targetPrice = roundToTick(entryPrice + rewardPerShare, quoteTickSize);
  const totalReward = rewardPerShare * positionSize;
  const ratio = rewardPerShare / riskPerShare;
  return { targetPrice, rewardPerShare, totalReward, ratio };
}

export function calculateDeliveryChargesAtStop(args: {
  entryPrice: number;
  stopLoss: number;
  positionSize: number;
  isMtfTrade: boolean;
  mtfInputs: MtfInputs;
}) {
  const { entryPrice, stopLoss, positionSize, isMtfTrade, mtfInputs } = args;
  if (entryPrice <= 0 || stopLoss <= 0 || positionSize <= 0) return null;
  if (entryPrice <= stopLoss) return null;

  const grossBuyValue = entryPrice * positionSize;
  const grossSellValue = stopLoss * positionSize;
  const leverage = isMtfTrade ? mtfInputs.leverage : 1;
  // Capital usage formula:
  // - cash trade: entry * size
  // - MTF trade: (entry * size) / leverage
  const capitalUsage = isMtfTrade ? grossBuyValue / leverage : grossBuyValue;
  // Effective investment formula for MTF:
  // effective investment = capital usage / leverage
  const effectiveInvestment = isMtfTrade ? capitalUsage / leverage : capitalUsage;

  const buyValue = capitalUsage;
  const sellValue = isMtfTrade ? grossSellValue / leverage : grossSellValue;
  const turnover = buyValue + sellValue;

  const buyBrokerage = DELIVERY_CHARGE_RATES.deliveryBuyBrokerage;
  const sellBrokerage = DELIVERY_CHARGE_RATES.deliverySellBrokerage;
  const brokerage = buyBrokerage + sellBrokerage;
  const buyStt = 0;
  const sellStt = sellValue * DELIVERY_CHARGE_RATES.sttRate;
  const stt = sellStt;
  const transactionCharge = turnover * DELIVERY_CHARGE_RATES.transactionRate;
  const sebiCharge = turnover * DELIVERY_CHARGE_RATES.sebiRate;
  const stampDuty = buyValue * DELIVERY_CHARGE_RATES.stampDutyRate;
  const gst = (brokerage + transactionCharge) * DELIVERY_CHARGE_RATES.gstRate;
  const dpCharge = DELIVERY_CHARGE_RATES.dpCharge;
  const userMargin = capitalUsage;
  const fundedAmount = isMtfTrade ? Math.max(0, grossBuyValue - capitalUsage) : 0;
  const mtfInterest = isMtfTrade ? (fundedAmount * mtfInputs.annualRate * mtfInputs.plannedDays) / 365 : 0;
  const mtfPledgeCharges = isMtfTrade ? 40 : 0;
  const mtfPledgeChargesTwoStep = isMtfTrade ? 80 : 0;
  const sellSteps = 2;
  const sellValuePerStep = sellValue / sellSteps;
  const buyTurnover = buyValue;
  const sellTurnoverSingle = sellValue;
  const sellTurnoverPerStep = sellValuePerStep;
  const transactionChargeBuy = buyTurnover * DELIVERY_CHARGE_RATES.transactionRate;
  const transactionChargeSellSingle = sellTurnoverSingle * DELIVERY_CHARGE_RATES.transactionRate;
  const transactionChargeSellPerStep = sellTurnoverPerStep * DELIVERY_CHARGE_RATES.transactionRate;
  const sebiChargeBuy = buyTurnover * DELIVERY_CHARGE_RATES.sebiRate;
  const sebiChargeSellSingle = sellTurnoverSingle * DELIVERY_CHARGE_RATES.sebiRate;
  const sebiChargeSellPerStep = sellTurnoverPerStep * DELIVERY_CHARGE_RATES.sebiRate;
  const sellSttPerStep = sellTurnoverPerStep * DELIVERY_CHARGE_RATES.sttRate;

  const totalCharges =
    brokerage + stt + transactionCharge + sebiCharge + stampDuty + gst + dpCharge + mtfInterest + mtfPledgeCharges;
  const sellBrokerageThreeStep = buyBrokerage + DELIVERY_CHARGE_RATES.deliverySellBrokerage * sellSteps;
  const dpChargeThreeStep = DELIVERY_CHARGE_RATES.dpCharge * sellSteps;
  const transactionChargeThreeStep = transactionChargeBuy + transactionChargeSellPerStep * sellSteps;
  const sebiChargeThreeStep = sebiChargeBuy + sebiChargeSellPerStep * sellSteps;
  const sttThreeStep = sellSttPerStep * sellSteps;
  const gstThreeStep = (sellBrokerageThreeStep + transactionChargeThreeStep) * DELIVERY_CHARGE_RATES.gstRate;
  const totalChargesTwoStepSell =
    sellBrokerageThreeStep +
    sttThreeStep +
    transactionChargeThreeStep +
    sebiChargeThreeStep +
    stampDuty +
    gstThreeStep +
    dpChargeThreeStep +
    mtfInterest +
    mtfPledgeChargesTwoStep;
  const stopLossPriceRisk = (entryPrice - stopLoss) * positionSize;

  return {
    leverage,
    baseBuyValue: grossBuyValue,
    baseSellValue: grossSellValue,
    capitalUsage,
    effectiveInvestment,
    buyValue,
    sellValue,
    buyBrokerage,
    sellBrokerage,
    brokerage,
    buyStt,
    sellStt,
    stt,
    transactionCharge,
    sebiCharge,
    stampDuty,
    gst,
    dpCharge,
    userMargin,
    fundedAmount,
    mtfInterest,
    mtfPledgeCharges,
    stopLossPriceRisk,
    totalCharges,
    totalChargesTwoStepSell,
    finalRisk: stopLossPriceRisk + totalCharges,
    finalRiskTwoStepSell: stopLossPriceRisk + totalChargesTwoStepSell,
    twoStepSell: {
      sellSteps,
      sellValuePerStep,
      sttPerStep: sellSttPerStep,
      sellBrokerage: sellBrokerageThreeStep,
      sellBrokeragePerStep: DELIVERY_CHARGE_RATES.deliverySellBrokerage,
      stt: sttThreeStep,
      transactionCharge: transactionChargeThreeStep,
      transactionChargePerStep: transactionChargeSellPerStep,
      sebiCharge: sebiChargeThreeStep,
      sebiChargePerStep: sebiChargeSellPerStep,
      stampDuty,
      gst: gstThreeStep,
      dpCharge: dpChargeThreeStep,
      dpChargePerStep: DELIVERY_CHARGE_RATES.dpCharge,
      mtfInterest,
      mtfPledgeCharges: mtfPledgeChargesTwoStep,
      totalCharges: totalChargesTwoStepSell,
    },
  };
}

export function calculateFrictionCost(deliveryChargesAtStop: {
  totalCharges: number;
  totalChargesTwoStepSell?: number;
  baseBuyValue: number;
} | null) {
  if (!deliveryChargesAtStop) return null;
  if (deliveryChargesAtStop.baseBuyValue <= 0) return null;


  const percent = (deliveryChargesAtStop.totalCharges / deliveryChargesAtStop.baseBuyValue) * 100;
  const twoStepPercent =
    typeof deliveryChargesAtStop.totalChargesTwoStepSell === 'number'
      ? (deliveryChargesAtStop.totalChargesTwoStepSell / deliveryChargesAtStop.baseBuyValue) * 100
      : null;
  const worstPercent = Math.max(percent, twoStepPercent ?? percent);

  if (worstPercent > 1.2) {
    return {
      percent,
      twoStepPercent,
      tone: 'high' as const,
      message: '❌ System killer',
    };
  }
  if (worstPercent > 0.9) {
    return {
      percent,
      twoStepPercent,
      tone: 'high' as const,
      message: '🚨 Bad',
    };
  }
  if (worstPercent >= 0.8) {
    return {
      percent,
      twoStepPercent,
      tone: 'medium' as const,
      message: '⚠️ Borderline',
    };
  }
  if (worstPercent >= 0.5) {
    return {
      percent,
      twoStepPercent,
      tone: 'low' as const,
      message: '👍 Good',
    };
  }
  return {
    percent,
    twoStepPercent,
    tone: 'low' as const,
    message: '🔥 Excellent',
  };
}
