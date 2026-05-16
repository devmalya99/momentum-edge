import type { NseDailyBar } from '@/lib/nse-equity-historical-kline';
import type { MarketTechnicalBar, MarketTechnicalSnapshot } from '@/features/market-technical/types';

function lastFinite<T extends number | null>(arr: T[]): T | null {
  for (let i = arr.length - 1; i >= 0; i--) {
    const v = arr[i];
    if (v != null && Number.isFinite(v)) return v;
  }
  return null;
}

/**
 * Exponential moving average. Seeds with SMA of first `period` closes, then classic EMA.
 */
export function emaSeries(closes: number[], period: number): (number | null)[] {
  const out: (number | null)[] = Array(closes.length).fill(null);
  if (period < 1 || closes.length === 0) return out;
  const k = 2 / (period + 1);
  let prev: number | null = null;
  for (let i = 0; i < closes.length; i++) {
    const v = closes[i];
    if (!Number.isFinite(v)) continue;
    if (prev === null) {
      if (i >= period - 1) {
        let sum = 0;
        let ok = true;
        for (let j = 0; j < period; j++) {
          const x = closes[i - period + 1 + j];
          if (!Number.isFinite(x)) {
            ok = false;
            break;
          }
          sum += x;
        }
        if (ok) {
          prev = sum / period;
          out[i] = prev;
        }
      }
    } else {
      prev = v * k + prev * (1 - k);
      out[i] = prev;
    }
  }
  return out;
}

export function rsiWilderSeries(closes: number[], period = 14): (number | null)[] {
  const out: (number | null)[] = Array(closes.length).fill(null);
  if (closes.length < period + 1) return out;
  let avgGain: number | null = null;
  let avgLoss: number | null = null;

  for (let i = 1; i < closes.length; i++) {
    const change = closes[i] - closes[i - 1];
    const gain = change > 0 ? change : 0;
    const loss = change < 0 ? -change : 0;

    if (i < period) continue;

    if (avgGain === null || avgLoss === null) {
      let g = 0;
      let l = 0;
      for (let j = i - period + 1; j <= i; j++) {
        const ch = closes[j] - closes[j - 1];
        if (ch > 0) g += ch;
        else l -= ch;
      }
      avgGain = g / period;
      avgLoss = l / period;
    } else {
      avgGain = (avgGain * (period - 1) + gain) / period;
      avgLoss = (avgLoss * (period - 1) + loss) / period;
    }

    if (avgLoss === 0) out[i] = 100;
    else if (avgGain === 0) out[i] = 0;
    else {
      const rs = avgGain / avgLoss;
      out[i] = 100 - 100 / (1 + rs);
    }
  }
  return out;
}

export function bollingerSeries(
  closes: number[],
  period = 20,
  mult = 2,
): { upper: (number | null)[]; middle: (number | null)[]; lower: (number | null)[] } {
  const upper: (number | null)[] = Array(closes.length).fill(null);
  const middle: (number | null)[] = Array(closes.length).fill(null);
  const lower: (number | null)[] = Array(closes.length).fill(null);
  for (let i = 0; i < closes.length; i++) {
    if (i < period - 1) continue;
    const slice = closes.slice(i - period + 1, i + 1);
    if (slice.some((x) => !Number.isFinite(x))) continue;
    const m = slice.reduce((a, b) => a + b, 0) / period;
    const variance = slice.reduce((s, x) => s + (x - m) ** 2, 0) / period;
    const sd = Math.sqrt(variance);
    middle[i] = m;
    upper[i] = m + mult * sd;
    lower[i] = m - mult * sd;
  }
  return { upper, middle, lower };
}

export function atrWilderSeries(
  highs: number[],
  lows: number[],
  closes: number[],
  period = 14,
): (number | null)[] {
  const out: (number | null)[] = Array(closes.length).fill(null);
  const n = closes.length;
  if (highs.length !== n || lows.length !== n || n < period) return out;

  const tr: number[] = new Array(n);
  for (let i = 0; i < n; i++) {
    const h = highs[i];
    const l = lows[i];
    const c = closes[i];
    const pc = i > 0 ? closes[i - 1] : c;
    if (!Number.isFinite(h) || !Number.isFinite(l) || !Number.isFinite(c)) {
      tr[i] = NaN;
    } else {
      tr[i] = Math.max(h - l, Math.abs(h - pc), Math.abs(l - pc));
    }
  }

  let seed = 0;
  for (let j = 0; j < period; j++) {
    if (!Number.isFinite(tr[j])) return out;
    seed += tr[j];
  }
  let atr = seed / period;
  out[period - 1] = atr;
  for (let i = period; i < n; i++) {
    const t = tr[i];
    if (!Number.isFinite(t)) continue;
    atr = (atr * (period - 1) + t) / period;
    out[i] = atr;
  }
  return out;
}

export function macdSeries(
  closes: number[],
  fast = 12,
  slow = 26,
  signalPeriod = 9,
): { line: (number | null)[]; signal: (number | null)[]; hist: (number | null)[] } {
  const eF = emaSeries(closes, fast);
  const eS = emaSeries(closes, slow);
  const line: (number | null)[] = closes.map((_, i) => {
    const a = eF[i];
    const b = eS[i];
    if (a == null || b == null) return null;
    return a - b;
  });
  const start = line.findIndex((x) => x != null);
  const signal: (number | null)[] = Array(closes.length).fill(null);
  const hist: (number | null)[] = Array(closes.length).fill(null);
  if (start < 0) {
    return { line, signal, hist };
  }
  const compact = line.slice(start).map((x) => x as number);
  const sigCompact = emaSeries(compact, signalPeriod);
  for (let j = 0; j < sigCompact.length; j++) {
    const i = start + j;
    signal[i] = sigCompact[j];
    const m = line[i];
    const s = signal[i];
    if (m != null && s != null) hist[i] = m - s;
  }
  return { line, signal, hist };
}

function barsToWire(rows: NseDailyBar[]): MarketTechnicalBar[] {
  return rows.map((r) => ({
    t: r.timestamp,
    o: r.open,
    h: r.high,
    l: r.low,
    c: r.close,
    v: r.volume,
  }));
}

export function buildMarketTechnicalSnapshot(bars: NseDailyBar[]): {
  wire: MarketTechnicalBar[];
  snapshot: MarketTechnicalSnapshot;
} {
  const sorted = [...bars].sort((a, b) => a.timestamp - b.timestamp);
  const wire = barsToWire(sorted);
  const closes = sorted.map((b) => b.close);
  const highs = sorted.map((b) => b.high);
  const lows = sorted.map((b) => b.low);
  const vols = sorted.map((b) => b.volume);

  const n = sorted.length;
  const lastIdx = n - 1;
  const prevClose = lastIdx > 0 ? closes[lastIdx - 1] : null;
  const close = closes[lastIdx] ?? 0;
  const changePct =
    prevClose != null && Number.isFinite(prevClose) && prevClose !== 0
      ? ((close - prevClose) / prevClose) * 100
      : null;

  const e20 = emaSeries(closes, 20);
  const e50 = emaSeries(closes, 50);
  const e200 = emaSeries(closes, 200);
  const rsi = rsiWilderSeries(closes, 14);
  const { line: macdL, signal: macdS, hist: macdH } = macdSeries(closes, 12, 26, 9);
  const bb = bollingerSeries(closes, 20, 2);
  const atr = atrWilderSeries(highs, lows, closes, 14);

  const snapshot: MarketTechnicalSnapshot = {
    asOfTimestamp: sorted[lastIdx]?.timestamp ?? 0,
    close,
    prevClose,
    changePct,
    rsi14: lastFinite(rsi),
    ema20: lastFinite(e20),
    ema50: lastFinite(e50),
    ema200: lastFinite(e200),
    macdLine: lastFinite(macdL),
    macdSignal: lastFinite(macdS),
    macdHist: lastFinite(macdH),
    bbUpper: lastFinite(bb.upper),
    bbMiddle: lastFinite(bb.middle),
    bbLower: lastFinite(bb.lower),
    atr14: lastFinite(atr),
    volume: vols[lastIdx] ?? 0,
  };

  return { wire, snapshot };
}
