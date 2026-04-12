import { Trade } from '../db';

export const calculateRisk = (entryPrice: number, stopLoss: number, positionSize: number) => {
  const riskPerShare = entryPrice - stopLoss;
  const totalRisk = riskPerShare * positionSize;
  const riskPercent = (riskPerShare / entryPrice) * 100;
  return { totalRisk, riskPercent };
};

export const calculateRMultiple = (entryPrice: number, stopLoss: number, exitPrice: number) => {
  const riskPerShare = entryPrice - stopLoss;
  const profitPerShare = exitPrice - entryPrice;
  return profitPerShare / riskPerShare;
};

export const calculateProfitPercent = (entryPrice: number, exitPrice: number) => {
  return ((exitPrice - entryPrice) / entryPrice) * 100;
};

export const getVerdict = (percentage: number): 'A+' | 'A' | 'B' | 'Avoid' => {
  if (percentage >= 80) return 'A+';
  if (percentage >= 65) return 'A';
  if (percentage >= 50) return 'B';
  return 'Avoid';
};

export const getVerdictColor = (verdict: string) => {
  switch (verdict) {
    case 'A+': return 'text-green-400 bg-green-400/10 border-green-400/20';
    case 'A': return 'text-blue-400 bg-blue-400/10 border-blue-400/20';
    case 'B': return 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20';
    case 'Avoid': return 'text-red-400 bg-red-400/10 border-red-400/20';
    default: return 'text-gray-400 bg-gray-400/10 border-gray-400/20';
  }
};

export const getTradeTypeColor = (type: string) => {
  switch (type) {
    case 'Exhaustion': return 'text-purple-400 bg-purple-400/10 border-purple-400/20';
    case 'Momentum': return 'text-blue-400 bg-blue-400/10 border-blue-400/20';
    case 'Leader': return 'text-cyan-400 bg-cyan-400/10 border-cyan-400/20';
    default: return 'text-gray-400 bg-gray-400/10 border-gray-400/20';
  }
};
