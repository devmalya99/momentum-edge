/** Slim OHLCV bar for wire + chart (ms epoch). */
export type MarketTechnicalBar = {
  t: number;
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
};

export type MarketTechnicalKind = 'index' | 'equity';

export type MarketTechnicalSnapshot = {
  asOfTimestamp: number;
  close: number;
  prevClose: number | null;
  changePct: number | null;
  rsi14: number | null;
  ema20: number | null;
  ema50: number | null;
  ema200: number | null;
  macdLine: number | null;
  macdSignal: number | null;
  macdHist: number | null;
  bbUpper: number | null;
  bbMiddle: number | null;
  bbLower: number | null;
  atr14: number | null;
  volume: number;
};

export type MarketTechnicalApiResponse = {
  kind: MarketTechnicalKind;
  symbol: string;
  indexFlag?: string;
  bars: MarketTechnicalBar[];
  snapshot: MarketTechnicalSnapshot;
};
