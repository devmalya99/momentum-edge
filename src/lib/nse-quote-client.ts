import type { NseEquityQuoteRow } from '@/lib/nse-equity-quote-types';

const EQUITY_QUOTE_MIN_INTERVAL_MS = 167; // ~6 requests per second
let equityQuoteQueue: Promise<unknown> = Promise.resolve();
let lastEquityQuoteRequestAt = 0;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function enqueueEquityQuoteRequest<T>(fn: () => Promise<T>): Promise<T> {
  const run = async () => {
    const now = Date.now();
    const waitMs = Math.max(0, lastEquityQuoteRequestAt + EQUITY_QUOTE_MIN_INTERVAL_MS - now);
    if (waitMs > 0) {
      await sleep(waitMs);
    }
    lastEquityQuoteRequestAt = Date.now();
    return fn();
  };
  const next = equityQuoteQueue.catch(() => undefined).then(run);
  equityQuoteQueue = next.then(() => undefined, () => undefined);
  return next;
}

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

export async function fetchNseEquityQuoteRow(symbol: string): Promise<NseEquityQuoteRow> {
  return enqueueEquityQuoteRequest(async () => {
    const res = await fetch(
      `/api/nse/equity-quote?symbol=${encodeURIComponent(symbol.trim())}`,
      { cache: 'no-store' },
    );
    const body: { quote?: NseEquityQuoteRow; error?: string } = await res.json();
    if (!res.ok) {
      throw new Error(typeof body?.error === 'string' ? body.error : 'Quote request failed');
    }
    if (!body.quote) throw new Error('No quote in response');
    return body.quote;
  });
}

export async function fetchNseEquityQuotePrice(symbol: string): Promise<number> {
  const row = await fetchNseEquityQuoteRow(symbol);
  const p = lastPriceFromNseQuoteRow(row);
  if (p == null) throw new Error('No price in quote');
  return p;
}
