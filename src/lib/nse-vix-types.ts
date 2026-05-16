/** Raw row from NSE `historicalOR/vixhistory`. */
export type NseVixHistoryRow = {
  EOD_TIMESTAMP: string;
  EOD_INDEX_NAME: string;
  EOD_OPEN_INDEX_VAL: number;
  EOD_HIGH_INDEX_VAL: number;
  EOD_LOW_INDEX_VAL: number;
  EOD_CLOSE_INDEX_VAL: number;
  EOD_PREV_CLOSE: number;
  VIX_PTS_CHG: number;
  VIX_PERC_CHG: number;
};

export type NseVixHistoryPayload = {
  data: NseVixHistoryRow[];
};

/** Normalized point for charts and UI. */
export type VixChartPoint = {
  label: string;
  tradeDate: string;
  close: number;
  open: number;
  high: number;
  low: number;
  changePts: number;
  changePct: number;
  sortKey: number;
};

export type VixHistoryApiResponse = {
  points: VixChartPoint[];
  latest: VixChartPoint | null;
  from: string;
  to: string;
  lookbackSessions: number;
};
