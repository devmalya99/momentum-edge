import { nseFetchJson } from '@/lib/nse-fetch';
import {
  ensureAdRatioDailyTable,
  getAdRatioDailyByDate,
  upsertAdRatioDaily,
} from '@/lib/db/ad-ratio';
import { parseNseLiveAdvanceDecline } from '@/lib/nse-live-advance-decline';

const NSE_ADVANCE_URL = 'https://www.nseindia.com/api/live-analysis-advance';

type SyncOkResult = {
  ok: true;
  updated: boolean;
  stored: {
    trade_date: string;
    advances: number;
    declines: number;
    ad_ratio: number | null;
  };
};

type SyncErrorResult = {
  ok: false;
  status: number;
  error: string;
  detail?: string;
};

export type SyncAdRatioTodayResult = SyncOkResult | SyncErrorResult;

const AD_RATIO_EPSILON = 1e-8;

function areRatiosEqual(a: number | null, b: number | null): boolean {
  if (a == null && b == null) return true;
  if (a == null || b == null) return false;
  return Math.abs(a - b) < AD_RATIO_EPSILON;
}

/**
 * Fetches today's A/D from NSE and writes to Neon.
 * @param options.force When true, always upserts (used by the daily cron snapshot).
 */
export async function syncAdRatioToday(
  options?: { force?: boolean },
): Promise<SyncAdRatioTodayResult> {
  if (!process.env.DATABASE_URL?.trim()) {
    return { ok: false, status: 503, error: 'DATABASE_URL is not configured' };
  }

  const result = await nseFetchJson<unknown>(NSE_ADVANCE_URL);
  if (!result.ok) {
    return {
      ok: false,
      status: result.status >= 500 ? 502 : 400,
      error: `NSE responded with ${result.status}`,
      detail: result.detail,
    };
  }

  const parsed = parseNseLiveAdvanceDecline(result.data);
  if (!parsed) {
    return {
      ok: false,
      status: 502,
      error: 'Unexpected NSE live advance/decline payload shape',
    };
  }

  await ensureAdRatioDailyTable();
  const existing = await getAdRatioDailyByDate(parsed.tradeDateIst);
  const shouldUpdate =
    options?.force === true ||
    !existing ||
    !areRatiosEqual(existing.ad_ratio, parsed.adRatio);

  if (shouldUpdate) {
    await upsertAdRatioDaily({
      trade_date: parsed.tradeDateIst,
      advances: parsed.advances,
      declines: parsed.declines,
      unchange: parsed.unchange,
      total: parsed.total,
      ad_ratio: parsed.adRatio,
      nse_timestamp: parsed.nseTimestampIso,
    });
  }

  return {
    ok: true,
    updated: shouldUpdate,
    stored: {
      trade_date: parsed.tradeDateIst,
      advances: parsed.advances,
      declines: parsed.declines,
      ad_ratio: parsed.adRatio,
    },
  };
}

/** Fetches today's A/D from NSE and writes to Neon only when today's ratio changed. */
export async function syncAdRatioTodayIfChanged(): Promise<SyncAdRatioTodayResult> {
  return syncAdRatioToday();
}
