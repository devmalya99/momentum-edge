export type ParsedLiveAd = {
  /** Calendar date in Asia/Kolkata (YYYY-MM-DD). */
  tradeDateIst: string;
  advances: number;
  declines: number;
  unchange: number;
  total: number;
  adRatio: number | null;
  /** ISO string for Postgres `timestamptz`, or null if NSE timestamp was not parseable. */
  nseTimestampIso: string | null;
};

function formatDateIst(d: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

export function parseNseLiveAdvanceDecline(data: unknown): ParsedLiveAd | null {
  if (typeof data !== 'object' || data === null) return null;
  const o = data as Record<string, unknown>;
  const adv = o.advance;
  if (typeof adv !== 'object' || adv === null) return null;
  const count = (adv as Record<string, unknown>).count;
  if (typeof count !== 'object' || count === null) return null;
  const c = count as Record<string, unknown>;

  const advances = Number(c.Advances);
  const declines = Number(c.Declines);
  if (!Number.isFinite(advances) || !Number.isFinite(declines)) return null;

  const unchange = Number(c.Unchange ?? 0);
  const totalRaw = Number(c.Total);
  const total = Number.isFinite(totalRaw)
    ? Math.round(totalRaw)
    : Math.round(advances + declines + (Number.isFinite(unchange) ? unchange : 0));

  const tsRaw = o.timestamp;
  const tsString = typeof tsRaw === 'string' ? tsRaw : '';
  const parsed = tsString ? new Date(tsString) : new Date(NaN);
  const tradeDateIst = Number.isNaN(parsed.getTime())
    ? formatDateIst(new Date())
    : formatDateIst(parsed);

  const nseTimestampIso = Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
  const adRatio = declines > 0 ? advances / declines : null;

  return {
    tradeDateIst,
    advances: Math.round(advances),
    declines: Math.round(declines),
    unchange: Number.isFinite(unchange) ? Math.round(unchange) : 0,
    total,
    adRatio,
    nseTimestampIso,
  };
}
