export interface PnLSummary {
  charges?: number;
  otherCreditDebit?: number;
  realizedPnL?: number;
  unrealizedPnL?: number;
  periodFrom?: string;
  periodTo?: string;
  clientId?: string;
}

export interface PnLChargesDetail {
  brokerage: number;
  stt: number;
  gst: number;
  stampDuty: number;
  dpCharges: number;
  stcgTax: number;
  otherCharges: number;
  totalCharges: number;
}

export interface PnLSymbolRow {
  symbol: string;
  isin?: string;
  quantity: number;
  buyValue: number;
  sellValue: number;
  realizedPnL: number;
  realizedPnLPct?: number;
}

export interface ParsedPnL {
  summary: PnLSummary;
  chargesDetail: PnLChargesDetail;
  symbolRows: PnLSymbolRow[];
  errors: string[];
  warnings: string[];
}

/** Legacy IndexedDB trade row (trades object store, v1–v2 imports). */
export interface ReconstructedTrade {
  id: string;
  symbol: string;
  entryTime: number;
  exitTime: number;
  entryPrice: number;
  exitPrice: number;
  pnl: number;
  pnlPct: number;
  holdingMs: number;
  qty: number;
}

/** Row-level input for P&L distribution / equity charts. */
export interface PnlChartTrade {
  pnl: number;
  date?: string;
  label?: string;
  pnlPct?: number;
  totalTradeValue?: number;
}

/** Legacy broker snapshot (history object store, v1–v2 imports). */
export interface BrokerSnapshot {
  id: string;
  createdAt: number;
  periodFrom?: string;
  periodTo?: string;
  pnlFileName?: string;
  metrics: Record<string, unknown>;
  symbolRowCount: number;
  pnlSymbolRows?: { symbol: string; realizedPnL: number }[];
  importWarnings?: string[];
}
