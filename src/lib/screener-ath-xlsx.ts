import * as XLSX from 'xlsx';
import type { CellObject, WorkSheet } from 'xlsx';
import { toTradingViewSymbol } from '@/lib/tradingview-symbol';

export type AthScannerParsedRow = {
  ticker: string;
  tvSymbol: string;
  companyName: string;
  screenerUrl: string;
};

const SCREENER_COMPANY_PATH = /\/company\/([^/?#]+)/i;

function normHeader(v: unknown): string {
  return String(v ?? '')
    .trim()
    .toLowerCase();
}

/** Resolve display URL from plain string or hyperlink-shaped cell content. */
function cellToUrlString(cell: unknown): string {
  if (typeof cell === 'string') return cell.trim();
  if (cell && typeof cell === 'object') {
    const o = cell as { href?: unknown; text?: unknown };
    if (typeof o.href === 'string' && o.href.trim()) return o.href.trim();
    if (typeof o.text === 'string' && /^https?:\/\//i.test(o.text)) return o.text.trim();
  }
  return '';
}

function cellToInspectable(cell: CellObject | undefined): unknown {
  if (!cell) return null;
  const href = cell.l?.Target?.trim();
  const text = (cell.w ?? cell.v) as string | number | boolean | Date | undefined;
  const textStr =
    text === undefined || text === null
      ? ''
      : typeof text === 'string'
        ? text
        : text instanceof Date
          ? text.toISOString()
          : String(text);
  if (href) {
    if (!textStr || textStr === href) return href;
    return { text: textStr, href };
  }
  if (text !== undefined && text !== null) return text;
  return null;
}

function worksheetRange(ws: WorkSheet): XLSX.Range | null {
  const ref = ws['!ref'];
  if (ref) return XLSX.utils.decode_range(ref);
  let maxR = 0;
  let maxC = 0;
  let any = false;
  for (const k of Object.keys(ws)) {
    if (k[0] === '!') continue;
    any = true;
    const addr = XLSX.utils.decode_cell(k);
    if (addr.r > maxR) maxR = addr.r;
    if (addr.c > maxC) maxC = addr.c;
  }
  if (!any) return null;
  return { s: { r: 0, c: 0 }, e: { r: maxR, c: maxC } };
}

/** 2D grid with hyperlink targets merged into cell values (Screener exports). */
function worksheetToInspectableGrid(ws: WorkSheet): unknown[][] {
  const range = worksheetRange(ws);
  if (!range) {
    return XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: null, raw: true });
  }
  const grid: unknown[][] = [];
  for (let r = range.s.r; r <= range.e.r; r += 1) {
    const row: unknown[] = [];
    for (let c = range.s.c; c <= range.e.c; c += 1) {
      const addr = XLSX.utils.encode_cell({ r, c });
      const cell = ws[addr] as CellObject | undefined;
      row.push(cellToInspectable(cell));
    }
    grid.push(row);
  }
  return grid;
}

function findHeaderColumns(grid: unknown[][]): { headerRowIdx: number; hrefCol: number; nameCol: number } | null {
  for (let i = 0; i < Math.min(12, grid.length); i += 1) {
    const row = grid[i];
    if (!Array.isArray(row)) continue;
    let hrefCol = -1;
    let nameCol = -1;
    for (let c = 0; c < row.length; c += 1) {
      const h = normHeader(row[c]);
      if (h === 'text href' || (h.startsWith('text') && h.includes('href'))) hrefCol = c;
      if (h === 'text 2' || h === 'name') nameCol = c;
    }
    if (hrefCol >= 0) {
      if (nameCol < 0) nameCol = Math.min(hrefCol + 1, row.length - 1);
      return { headerRowIdx: i, hrefCol, nameCol };
    }
  }
  return null;
}

/**
 * Parses a Screener.in "export to Excel" file: `/company/TICKER/…` URLs → tickers for charts and watchlist.
 */
export function parseAthRowsFromScreenerXlsx(workbook: XLSX.WorkBook): AthScannerParsedRow[] {
  const sheetName = workbook.SheetNames[0];
  const ws = workbook.Sheets[sheetName];
  if (!ws) return [];

  const grid = worksheetToInspectableGrid(ws);
  const header = findHeaderColumns(grid);
  if (!header) return [];

  const { headerRowIdx, hrefCol, nameCol } = header;
  const out: AthScannerParsedRow[] = [];
  const seen = new Set<string>();

  for (let i = headerRowIdx + 1; i < grid.length; i += 1) {
    const row = grid[i];
    if (!Array.isArray(row)) continue;
    const href = cellToUrlString(row[hrefCol]);
    const m = href.match(SCREENER_COMPANY_PATH);
    if (!m) continue;
    const ticker = m[1].trim().toUpperCase();
    if (!ticker || seen.has(ticker)) continue;
    seen.add(ticker);
    const rawName = nameCol >= 0 ? row[nameCol] : '';
    const companyName =
      (typeof rawName === 'string' ? rawName.trim() : rawName != null ? String(rawName).trim() : '') || ticker;
    const screenerUrl = href.split('?')[0] ?? href;
    out.push({
      ticker,
      tvSymbol: toTradingViewSymbol(ticker),
      companyName,
      screenerUrl,
    });
  }

  return out;
}
