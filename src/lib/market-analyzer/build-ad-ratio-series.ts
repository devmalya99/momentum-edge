/**
 * Isolated A/D ratio series builder for Market Analyzer.
 * Logic copied from MarketView chart merge rules — chart UI is not modified.
 * Output: chronological session ratios (oldest → newest).
 */

import { parseISO } from 'date-fns';

export type NseMonthlyAdRow = {
  ADD_DAY_STRING: string;
  ADD_DAY: string;
  ADD_ADVANCES: number;
  ADD_DECLINES: number;
  ADD_ADV_DCLN_RATIO: number;
  TIMESTAMP: string;
};

export type NseMonthlyAdBlock = {
  yearKey: string;
  data: NseMonthlyAdRow[];
};

export type NeonAdDailyRow = {
  trade_date: string;
  ad_ratio: number | null;
  advances: number;
  declines: number;
};

function toFiniteNumber(v: unknown): number | null {
  if (v == null) return null;
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function formatDateIst(d: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

function currentCalendarYearIst(): number {
  return parseInt(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
    }).format(new Date()),
    10,
  );
}

function isTradeDateInCurrentMonthYearIst(tradeDate: string): boolean {
  const now = new Date();
  const y = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
  }).format(now);
  const m = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    month: '2-digit',
  }).format(now);
  return tradeDate.startsWith(`${y}-${m}-`);
}

function neonMonthPrefixesForYear(neonRows: NeonAdDailyRow[], chartYear: number): Set<string> {
  const yp = `${chartYear}-`;
  const s = new Set<string>();
  for (const r of neonRows) {
    if (!r.trade_date.startsWith(yp)) continue;
    const ad = toFiniteNumber(r.ad_ratio);
    if (ad == null) continue;
    s.add(r.trade_date.slice(0, 7));
  }
  return s;
}

function primarySessionAdRatio(
  tradeDate: string,
  nseRatio: number | null,
  neonRatio: number | null,
  chartYear: number | 'rolling',
  neonMonthPrefixes: Set<string>,
  lastNseTradeDate: string,
): number | null {
  const nn = toFiniteNumber(neonRatio);
  const ns = toFiniteNumber(nseRatio);

  if (chartYear === 'rolling') {
    if (nn != null) {
      if (ns == null) return nn;
      if (isTradeDateInCurrentMonthYearIst(tradeDate)) return nn;
      if (lastNseTradeDate && tradeDate > lastNseTradeDate) return nn;
    }
    if (ns != null) return ns;
    return nn;
  }
  const ym = tradeDate.slice(0, 7);
  if (neonMonthPrefixes.has(ym) && nn != null) {
    return nn;
  }
  if (ns != null) return ns;
  return nn;
}

type SessionRow = {
  tradeDate: string;
  sortKey: number;
  ratio: number | null;
};

/**
 * Builds chronological primary-session A/D ratios (rolling window + Neon gap-fill).
 */
export function buildAdRatioSeries(
  historyMonths: NseMonthlyAdBlock[],
  neonRows: NeonAdDailyRow[],
  chartYear: 'rolling' | number = 'rolling',
): number[] {
  const nseRows: SessionRow[] = [];
  for (const block of historyMonths) {
    for (const row of block.data) {
      const ts = new Date(row.TIMESTAMP);
      if (Number.isNaN(ts.getTime())) continue;
      nseRows.push({
        tradeDate: formatDateIst(ts),
        sortKey: ts.getTime(),
        ratio: row.ADD_ADV_DCLN_RATIO,
      });
    }
  }

  let maxNseTradeDate = '';
  for (const r of nseRows) {
    if (r.tradeDate > maxNseTradeDate) maxNseTradeDate = r.tradeDate;
  }

  const neonByDate = new Map<string, number>();
  for (const nr of neonRows) {
    const ad = toFiniteNumber(nr.ad_ratio);
    if (ad != null) neonByDate.set(nr.trade_date, ad);
  }

  let chartBase: SessionRow[];
  if (neonRows.length === 0) {
    chartBase = [...nseRows].sort((a, b) => a.sortKey - b.sortKey);
  } else {
    const byTradeDate = new Map<string, SessionRow>();
    for (const p of nseRows) {
      if (!byTradeDate.has(p.tradeDate)) {
        byTradeDate.set(p.tradeDate, p);
      }
    }

    for (const nr of neonRows) {
      const ad = toFiniteNumber(nr.ad_ratio);
      if (ad == null) continue;
      if (byTradeDate.has(nr.trade_date)) continue;

      if (chartYear !== 'rolling') {
        const yPrefix = `${chartYear}-`;
        if (!nr.trade_date.startsWith(yPrefix)) continue;
      } else if (maxNseTradeDate && nr.trade_date <= maxNseTradeDate) {
        continue;
      }

      const d = parseISO(`${nr.trade_date}T12:00:00`);
      if (Number.isNaN(d.getTime())) continue;

      byTradeDate.set(nr.trade_date, {
        tradeDate: nr.trade_date,
        sortKey: d.getTime(),
        ratio: null,
      });
    }

    chartBase = Array.from(byTradeDate.values()).sort((a, b) => a.sortKey - b.sortKey);
  }

  const neonMonthPrefixes =
    chartYear === 'rolling' ? new Set<string>() : neonMonthPrefixesForYear(neonRows, chartYear);

  const ratios: number[] = [];
  for (const p of chartBase) {
    const neonVal = neonByDate.get(p.tradeDate) ?? null;
    const primary = primarySessionAdRatio(
      p.tradeDate,
      p.ratio,
      neonVal,
      chartYear,
      neonMonthPrefixes,
      maxNseTradeDate,
    );
    if (primary != null && Number.isFinite(primary)) {
      ratios.push(primary);
    }
  }

  return ratios;
}

export function normalizeNeonAdRows(raw: unknown): NeonAdDailyRow[] {
  if (!Array.isArray(raw)) return [];
  const out: NeonAdDailyRow[] = [];
  for (const item of raw) {
    if (typeof item !== 'object' || item === null) continue;
    const o = item as Record<string, unknown>;
    const td = typeof o.trade_date === 'string' ? o.trade_date : '';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(td)) continue;
    const ad = toFiniteNumber(o.ad_ratio);
    if (ad == null) continue;
    out.push({
      trade_date: td,
      ad_ratio: ad,
      advances: toFiniteNumber(o.advances) ?? 0,
      declines: toFiniteNumber(o.declines) ?? 0,
    });
  }
  return out;
}

export function currentIstYear(): number {
  return currentCalendarYearIst();
}
