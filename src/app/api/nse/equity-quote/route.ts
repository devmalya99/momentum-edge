import { NextResponse } from 'next/server';
import { getNseIndiaClient } from '@/lib/nse-india-singleton';
import { equityDetailsToNseQuoteRow } from '@/lib/nse-equity-details-to-quote-row';
import type { NseEquityQuoteRow } from '@/lib/nse-equity-quote-types';

export const dynamic = 'force-dynamic';

export type { NseEquityQuoteMeta, NseEquityQuoteOrderBook, NseEquityQuoteRow } from '@/lib/nse-equity-quote-types';

type NseGetQuoteApiResponse = {
  equityResponse?:
    | {
        symbolInfo?: {
          symbol?: string;
          companyName?: string;
        };
        metaData?: {
          closePrice?: number;
          previousClose?: number;
          dayHigh?: number;
          dayLow?: number;
          open?: number;
          pChange?: number;
          lastUpdateTime?: string;
        };
      }
    | Array<{
        symbolInfo?: {
          symbol?: string;
          companyName?: string;
        };
        metaData?: {
          closePrice?: number;
          previousClose?: number;
          dayHigh?: number;
          dayLow?: number;
          open?: number;
          pChange?: number;
          lastUpdateTime?: string;
        };
        orderBook?: {
          lastPrice?: number;
        };
      }>;
};

type NseGetQuoteApiItem = {
  symbolInfo?: {
    symbol?: string;
    companyName?: string;
  };
  metaData?: {
    symbol?: string;
    companyName?: string;
    closePrice?: number;
    previousClose?: number;
    dayHigh?: number;
    dayLow?: number;
    open?: number;
    pChange?: number;
    lastUpdateTime?: string;
  };
  orderBook?: {
    lastPrice?: number;
  };
};

function firstQuoteItem(payload: NseGetQuoteApiResponse): NseGetQuoteApiItem | null {
  const raw = payload.equityResponse;
  if (Array.isArray(raw)) return (raw[0] as NseGetQuoteApiItem | undefined) ?? null;
  if (raw && typeof raw === 'object') return raw as NseGetQuoteApiItem;
  return null;
}

function finiteOrUndefined(value: unknown): number | undefined {
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

async function fetchFallbackNseQuote(symbol: string): Promise<NseEquityQuoteRow> {
  const browserHeaders = {
    Accept: 'application/json, text/plain, */*',
    'Accept-Language': 'en-US,en;q=0.9',
    Referer: 'https://www.nseindia.com/',
    Origin: 'https://www.nseindia.com',
    'User-Agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  };

  const warmupResponse = await fetch('https://www.nseindia.com/', {
    method: 'GET',
    cache: 'no-store',
    headers: browserHeaders,
  });
  const warmupCookies = warmupResponse.headers.get('set-cookie');

  const fallbackUrl = new URL('https://www.nseindia.com/api/NextApi/apiClient/GetQuoteApi');
  fallbackUrl.searchParams.set('functionName', 'getSymbolData');
  fallbackUrl.searchParams.set('marketType', 'N');
  fallbackUrl.searchParams.set('series', 'EQ');
  fallbackUrl.searchParams.set('symbol', symbol.toUpperCase());

  const fallbackResponse = await fetch(fallbackUrl, {
    method: 'GET',
    cache: 'no-store',
    headers: {
      ...browserHeaders,
      ...(warmupCookies ? { Cookie: warmupCookies } : {}),
    },
  });

  if (!fallbackResponse.ok) {
    throw new Error(`Fallback quote upstream failed (${fallbackResponse.status})`);
  }

  const fallbackJson = (await fallbackResponse.json()) as NseGetQuoteApiResponse;
  const quoteItem = firstQuoteItem(fallbackJson);
  const closePrice =
    finiteOrUndefined(quoteItem?.metaData?.closePrice) ??
    finiteOrUndefined(quoteItem?.orderBook?.lastPrice);
  if (typeof closePrice !== 'number' || !Number.isFinite(closePrice) || closePrice <= 0) {
    throw new Error('Fallback quote missing equityResponse.metaData.closePrice');
  }
  const safeClosePrice = closePrice;

  return {
    metaData: {
      symbol: quoteItem?.symbolInfo?.symbol ?? quoteItem?.metaData?.symbol ?? symbol.toUpperCase(),
      companyName: quoteItem?.symbolInfo?.companyName ?? quoteItem?.metaData?.companyName,
      closePrice: safeClosePrice,
      open: finiteOrUndefined(quoteItem?.metaData?.open),
      dayHigh: finiteOrUndefined(quoteItem?.metaData?.dayHigh),
      dayLow: finiteOrUndefined(quoteItem?.metaData?.dayLow),
      previousClose: finiteOrUndefined(quoteItem?.metaData?.previousClose),
      pChange: finiteOrUndefined(quoteItem?.metaData?.pChange),
    },
    lastUpdateTime: quoteItem?.metaData?.lastUpdateTime,
    orderBook: { lastPrice: safeClosePrice },
    tradeInfo: { lastPrice: safeClosePrice },
  };
}

/**
 * Equity last price + tick metadata for active trades (Dashboard) and Entry flow.
 * Uses `stock-nse-india` (`getEquityDetails`) instead of calling NSE GetQuoteApi directly,
 * then maps to the compact quote shape the UI already consumes.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const symbol = searchParams.get('symbol')?.trim() ?? '';

  if (symbol.length < 1) {
    return NextResponse.json({ error: 'symbol required' }, { status: 400 });
  }

  try {
    const details = await getNseIndiaClient().getEquityDetails(symbol.toUpperCase());
    const quote = equityDetailsToNseQuoteRow(details);
    const lp = quote.metaData?.closePrice;
    if (typeof lp !== 'number' || !Number.isFinite(lp) || lp <= 0) {
      return NextResponse.json({ error: 'No price in quote', detail: 'lastPrice missing' }, { status: 404 });
    }
    return NextResponse.json({ quote });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Quote fetch failed';
    const upstreamStatus =
      error &&
      typeof error === 'object' &&
      'response' in error &&
      error.response &&
      typeof error.response === 'object' &&
      'status' in error.response &&
      typeof error.response.status === 'number'
        ? error.response.status
        : null;

    const has403InMessage = /\b403\b/.test(message);
    const has429InMessage = /\b429\b/.test(message);
    const shouldUseFallback =
      upstreamStatus === 403 ||
      upstreamStatus === 429 ||
      (typeof upstreamStatus === 'number' && upstreamStatus >= 500) ||
      has403InMessage ||
      has429InMessage;
    if (shouldUseFallback) {
      try {
        const fallbackQuote = await fetchFallbackNseQuote(symbol);
        return NextResponse.json({ quote: fallbackQuote });
      } catch (fallbackError) {
        const fallbackMessage =
          fallbackError instanceof Error ? fallbackError.message : 'Fallback quote fetch failed';
        console.warn(
          `[GET /api/nse/equity-quote] fallback failed symbol=${symbol.toUpperCase()} status=${upstreamStatus ?? 'unknown'} message=${fallbackMessage}`,
        );
      }
    }

    console.warn(
      `[GET /api/nse/equity-quote] failed symbol=${symbol.toUpperCase()} status=${upstreamStatus ?? 'unknown'} message=${message}`,
    );
    return NextResponse.json({ error: 'Quote fetch failed', detail: message }, { status: 502 });
  }
}
