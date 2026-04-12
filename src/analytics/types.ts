export type MetricTone = 'strong' | 'acceptable' | 'weak';

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
  /** Stamp duty (parsed when labeled on sheet). */
  stampDuty: number;
  /** DP / CDSL / depository-type charges when labeled. */
  dpCharges: number;
  /** STCG / capital gains tax lines when labeled (e.g. 18% STCG). */
  stcgTax: number;
  /** Exchange, clearing, SEBI, IPFT, turnover fees, etc. */
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
  /** From workbook "Realized P&L Pct." when present. */
  realizedPnLPct?: number;
}

export interface ParsedPnL {
  summary: PnLSummary;
  chargesDetail: PnLChargesDetail;
  symbolRows: PnLSymbolRow[];
  errors: string[];
  warnings: string[];
}

export interface BasicPnLMetrics {
  netProfit: number;
  winRate: number;
  avgWin: number;
  avgLoss: number;
  riskReward: number;
  expectancy: number;
  profitFactor: number;
  grossWins: number;
  grossLosses: number;
  outcomesCount: number;
  turnover: number;
  /** Sum of symbol realized P&L rows (before subtracting account charges). */
  symbolRowNetBeforeCharges: number;
  winRowCount: number;
  lossRowCount: number;
  flatRowCount: number;
  totalRowCount: number;
  /** Profitable symbol rows ÷ all symbol rows (includes breakeven). */
  profitabilityPct: number;
  /** Losing rows with realized P&L worse than −₹1,000 (1% of ₹1L risk unit). */
  largeLossRowCount: number;
  /** largeLossRowCount ÷ lossRowCount × 100; lower is better. */
  riskControlLargeLossPct: number | null;
  /** winRowCount ÷ lossRowCount; higher is better. */
  consistencyWinLossRatio: number | null;
}

export interface ChargesAnalysis extends PnLChargesDetail {
  chargesPctOfProfit: number | null;
  brokeragePctOfTurnover: number | null;
  sttPctOfProfit: number | null;
  /** All parsed fees ÷ sum of winning rows’ realized P&L × 100; lower is better. */
  costEfficiencyVsGrossProfitPct: number | null;
  /** symbolRowNet − totalCharges (same row basis as gross figures). */
  profitAfterFeesAndCharges: number | null;
}

export interface MetricInterpretation {
  metricKey: string;
  label: string;
  value: string;
  tone: MetricTone;
  message: string;
}

export interface ReconstructedTrade {
  id: string;
  symbol: string;
  entryTime: number;
  exitTime: number;
  /** FIFO lot average entry price for the closed quantity. */
  entryPrice: number;
  /** Exit fill price for this closed slice. */
  exitPrice: number;
  pnl: number;
  /** Percent move on entry price (long: (exit-entry)/entry; short: (entry-exit)/entry). */
  pnlPct: number;
  holdingMs: number;
  qty: number;
}

export interface TradebookAnalytics {
  maxDrawdown: number;
  recoveryFactor: number | null;
  equityCurve: { t: number; equity: number; label: string }[];
  drawdownSeries: { t: number; dd: number; label: string }[];
  maxWinStreak: number;
  maxLossStreak: number;
  returnStdDev: number;
  topDecileContributionPct: number | null;
  holdingBuckets: {
    intraday: { count: number; avgPnl: number };
    short: { count: number; avgPnl: number };
    swing: { count: number; avgPnl: number };
    long: { count: number; avgPnl: number };
  };
  profitByDay: { key: string; pnl: number }[];
  profitByWeek: { key: string; pnl: number }[];
  profitByMonth: { key: string; pnl: number }[];
  /** Closed trades counted by exit week (ISO week start Monday, yyyy-MM-dd). */
  tradeCountByWeek?: { key: string; count: number }[];
}

export interface InsightItem {
  kind: 'strength' | 'weakness';
  title: string;
  detail: string;
}

export interface HealthScoreResult {
  score: number;
  category: 'Beginner' | 'Developing' | 'Consistent' | 'Advanced';
  breakdown: { label: string; points: number; max: number }[];
}

export interface ProgressDelta {
  metric: string;
  before: number | null;
  after: number;
  improved: boolean;
  pctChange: number | null;
}

export interface BrokerSnapshotMetrics {
  basicPnL: BasicPnLMetrics | null;
  charges: ChargesAnalysis | null;
  pnlInterpretations: MetricInterpretation[];
  tradebook: TradebookAnalytics | null;
  insights: InsightItem[];
  health: HealthScoreResult;
  progress: ProgressDelta[];
}

/** Row-level input for P&L distribution / equity charts (from workbook or any ordered list). */
export interface PnlChartTrade {
  pnl: number;
  date?: string;
  /** e.g. stock symbol */
  label?: string;
}

export interface BrokerSnapshot {
  id: string;
  createdAt: number;
  periodFrom?: string;
  periodTo?: string;
  pnlFileName?: string;
  metrics: BrokerSnapshotMetrics;
  symbolRowCount: number;
  /** Per-symbol realized P&L in sheet row order (new imports only). */
  pnlSymbolRows?: { symbol: string; realizedPnL: number }[];
  /** Non-fatal parse notes (e.g. summary vs row sum mismatch). */
  importWarnings?: string[];
}
