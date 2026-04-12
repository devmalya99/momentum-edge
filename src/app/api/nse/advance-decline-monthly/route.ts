import { NextResponse } from 'next/server';
import { nseFetchJson } from '@/lib/nse-fetch';
import {
  getLastNMonthsOfCalendarYear,
  getPriorNseMonthKeys,
  NSE_MONTHLY_LOOKBACK,
} from '@/lib/nse-month-keys';

export const dynamic = 'force-dynamic';

const NSE_MONTHLY_BASE =
  'https://www.nseindia.com/api/historicalOR/advances-decline-monthly';

export type NseMonthlyRow = {
  ADD_DAY_STRING: string;
  ADD_DAY: string;
  ADD_ADVANCES: number;
  ADD_DECLINES: number;
  ADD_ADV_DCLN_RATIO: number;
  TIMESTAMP: string;
};

type NseMonthlyPayload = {
  data?: NseMonthlyRow[];
};

export type MonthlySeriesBlock = {
  yearKey: string;
  data: NseMonthlyRow[];
  error?: string;
};

async function fetchOneMonth(yearKey: string): Promise<MonthlySeriesBlock> {
  // NSE expects `year=MON-YYYY` (e.g. JAN-2023). Bare `2023` is ignored → you still see current data.
  const url = `${NSE_MONTHLY_BASE}?year=${encodeURIComponent(yearKey)}`;
  const result = await nseFetchJson<NseMonthlyPayload>(url);
  if (!result.ok) {
    return {
      yearKey,
      data: [],
      error: `NSE ${result.status}: ${result.detail}`,
    };
  }
  const rows = Array.isArray(result.data.data) ? result.data.data : [];
  return { yearKey, data: rows };
}

function resolveMonthKeys(): string[] {
  const raw = process.env.NSE_AD_HISTORICAL_YEAR?.trim();
  if (raw) {
    const y = parseInt(raw, 10);
    if (Number.isFinite(y) && y >= 1990 && y <= 2100) {
      return getLastNMonthsOfCalendarYear(y, NSE_MONTHLY_LOOKBACK);
    }
  }
  return getPriorNseMonthKeys(new Date(), NSE_MONTHLY_LOOKBACK);
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const yearRaw = searchParams.get('year');

    let keys: string[];
    let calendarYear: number | null = null;

    if (yearRaw != null && yearRaw.trim() !== '') {
      const y = parseInt(yearRaw.trim(), 10);
      if (!Number.isFinite(y) || y < 1990 || y > 2100) {
        return NextResponse.json(
          { error: 'Invalid year (use 1990–2100)', months: [], calendarYear: null },
          { status: 400 },
        );
      }
      calendarYear = y;
      keys = getLastNMonthsOfCalendarYear(y, 12);
    } else {
      keys = resolveMonthKeys();
    }
    const months: MonthlySeriesBlock[] = await Promise.all(keys.map((k) => fetchOneMonth(k)));

    const allEmpty = months.every((m) => m.data.length === 0);

    if (allEmpty) {
      const msg =
        months.map((m) => m.error).filter(Boolean).join(' | ') || 'No data returned.';
      return NextResponse.json(
        { error: msg, months, calendarYear },
        { status: 502 },
      );
    }

    return NextResponse.json({ months, calendarYear });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ error: message, months: [] }, { status: 502 });
  }
}
