'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Layers, Loader2, RefreshCcw, AlertTriangle } from 'lucide-react';
import type { NseLargeDealRow, NseLargeDealSnapshot } from '@/lib/nse-large-deal';
import { normalizeLargeDealRows } from '@/lib/nse-large-deal';

function buySideOnly(rows: NseLargeDealRow[]): NseLargeDealRow[] {
  return rows.filter((r) => r.buySell?.trim().toUpperCase() === 'BUY');
}

function formatQty(qty: string): string {
  const n = Number(String(qty).replace(/,/g, ''));
  if (!Number.isFinite(n)) return qty;
  return n.toLocaleString('en-IN');
}

type GroupedDealRow = {
  symbol: string;
  name: string;
  txCount: number;
  totalQty: number;
  totalTurnover: number;
};

const MIN_TURNOVER_FILTER = 100_000_000; // 10 crore

function toNumber(raw: string | null | undefined): number | null {
  if (typeof raw !== 'string') return null;
  const n = Number(raw.replace(/,/g, '').trim());
  return Number.isFinite(n) ? n : null;
}

function aggregateDealsBySymbol(rows: NseLargeDealRow[]): GroupedDealRow[] {
  const grouped = new Map<string, GroupedDealRow>();

  for (const row of rows) {
    const symbol = row.symbol?.trim().toUpperCase();
    if (!symbol) continue;

    const qty = toNumber(row.qty);
    const watp = toNumber(row.watp);
    if (qty == null || watp == null) continue;

    const turnover = qty * watp;
    const prev = grouped.get(symbol);
    if (!prev) {
      grouped.set(symbol, {
        symbol,
        name: row.name ?? symbol,
        txCount: 1,
        totalQty: qty,
        totalTurnover: turnover,
      });
    } else {
      grouped.set(symbol, {
        ...prev,
        txCount: prev.txCount + 1,
        totalQty: prev.totalQty + qty,
        totalTurnover: prev.totalTurnover + turnover,
      });
    }
  }

  return Array.from(grouped.values())
    .filter((row) => row.totalTurnover >= MIN_TURNOVER_FILTER)
    .sort((a, b) => b.totalTurnover - a.totalTurnover);
}

function formatInr(v: number): string {
  return `₹${v.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
}

function DealTable({ rows, emptyLabel }: { rows: GroupedDealRow[]; emptyLabel: string }) {
  if (rows.length === 0) {
    return (
      <p className="text-sm text-gray-500 py-6 text-center border border-dashed border-white/10 rounded-2xl">
        {emptyLabel}
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-white/10">
      <table className="w-full text-left text-xs min-w-[680px]">
        <thead>
          <tr className="border-b border-white/10 bg-white/3 text-[10px] font-bold uppercase tracking-wider text-gray-500">
            <th className="px-3 py-2.5 whitespace-nowrap">Symbol</th>
            <th className="px-3 py-2.5 min-w-[140px]">Name</th>
            <th className="px-3 py-2.5 text-right whitespace-nowrap">Transactions</th>
            <th className="px-3 py-2.5 text-right whitespace-nowrap">Total Qty</th>
            <th className="px-3 py-2.5 text-right whitespace-nowrap">Total Qty × WATP</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/5">
          {rows.map((r, i) => (
            <tr key={`${r.symbol}-${i}`} className="hover:bg-white/2">
              <td className="px-3 py-2 font-mono font-semibold text-emerald-300/90 whitespace-nowrap">
                {r.symbol}
              </td>
              <td className="px-3 py-2 text-gray-300 max-w-[220px] truncate" title={r.name}>
                {r.name}
              </td>
              <td className="px-3 py-2 text-right font-mono tabular-nums text-gray-300">
                {r.txCount.toLocaleString('en-IN')}
              </td>
              <td className="px-3 py-2 text-right font-mono tabular-nums text-gray-200">
                {formatQty(String(r.totalQty))}
              </td>
              <td className="px-3 py-2 text-right font-mono tabular-nums text-amber-300/90">
                {formatInr(r.totalTurnover)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

type Props = {
  /** Increment from parent to trigger reload (e.g. global refresh). */
  reloadToken?: number;
};

export default function LargeDealsPanel({ reloadToken = 0 }: Props) {
  const [snapshot, setSnapshot] = useState<NseLargeDealSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<'bulk' | 'block'>('bulk');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/nse/large-deals', { cache: 'no-store' });
      const payload = (await response.json()) as NseLargeDealSnapshot & { error?: string; detail?: string };

      if (!response.ok) {
        const msg =
          typeof payload?.error === 'string' ? payload.error : 'Failed to load large deals.';
        const detail =
          typeof payload?.detail === 'string' && payload.detail.length > 0 ? ` ${payload.detail}` : '';
        throw new Error(msg + detail);
      }

      setSnapshot(payload);
    } catch (err: unknown) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Request failed.');
      setSnapshot(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load, reloadToken]);

  const bulkRows = useMemo(
    () => aggregateDealsBySymbol(buySideOnly(normalizeLargeDealRows(snapshot?.BULK_DEALS_DATA))),
    [snapshot],
  );
  const blockRows = useMemo(
    () => aggregateDealsBySymbol(buySideOnly(normalizeLargeDealRows(snapshot?.BLOCK_DEALS_DATA))),
    [snapshot],
  );

  return (
    <div className="p-8 rounded-3xl bg-[#161618] border border-white/5 space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-sm font-bold text-gray-500 uppercase tracking-widest flex items-center gap-2">
            <Layers className="text-amber-400/90" size={16} aria-hidden />
            Bulk &amp; block deals
          </h2>
          <p className="text-xs text-gray-500 mt-1 max-w-2xl">
            <span className="text-emerald-400/90 font-medium">Buy side only</span>
            {' — '}
            Source: NSE India{' '}
            <span className="text-gray-400 font-mono text-[10px]">snapshot-capital-market-largedeal</span>
            {' · grouped by symbol · sorted by total Qty × WATP (desc)'}
            {snapshot?.as_on_date ? (
              <>
                {' '}
                · as on <span className="text-gray-400">{snapshot.as_on_date}</span>
              </>
            ) : null}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {snapshot?.BULK_DEALS != null ? (
            <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-lg bg-white/5 text-gray-400 border border-white/10">
              Bulk count {snapshot.BULK_DEALS}
            </span>
          ) : null}
          {snapshot?.BLOCK_DEALS != null ? (
            <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-lg bg-white/5 text-gray-400 border border-white/10">
              Block count {snapshot.BLOCK_DEALS}
            </span>
          ) : null}
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-medium bg-white/5 border border-white/10 hover:bg-white/10 text-gray-300 disabled:opacity-50"
          >
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <RefreshCcw className="h-3.5 w-3.5" aria-hidden />}
            Refresh
          </button>
        </div>
      </div>

      {error ? (
        <div className="p-4 rounded-2xl bg-amber-500/5 border border-amber-500/15 flex items-start gap-3">
          <AlertTriangle className="text-amber-500 shrink-0" size={18} />
          <p className="text-sm text-gray-300">{error}</p>
        </div>
      ) : null}

      {loading && !snapshot ? (
        <div className="h-40 flex flex-col items-center justify-center gap-3 border border-dashed border-white/10 rounded-2xl">
          <Loader2 className="h-8 w-8 text-amber-500/80 animate-spin" aria-hidden />
          <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">Loading deals…</span>
        </div>
      ) : (
        <>
          <div className="flex gap-1 p-1 rounded-xl bg-[#0a0a0b] border border-white/10 w-fit">
            <button
              type="button"
              onClick={() => setTab('bulk')}
              className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wide transition-colors ${
                tab === 'bulk'
                  ? 'bg-amber-500/20 text-amber-200 border border-amber-500/30'
                  : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              Bulk ({bulkRows.length})
            </button>
            <button
              type="button"
              onClick={() => setTab('block')}
              className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wide transition-colors ${
                tab === 'block'
                  ? 'bg-sky-500/20 text-sky-200 border border-sky-500/30'
                  : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              Block ({blockRows.length})
            </button>
          </div>

          {tab === 'bulk' ? (
            <DealTable rows={bulkRows} emptyLabel="No bulk buy deals to aggregate in this snapshot." />
          ) : (
            <DealTable rows={blockRows} emptyLabel="No block buy deals to aggregate in this snapshot." />
          )}
        </>
      )}
    </div>
  );
}
