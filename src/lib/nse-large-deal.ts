/** NSE `snapshot-capital-market-largedeal` — bulk / block / short deal rows. */
export type NseLargeDealRow = {
  date: string;
  symbol: string;
  name: string;
  clientName: string | null;
  buySell: string | null;
  qty: string;
  watp: string | null;
  remarks: string | null;
};

export type NseLargeDealSnapshot = {
  as_on_date?: string;
  BULK_DEALS_DATA?: NseLargeDealRow[];
  BLOCK_DEALS_DATA?: NseLargeDealRow[];
  SHORT_DEALS_DATA?: NseLargeDealRow[];
  /** Count strings from NSE (e.g. "77"). */
  BULK_DEALS?: string;
  BLOCK_DEALS?: string;
  SHORT_DEALS?: string;
};

export function normalizeLargeDealRows(raw: unknown): NseLargeDealRow[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((r): r is NseLargeDealRow => r != null && typeof r === 'object');
}
