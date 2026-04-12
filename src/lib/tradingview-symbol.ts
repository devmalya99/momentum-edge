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
