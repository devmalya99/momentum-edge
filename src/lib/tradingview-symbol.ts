/** Maps app trade symbols (e.g. RELIANCE) to TradingView exchange:symbol. */
export function toTradingViewSymbol(raw: string): string {
  const s = raw.trim().toUpperCase();
  if (!s) return 'BSE:RELIANCE';
  if (s.includes(':')) return s;
  return `BSE:${s}`;
}

export function tradingViewSymbolPageSlug(tvSymbol: string): string {
  return tvSymbol.replace(':', '-');
}

/** Extracts ticker portion from `EXCHANGE:SYMBOL` (e.g. `BSE:RELIANCE` → `RELIANCE`). */
export function nseSymbolFromTradingViewId(tvSymbol: string): string {
  const s = tvSymbol.trim();
  const i = s.indexOf(':');
  if (i === -1) return s.toUpperCase();
  return s.slice(i + 1).trim().toUpperCase();
}

/**
 * India screener often returns `NSE:TICKER`; TradingView embed chart query should use `BSE:TICKER`
 * when you want the BSE listing. Leaves `BSE:…` and other prefixes unchanged.
 */
export function toBseTradingViewQuerySymbol(tvSymbol: string): string {
  const s = tvSymbol.trim().toUpperCase();
  if (s.startsWith('NSE:')) {
    const ticker = s.slice(4).trim();
    return ticker ? `BSE:${ticker}` : s;
  }
  return s;
}

const NSE_INDEX_TV: Record<string, string> = {
  'NIFTY 50': 'NSE:NIFTY',
  NIFTY50: 'NSE:NIFTY',
  'NIFTY BANK': 'NSE:BANKNIFTY',
  'NIFTY BANK INDEX': 'NSE:BANKNIFTY',
  BANKNIFTY: 'NSE:BANKNIFTY',
  'INDIA VIX': 'NSE:INDIAVIX',
  'NIFTY IT': 'NSE:NIFTYIT',
  'NIFTY 100': 'NSE:NIFTY100',
  'NIFTY 500': 'NSE:NIFTY500',
  'NIFTY MIDCAP 100': 'NSE:NIFTYMIDCAP100',
};

/**
 * Maps watchlist `symbol` + `kind` to a TradingView `EXCHANGE:SYMBOL` for embedded charts.
 * Indices use NSE where possible; unknown names fall back to `NSE:` + compact ticker (user can change symbol in TV).
 */
export function watchlistSymbolToTradingView(symbol: string, kind: 'equity' | 'index'): string {
  if (kind === 'equity') return toTradingViewSymbol(symbol);
  const raw = symbol.trim().toUpperCase();
  if (NSE_INDEX_TV[raw]) return NSE_INDEX_TV[raw];
  const compact = raw.replace(/\s+/g, '');
  if (NSE_INDEX_TV[compact]) return NSE_INDEX_TV[compact];
  return `NSE:${compact}`;
}
