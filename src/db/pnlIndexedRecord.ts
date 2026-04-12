import type { PnlIndexedRecord } from '@/analytics/pnlIndexedDbSchema';

export type { PnlIndexedRecord, PnlSummaryStored, TradeDetailStored } from '@/analytics/pnlIndexedDbSchema';

export type PnlIndexedRecordInput = {
  summary: {
    charges?: number;
    otherCreditDebit?: number;
    realizedPnL?: number;
    unrealizedPnL?: number;
  };
  symbolRows: Array<{
    symbol: string;
    quantity: number;
    buyValue: number;
    realizedPnL: number;
    realizedPnLPct?: number;
  }>;
};

/**
 * Maps parsed workbook rows to the IndexedDB payload. Summary fields come from the sheet summary
 * only (not the charges breakdown table). `total_trade_value` = quantity × buy value per row.
 */
export function buildPnlIndexedRecord(parsed: PnlIndexedRecordInput): PnlIndexedRecord {
  const s = parsed.summary;

  const trade_details = parsed.symbolRows.map((r) => {
    const total_trade_value = r.quantity * r.buyValue;
    const fromSheet = r.realizedPnLPct;
    const realised_pnl_pct =
      fromSheet !== undefined && Number.isFinite(fromSheet)
        ? fromSheet
        : Math.abs(total_trade_value) > 1e-9
          ? (r.realizedPnL / total_trade_value) * 100
          : 0;
    return {
      symbol: r.symbol,
      realised_pnl: r.realizedPnL,
      realised_pnl_pct,
      total_trade_value,
    };
  });

  return {
    pnl_summary: {
      Charges: s.charges ?? null,
      'Other Credit & Debit': s.otherCreditDebit ?? null,
      'Realized P&L': s.realizedPnL ?? null,
      'Unrealized P&L': s.unrealizedPnL ?? null,
    },
    trade_details,
  };
}
