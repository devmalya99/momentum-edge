import { NextResponse } from 'next/server';
import { nseFetchJson } from '@/lib/nse-fetch';
import type { Holiday, HolidaysBySegment } from '@/lib/nse-holiday-types';

export const dynamic = 'force-dynamic';

const NSE_HOLIDAY_URL = 'https://www.nseindia.com/api/holiday-master';

function isHoliday(item: unknown): item is Holiday {
  if (typeof item !== 'object' || item === null) return false;
  const row = item as Record<string, unknown>;
  return (
    typeof row.tradingDate === 'string' &&
    typeof row.weekDay === 'string' &&
    typeof row.description === 'string' &&
    typeof row.morning_session === 'string' &&
    typeof row.evening_session === 'string' &&
    typeof row.Sr_no === 'number'
  );
}

function normalizeHolidayPayload(payload: unknown): HolidaysBySegment {
  if (typeof payload !== 'object' || payload === null) return {};
  const raw = payload as Record<string, unknown>;
  const out: HolidaysBySegment = {};

  for (const [segment, value] of Object.entries(raw)) {
    if (!Array.isArray(value)) continue;
    const rows = value.filter(isHoliday);
    if (rows.length > 0) {
      out[segment] = rows;
    }
  }
  return out;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const type = (searchParams.get('type')?.trim().toLowerCase() || 'trading') as
      | 'trading'
      | 'clearing';
    const upstreamUrl = `${NSE_HOLIDAY_URL}?type=${encodeURIComponent(type)}`;

    const result = await nseFetchJson(upstreamUrl);
    if (!result.ok) {
      return NextResponse.json(
        {
          error: `NSE responded with ${result.status}`,
          detail: result.detail,
          type,
          holidaysBySegment: {} as HolidaysBySegment,
          holidays: [] as Holiday[],
        },
        { status: result.status >= 500 ? 502 : 400 },
      );
    }

    const holidaysBySegment = normalizeHolidayPayload(result.data);
    const holidays = Object.values(holidaysBySegment).flat();

    return NextResponse.json({
      type,
      holidaysBySegment,
      holidays,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json(
      {
        error: message,
        holidaysBySegment: {} as HolidaysBySegment,
        holidays: [] as Holiday[],
      },
      { status: 502 },
    );
  }
}
