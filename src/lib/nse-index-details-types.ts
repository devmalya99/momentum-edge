/** Client-safe shapes for NSE index details (`stock-nse-india` `IndexDetails`). */

export type NseIndexDetailsAdvance = {
  advances: string;
  declines: string;
  unchanged: string;
};

export type NseIndexDetailsMetadata = {
  indexName: string;
  open: number;
  high: number;
  low: number;
  previousClose: number;
  last: number;
  percChange: number;
  change: number;
  timeVal: string;
  yearHigh: number;
  yearLow: number;
  indicativeClose: number;
  perChange365d: number;
  perChange30d: number;
  date365dAgo: string;
  date30dAgo: string;
  chartTodayPath: string;
  chart30dPath: string;
  chart365dPath: string;
  totalTradedVolume: number;
  totalTradedValue: number;
  ffmc_sum: number;
};

export type NseIndexDetailsMarketStatus = {
  market: string;
  marketStatus: string;
  tradeDate: string;
  index: string;
  last: number;
  variation: number;
  percentChange: number;
  marketStatusMessage: string;
};

export type NseIndexEquityRow = {
  symbol: string;
  series: string;
  companyName: string;
  open: number;
  dayHigh: number;
  dayLow: number;
  lastPrice: number;
  previousClose: number;
  change: number;
  pChange: number;
  totalTradedVolume: number;
  totalTradedValue: number;
  yearHigh: number;
  yearLow: number;
  perChange30d: number;
  perChange365d: number;
  lastUpdateTime: string;
};

export type NseIndexDetailsPayload = {
  name: string;
  timestamp: string;
  date30dAgo: string;
  date365dAgo: string;
  advance: NseIndexDetailsAdvance;
  metadata: NseIndexDetailsMetadata;
  marketStatus: NseIndexDetailsMarketStatus;
  constituents: NseIndexEquityRow[];
};
