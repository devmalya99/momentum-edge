import type { NseEquityQuoteRow } from '@/app/api/nse/equity-quote/route';

/** Best-effort last price from NSE GetQuoteApi row (matches Entry / equity-quote route). */
export function lastPriceFromNseQuoteRow(quote: NseEquityQuoteRow | undefined): number | null {
  if (!quote) return null;
  const md = quote.metaData;
  const fromClose = typeof md?.closePrice === 'number' ? md.closePrice : NaN;
  const fromBook =
    typeof quote.orderBook?.lastPrice === 'number' && quote.orderBook.lastPrice > 0
      ? quote.orderBook.lastPrice
      : NaN;
  const fromTrade =
    typeof quote.tradeInfo?.lastPrice === 'number' ? quote.tradeInfo.lastPrice : NaN;
  const raw = Number.isFinite(fromClose)
    ? fromClose
    : Number.isFinite(fromBook)
      ? fromBook
      : fromTrade;
  if (!Number.isFinite(raw) || raw <= 0) return null;
  return raw;
}

export async function fetchNseEquityQuotePrice(symbol: string): Promise<number> {
  const res = await fetch(
    `/api/nse/equity-quote?symbol=${encodeURIComponent(symbol.trim())}`,
    { cache: 'no-store' },
  );
  const body: { quote?: NseEquityQuoteRow; error?: string } = await res.json();
  if (!res.ok) {
    throw new Error(typeof body?.error === 'string' ? body.error : 'Quote request failed');
  }
  const p = lastPriceFromNseQuoteRow(body.quote);
  if (p == null) throw new Error('No price in quote');
  return p;
}
