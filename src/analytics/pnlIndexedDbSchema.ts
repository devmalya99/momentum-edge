import { z } from 'zod';

/** Stored P&L summary keys match the Zerodha sheet labels. */
export const pnlSummaryStoredSchema = z.object({
  Charges: z.number().nullable(),
  'Other Credit & Debit': z.number().nullable(),
  'Realized P&L': z.number().nullable(),
  'Unrealized P&L': z.number().nullable(),
});

export const tradeDetailStoredSchema = z.object({
  symbol: z.string().min(1),
  realised_pnl: z.number(),
  realised_pnl_pct: z.number(),
  total_trade_value: z.number(),
});

export const pnlIndexedRecordSchema = z.object({
  pnl_summary: pnlSummaryStoredSchema,
  trade_details: z.array(tradeDetailStoredSchema).min(1),
});

export type PnlSummaryStored = z.infer<typeof pnlSummaryStoredSchema>;
export type TradeDetailStored = z.infer<typeof tradeDetailStoredSchema>;
export type PnlIndexedRecord = z.infer<typeof pnlIndexedRecordSchema>;

/** Raw grid from `sheet_to_json(..., { header: 1 })` before business parsing. */
export const pnlSheetRowsInputSchema = z.array(z.array(z.unknown()));
