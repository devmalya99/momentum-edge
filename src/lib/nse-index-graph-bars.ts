import type { NseDailyBar } from '@/lib/nse-equity-historical-kline';

/** NSE `getGraphChart` wraps points in `data.grapthData` (sic). */
export function indexGraphChartPayloadToDailyBars(payload: unknown): NseDailyBar[] {
  const root = payload as {
    data?: { grapthData?: unknown[][]; graphData?: unknown[][] };
    grapthData?: unknown[][];
  };
  const inner = root?.data;
  const gd = Array.isArray(inner?.grapthData)
    ? inner.grapthData
    : Array.isArray(inner?.graphData)
      ? inner.graphData
      : Array.isArray(root?.grapthData)
        ? root.grapthData
        : [];

  const out: NseDailyBar[] = [];
  for (const pt of gd) {
    if (!Array.isArray(pt) || pt.length < 2) continue;
    const ts = Number(pt[0]);
    const close = Number(pt[1]);
    if (!Number.isFinite(ts) || !Number.isFinite(close)) continue;
    out.push({
      timestamp: ts,
      open: close,
      high: close,
      low: close,
      close,
      volume: 0,
      turnover: 0,
    });
  }
  return out.sort((a, b) => a.timestamp - b.timestamp);
}
