/** Slim quote row shared by `/api/nse/equity-quote` and clients (mapped from stock-nse-india). */
export type NseEquityQuoteMeta = {
  symbol?: string;
  series?: string;
  companyName?: string;
  closePrice?: number;
  open?: number;
  dayHigh?: number;
  dayLow?: number;
  previousClose?: number;
  lastPrice?: number;
  /** Intraday % change vs previous close (NSE `priceInfo.pChange` / stock-nse-india `EquityPriceInfo`). */
  pChange?: number;
};

export type NseEquityQuoteOrderBook = {
  lastPrice?: number;
};

export type NseEquityQuoteRow = {
  orderBook?: NseEquityQuoteOrderBook;
  metaData?: NseEquityQuoteMeta;
  tradeInfo?: { lastPrice?: number; tickSize?: number };
  priceInfo?: { tickSize?: number };
  lastUpdateTime?: string;
};
