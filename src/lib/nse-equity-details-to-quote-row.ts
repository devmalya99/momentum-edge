import type { EquityDetails } from 'stock-nse-india';
import type { NseEquityQuoteRow } from '@/lib/nse-equity-quote-types';

/**
 * Maps stock-nse-india equity details to the slim quote shape our UI already understands
 * (Dashboard live price + Entry tick / company / last update).
 */
export function equityDetailsToNseQuoteRow(details: EquityDetails): NseEquityQuoteRow {
  const lp = Number(details?.priceInfo?.lastPrice);
  const lastPrice = Number.isFinite(lp) && lp > 0 ? lp : NaN;
  const tick = Number(details?.priceInfo?.tickSize);
  const tickSize = Number.isFinite(tick) && tick > 0 ? tick : undefined;

  const companyName = details?.info?.companyName;
  const symbol = details?.metadata?.symbol ?? details?.info?.symbol;
  const prev = Number(details?.priceInfo?.previousClose);
  const pCh = Number(details?.priceInfo?.pChange);
  const pChange = Number.isFinite(pCh) ? pCh : undefined;

  return {
    metaData: {
      symbol,
      companyName,
      closePrice: lastPrice,
      open: details?.priceInfo?.open,
      dayHigh: details?.priceInfo?.intraDayHighLow?.max,
      dayLow: details?.priceInfo?.intraDayHighLow?.min,
      previousClose: Number.isFinite(prev) ? prev : undefined,
      lastPrice,
      pChange,
    },
    orderBook: Number.isFinite(lastPrice) ? { lastPrice } : undefined,
    tradeInfo: Number.isFinite(lastPrice) ? { lastPrice, tickSize } : undefined,
    priceInfo: tickSize !== undefined ? { tickSize } : undefined,
    lastUpdateTime: details?.metadata?.lastUpdateTime,
  };
}
