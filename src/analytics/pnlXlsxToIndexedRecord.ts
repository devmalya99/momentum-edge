import type { ZodError } from 'zod';
import { buildPnlIndexedRecord } from '@/db/pnlIndexedRecord';
import { pnlIndexedRecordSchema, pnlSheetRowsInputSchema } from '@/analytics/pnlIndexedDbSchema';
import type { PnlIndexedRecord } from '@/analytics/pnlIndexedDbSchema';
import { parseZerodhaPnLXlsx } from '@/analytics/parsePnLXlsx';

function formatZodIssues(err: ZodError): string {
  return err.issues.map((i) => `${i.path.length ? i.path.join('.') : 'root'}: ${i.message}`).join('; ');
}

export type ParsePnlXlsxResult =
  | { ok: true; data: PnlIndexedRecord }
  | { ok: false; error: string };

/**
 * Reads a Zerodha-style equity P&L .xlsx, maps to `pnl_summary` + `trade_details`,
 * then validates with Zod. `trade_details[].total_trade_value` = quantity × buy value.
 */
export function parsePnlXlsxBufferToIndexedRecord(buffer: ArrayBuffer): ParsePnlXlsxResult {
  const parsed = parseZerodhaPnLXlsx(buffer);
  if (parsed.errors.length) {
    return { ok: false, error: parsed.errors.join(' ') };
  }
  if (!parsed.symbolRows.length) {
    return { ok: false, error: 'No symbol rows found under the equity table.' };
  }

  const candidate = buildPnlIndexedRecord({
    summary: parsed.summary,
    symbolRows: parsed.symbolRows,
  });

  const checked = pnlIndexedRecordSchema.safeParse(candidate);
  if (!checked.success) {
    return { ok: false, error: formatZodIssues(checked.error) };
  }

  return { ok: true, data: checked.data };
}

/** Optional: validate the 2D row matrix shape only (e.g. after trimming empty cells). */
export function validatePnlSheetRowsInput(rows: unknown): rows is unknown[][] {
  const r = pnlSheetRowsInputSchema.safeParse(rows);
  return r.success;
}
