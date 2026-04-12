import * as XLSX from 'xlsx';
import type { ParsedPnL, PnLChargesDetail, PnLSummary, PnLSymbolRow } from './types';

function toNum(v: unknown): number {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string') {
    const t = v.replace(/,/g, '').replace(/₹/g, '').trim();
    if (t === '' || t === '-') return 0;
    const n = parseFloat(t);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

function norm(s: unknown): string {
  return String(s ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/%/g, '');
}

function rowStrings(row: unknown[]): string[] {
  return row.map((c) => String(c ?? '').trim());
}

/** Zerodha uses "Realized P&L", "Realized P/L", or similar; exclude % / unrealized columns. */
function isRealizedPnlColumnHeader(h: string): boolean {
  if (!h.includes('realized') || h.includes('unrealized')) return false;
  if (h.includes('pct') || h.includes('percent')) return false;
  if (h.includes('p&l') || h.includes('p/l') || h.includes('p / l')) return true;
  if (/\bpnl\b/.test(h)) return true;
  return false;
}

/** "Realized P&L Pct." style column (not unrealized). */
function isRealizedPnlPctColumnHeader(h: string): boolean {
  if (!h.includes('realized') || h.includes('unrealized')) return false;
  return h.includes('pct') || h.includes('percent');
}

function findHeaderRow(rows: unknown[][]): { rowIndex: number; colMap: Record<string, number> } | null {
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i] as unknown[];
    const lower = r.map((c) => norm(c));
    const symIdx = lower.findIndex((c) => c === 'symbol');
    if (symIdx < 0) continue;
    const colMap: Record<string, number> = { symbol: symIdx };
    for (let j = 0; j < r.length; j++) {
      const h = norm(r[j]);
      if (h.includes('isin')) colMap.isin = j;
      if (h === 'quantity' || (h.includes('qty') && !h.includes('open'))) colMap.quantity = j;
      if (h.includes('buy') && h.includes('value')) colMap.buyValue = j;
      if (h.includes('sell') && h.includes('value')) colMap.sellValue = j;
      if (isRealizedPnlColumnHeader(h)) colMap.realizedPnL = j;
      if (isRealizedPnlPctColumnHeader(h)) colMap.realizedPnLPct = j;
    }
    if (colMap.quantity !== undefined && colMap.realizedPnL !== undefined) {
      return { rowIndex: i, colMap };
    }
  }
  return null;
}

function parseSummaryFromRows(rows: unknown[][], errors: string[]): PnLSummary {
  const summary: PnLSummary = {};
  const flat = rows.map((r) => rowStrings(r as unknown[]));

  for (const row of flat) {
    const joined = row.join(' ').toLowerCase();
    if (joined.includes('from') && joined.includes('to') && /\d{4}/.test(joined)) {
      const m = joined.match(/(\d{4}-\d{2}-\d{2}).*?(\d{4}-\d{2}-\d{2})/);
      if (m) {
        summary.periodFrom = m[1];
        summary.periodTo = m[2];
      }
    }
    if (joined.includes('client') && joined.match(/client\s*id/i)) {
      const id = row.find((c) => /^[A-Z0-9]{4,}$/i.test(c) && c.length < 12);
      if (id) summary.clientId = id;
    }
  }

  for (let i = 0; i < flat.length; i++) {
    const row = flat[i];
    for (let j = 0; j < row.length - 1; j++) {
      const label = norm(row[j]);
      const val = toNum(row[j + 1]);
      if (label.includes('charges') && label.length < 30 && !label.includes('breakdown')) {
        if (summary.charges === undefined) summary.charges = val;
      }
      if (label.includes('other') && (label.includes('credit') || label.includes('debit'))) {
        summary.otherCreditDebit = val;
      }
      if (
        label.includes('realized') &&
        !label.includes('unrealized') &&
        !label.includes('pct') &&
        !label.includes('percent') &&
        (label.includes('p&l') || label.includes('p/l') || /\bpnl\b/.test(label))
      ) {
        summary.realizedPnL = val;
      }
      if (label.includes('unrealized') && label.includes('p') && label.includes('l') && !label.includes('pct')) {
        summary.unrealizedPnL = val;
      }
    }
  }

  return summary;
}

function parseCharges(rows: unknown[][], errors: string[]): PnLChargesDetail {
  const detail: PnLChargesDetail = {
    brokerage: 0,
    stt: 0,
    gst: 0,
    stampDuty: 0,
    dpCharges: 0,
    stcgTax: 0,
    otherCharges: 0,
    totalCharges: 0,
  };

  const flat = rows.map((r) => rowStrings(r as unknown[]));

  for (const row of flat) {
    if (row.length < 2) continue;
    const label = norm(row[0]);
    const amt = toNum(row[1]);
    if (!label) continue;

    if (label.includes('brokerage')) detail.brokerage += amt;
    else if (label.includes('stt') || label.includes('securities transaction tax')) detail.stt += amt;
    else if (
      label.includes('gst') ||
      label.includes('integrated gst') ||
      label.includes('central gst') ||
      label.includes('state gst')
    )
      detail.gst += amt;
    else if (label.includes('stamp duty')) detail.stampDuty += amt;
    else if (
      label.includes('dp charges') ||
      label.includes('cdsl') ||
      label.includes('nsdl') ||
      (label.includes('depository') && label.includes('charges'))
    )
      detail.dpCharges += amt;
    else if (
      label.includes('stcg') ||
      (label.includes('short') && label.includes('capital') && label.includes('gain')) ||
      (label.includes('capital gains') && (label.includes('tax') || label.includes('stcg'))) ||
      label.includes('income tax on capital')
    )
      detail.stcgTax += amt;
    else if (
      label.includes('exchange transaction') ||
      label.includes('clearing') ||
      label.includes('sebi') ||
      label.includes('ipft') ||
      label.includes('turnover fees')
    ) {
      detail.otherCharges += amt;
    }
  }

  detail.totalCharges =
    detail.brokerage +
    detail.stt +
    detail.gst +
    detail.stampDuty +
    detail.dpCharges +
    detail.stcgTax +
    detail.otherCharges;

  return detail;
}

function readSymbolRows(
  rows: unknown[][],
  header: { rowIndex: number; colMap: Record<string, number> },
  errors: string[],
): PnLSymbolRow[] {
  const { rowIndex, colMap } = header;
  const out: PnLSymbolRow[] = [];
  const si = colMap.symbol;
  const qtyI = colMap.quantity!;
  const buyI = colMap.buyValue ?? qtyI + 1;
  const sellI = colMap.sellValue ?? buyI + 1;
  const pnlI = colMap.realizedPnL!;
  const pctI = colMap.realizedPnLPct;

  const needLen = Math.max(si, qtyI, pnlI, colMap.isin ?? 0, buyI, sellI, pctI ?? 0);

  for (let i = rowIndex + 1; i < rows.length; i++) {
    const r = rows[i] as unknown[];
    if (!r || r.length <= needLen) continue;
    const sym = String(r[si] ?? '').trim();
    if (!sym || sym.toLowerCase() === 'symbol' || sym.toLowerCase() === 'total') continue;
    if (/^[\d.-]+$/.test(sym)) continue;

    const pctRaw = pctI !== undefined ? toNum(r[pctI]) : NaN;
    const row: PnLSymbolRow = {
      symbol: sym,
      isin: colMap.isin !== undefined ? String(r[colMap.isin] ?? '').trim() : undefined,
      quantity: toNum(r[qtyI]),
      buyValue: toNum(r[buyI]),
      sellValue: toNum(r[sellI]),
      realizedPnL: toNum(r[pnlI]),
      ...(Number.isFinite(pctRaw) ? { realizedPnLPct: pctRaw } : {}),
    };
    out.push(row);
  }

  if (out.length === 0) errors.push('No symbol rows found under the equity P&L table.');
  return out;
}

export function parseZerodhaPnLXlsx(buffer: ArrayBuffer): ParsedPnL {
  const errors: string[] = [];
  const warnings: string[] = [];

  let workbook: XLSX.WorkBook;
  try {
    workbook = XLSX.read(buffer, { type: 'array', cellDates: true });
  } catch {
    return {
      summary: {},
      chargesDetail: {
        brokerage: 0,
        stt: 0,
        gst: 0,
        stampDuty: 0,
        dpCharges: 0,
        stcgTax: 0,
        otherCharges: 0,
        totalCharges: 0,
      },
      symbolRows: [],
      errors: ['Failed to read Excel workbook.'],
      warnings: [],
    };
  }

  const allRows: unknown[][][] = [];
  for (const name of workbook.SheetNames) {
    const sh = workbook.Sheets[name];
    if (!sh) continue;
    const part = XLSX.utils.sheet_to_json<unknown[]>(sh, {
      header: 1,
      defval: '',
      raw: false,
    }) as unknown[][];
    if (part.length) allRows.push(part);
  }

  if (allRows.length === 0) {
    return {
      summary: {},
      chargesDetail: {
        brokerage: 0,
        stt: 0,
        gst: 0,
        stampDuty: 0,
        dpCharges: 0,
        stcgTax: 0,
        otherCharges: 0,
        totalCharges: 0,
      },
      symbolRows: [],
      errors: ['Workbook has no readable sheets.'],
      warnings: [],
    };
  }

  // Scan all rows so summary lines are found even when they sit on a different tab than the symbol grid.
  const mergedFlat = allRows.reduce<unknown[][]>((acc, g) => acc.concat(g), []);
  const summary = parseSummaryFromRows(mergedFlat, errors);

  let symbolRows: PnLSymbolRow[] = [];
  let header: { rowIndex: number; colMap: Record<string, number> } | null = null;
  /** Sheet that owns the largest symbol grid — charges must be parsed here only. */
  let primarySymbolSheetRows: unknown[][] | null = null;
  for (const rows of allRows) {
    const h = findHeaderRow(rows);
    if (!h) continue;
    const part = readSymbolRows(rows, h, errors);
    if (part.length > symbolRows.length) {
      symbolRows = part;
      header = h;
      primarySymbolSheetRows = rows;
    }
  }

  // Zerodha Tax P&L workbooks stack one sheet per segment (equity, F&O, …), each with its own charges block.
  // Summing parseCharges(mergedFlat) multiplies fees across segments while symbol P&L uses one sheet → bogus totals.
  const chargesDetail = parseCharges(primarySymbolSheetRows ?? mergedFlat, errors);

  if (!header || symbolRows.length === 0) {
    errors.push('Missing expected columns (Symbol, Quantity, Realized P&L) on any sheet.');
    return {
      summary,
      chargesDetail,
      symbolRows: [],
      errors,
      warnings,
    };
  }

  if (summary.charges === undefined && chargesDetail.totalCharges > 0) {
    summary.charges = chargesDetail.totalCharges;
  }
  if (summary.charges !== undefined && chargesDetail.totalCharges > 0) {
    const diff = Math.abs(summary.charges - chargesDetail.totalCharges);
    const ref = Math.max(Math.abs(summary.charges), chargesDetail.totalCharges);
    if (diff > 1 && ref > 0) {
      warnings.push(
        diff > 0.15 * ref
          ? 'Workbook “total charges” often aggregates every segment; parsed fees use only the sheet that contains the symbol table above (same segment as gross profit / loss).'
          : 'Summary charges and breakdown sum differ slightly; using breakdown for detail.',
      );
    }
  }

  const rowSum = symbolRows.reduce((a, r) => a + r.realizedPnL, 0);
  if (
    summary.realizedPnL !== undefined &&
    Math.abs(rowSum) > 1 &&
    Math.abs(summary.realizedPnL - rowSum) > Math.max(50, 0.05 * Math.abs(rowSum))
  ) {
    warnings.push(
      'Broker summary Realized P&L differs from the sum of symbol rows; using symbol rows for net profit when non-zero.',
    );
  }

  return { summary, chargesDetail, symbolRows, errors, warnings };
}
