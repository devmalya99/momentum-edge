'use client';

import { create } from 'zustand';
import type { PnlIndexedRecord } from '@/analytics/pnlIndexedDbSchema';
import { loadAnalyticsPnlUpload } from '@/db/traderAnalyticsDb';

/** Derived P&L figures from stored trade rows + broker summary lines. */
export type AnalyticsPnlOverview = {
  /** Sum of positive `realised_pnl` per symbol (gross wins). */
  totalProfitBeforeFees: number;
  /** Sum of losing amounts as a positive magnitude (gross losses). */
  totalLoss: number;
  /** Σ `realised_pnl` across symbols (net realized before account-level lines). */
  netRealizedFromSymbols: number;
  totalCharges: number;
  otherCreditDebit: number;
  /** Net after charges and other credit/debit: net realized − charges + other. */
  profitAfterFeesAndCharges: number;
};

export function computeAnalyticsPnlOverview(record: PnlIndexedRecord): AnalyticsPnlOverview {
  let totalProfitBeforeFees = 0;
  let totalLoss = 0;
  for (const t of record.trade_details) {
    if (t.realised_pnl > 0) totalProfitBeforeFees += t.realised_pnl;
    else if (t.realised_pnl < 0) totalLoss += -t.realised_pnl;
  }
  const netRealizedFromSymbols = record.trade_details.reduce((s, t) => s + t.realised_pnl, 0);
  const totalCharges = record.pnl_summary.Charges ?? 0;
  const otherCreditDebit = record.pnl_summary['Other Credit & Debit'] ?? 0;
  const profitAfterFeesAndCharges = netRealizedFromSymbols - totalCharges + otherCreditDebit;

  return {
    totalProfitBeforeFees,
    totalLoss,
    netRealizedFromSymbols,
    totalCharges,
    otherCreditDebit,
    profitAfterFeesAndCharges,
  };
}

/** Loss worse than ₹1,000 (≈1% of ₹1L risk capital). */
export const LARGE_LOSS_THRESHOLD_INR = 1000;

export type AnalyticsQualityMetrics = {
  profitableTradeCount: number;
  losingTradeCount: number;
  breakevenTradeCount: number;
  totalTradeCount: number;
  /** Winning symbol rows ÷ all symbol rows × 100. */
  profitabilityPct: number | null;
  /** Losing rows with loss &gt; ₹1,000 ÷ losing rows × 100 — lower is better. */
  riskControlLargeLossPct: number | null;
  losingTradesWithLargeLoss: number;
  /**
   * Summary &quot;Charges&quot; ÷ gross profit (sum of winning rows) × 100.
   * Broker sheet total already bundles brokerage, STT, GST, stamp duty, etc. — lower is better.
   */
  costEfficiencyPct: number | null;
  /** Profitable rows ÷ losing rows × 100 — higher is better; null if no losing rows. */
  consistencyWinVsLossPct: number | null;
  /** True when there are no losing trades but at least one winner (ratio undefined). */
  consistencyPerfect: boolean;
};

export function computeAnalyticsQualityMetrics(
  record: PnlIndexedRecord,
  overview: AnalyticsPnlOverview,
): AnalyticsQualityMetrics {
  let profitableTradeCount = 0;
  let losingTradeCount = 0;
  let breakevenTradeCount = 0;
  let losingTradesWithLargeLoss = 0;

  for (const t of record.trade_details) {
    if (t.realised_pnl > 0) profitableTradeCount += 1;
    else if (t.realised_pnl < 0) {
      losingTradeCount += 1;
      if (t.realised_pnl < -LARGE_LOSS_THRESHOLD_INR) losingTradesWithLargeLoss += 1;
    } else breakevenTradeCount += 1;
  }

  const totalTradeCount = record.trade_details.length;

  const profitabilityPct =
    totalTradeCount > 0 ? (profitableTradeCount / totalTradeCount) * 100 : null;

  const riskControlLargeLossPct =
    losingTradeCount > 0 ? (losingTradesWithLargeLoss / losingTradeCount) * 100 : null;

  const costEfficiencyPct =
    overview.totalProfitBeforeFees > 0
      ? (overview.totalCharges / overview.totalProfitBeforeFees) * 100
      : null;

  const consistencyPerfect = losingTradeCount === 0 && profitableTradeCount > 0;
  const consistencyWinVsLossPct =
    losingTradeCount > 0 ? (profitableTradeCount / losingTradeCount) * 100 : null;

  return {
    profitableTradeCount,
    losingTradeCount,
    breakevenTradeCount,
    totalTradeCount,
    profitabilityPct,
    riskControlLargeLossPct,
    losingTradesWithLargeLoss,
    costEfficiencyPct,
    consistencyWinVsLossPct,
    consistencyPerfect,
  };
}

type AnalyticsPnlState = {
  record: PnlIndexedRecord | null;
  hydrated: boolean;
  hydrate: () => Promise<void>;
  setRecord: (record: PnlIndexedRecord | null) => void;
};

export const useAnalyticsPnlStore = create<AnalyticsPnlState>((set) => ({
  record: null,
  hydrated: false,

  hydrate: async () => {
    const data = await loadAnalyticsPnlUpload();
    set({ record: data ?? null, hydrated: true });
  },

  setRecord: (record) => set({ record }),
}));
