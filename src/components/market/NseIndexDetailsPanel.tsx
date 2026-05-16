'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  BarChart3,
  Loader2,
  RefreshCcw,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Search,
} from 'lucide-react';
import type { NseIndexDetailsPayload, NseIndexEquityRow } from '@/lib/nse-index-details-types';

const PAGE_SIZE = 50;

type SortKey = 'pChange' | 'symbol' | 'totalTradedValue';

type Props = {
  indexName?: string;
  reloadToken?: number;
};

function parseCount(raw: string): number {
  const n = Number(String(raw).replace(/,/g, '').trim());
  return Number.isFinite(n) ? Math.round(n) : 0;
}

function formatInr(v: number): string {
  if (!Number.isFinite(v)) return '—';
  if (v >= 1e7) return `₹${(v / 1e7).toFixed(2)} Cr`;
  if (v >= 1e5) return `₹${(v / 1e5).toFixed(2)} L`;
  return `₹${v.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
}

function formatVolume(v: number): string {
  if (!Number.isFinite(v)) return '—';
  if (v >= 1e7) return `${(v / 1e7).toFixed(2)} Cr`;
  if (v >= 1e5) return `${(v / 1e5).toFixed(2)} L`;
  return v.toLocaleString('en-IN');
}

function pctClass(v: number): string {
  if (v > 0) return 'text-green-400';
  if (v < 0) return 'text-red-400';
  return 'text-gray-400';
}

function StatCell({ label, value, sub }: { label: string; value: React.ReactNode; sub?: string }) {
  return (
    <div className="p-3 rounded-2xl bg-[#0a0a0b] border border-white/5">
      <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-1">{label}</div>
      <div className="text-sm font-semibold text-gray-100 tabular-nums">{value}</div>
      {sub ? <div className="text-[10px] text-gray-500 mt-0.5">{sub}</div> : null}
    </div>
  );
}

function sortRows(rows: NseIndexEquityRow[], sortKey: SortKey, desc: boolean): NseIndexEquityRow[] {
  const sorted = [...rows];
  sorted.sort((a, b) => {
    if (sortKey === 'symbol') {
      return a.symbol.localeCompare(b.symbol);
    }
    const av = sortKey === 'pChange' ? a.pChange : a.totalTradedValue;
    const bv = sortKey === 'pChange' ? b.pChange : b.totalTradedValue;
    return av - bv;
  });
  return desc ? sorted.reverse() : sorted;
}

export default function NseIndexDetailsPanel({
  indexName = 'NIFTY 500',
  reloadToken = 0,
}: Props) {
  const [details, setDetails] = useState<NseIndexDetailsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('pChange');
  const [sortDesc, setSortDesc] = useState(true);
  const [page, setPage] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/nse/index-details?index=${encodeURIComponent(indexName)}`,
        { cache: 'no-store' },
      );
      const payload = (await response.json()) as NseIndexDetailsPayload & {
        error?: string;
        detail?: string;
      };

      if (!response.ok) {
        const msg =
          typeof payload?.error === 'string' ? payload.error : 'Failed to load index details.';
        const detail =
          typeof payload?.detail === 'string' && payload.detail.length > 0 ? ` ${payload.detail}` : '';
        throw new Error(msg + detail);
      }

      setDetails(payload);
      setPage(0);
    } catch (err: unknown) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Request failed.');
      setDetails(null);
    } finally {
      setLoading(false);
    }
  }, [indexName]);

  useEffect(() => {
    void load();
  }, [load, reloadToken]);

  const filtered = useMemo(() => {
    if (!details?.constituents) return [];
    const q = query.trim().toLowerCase();
    const base = q
      ? details.constituents.filter(
          (r) =>
            r.symbol.toLowerCase().includes(q) || r.companyName.toLowerCase().includes(q),
        )
      : details.constituents;
    return sortRows(base, sortKey, sortDesc);
  }, [details, query, sortKey, sortDesc]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const pageRows = filtered.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);

  const meta = details?.metadata;
  const ms = details?.marketStatus;
  const advances = parseCount(details?.advance.advances ?? '');
  const declines = parseCount(details?.advance.declines ?? '');
  const unchanged = parseCount(details?.advance.unchanged ?? '');
  const indexAdRatio = declines > 0 ? advances / declines : null;

  return (
    <div className="p-8 rounded-3xl bg-[#161618] border border-white/5 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-sm font-bold text-gray-500 uppercase tracking-widest flex items-center gap-2">
            <BarChart3 className="text-violet-400/90" size={16} aria-hidden />
            {indexName}
          </h2>
          <p className="text-xs text-gray-500 mt-1 max-w-2xl">
            NSE index details via{' '}
            <span className="text-gray-400 font-mono text-[10px]">equity-stockIndices</span>
            {details?.timestamp ? (
              <>
                {' '}
                · updated <span className="text-gray-400">{details.timestamp}</span>
              </>
            ) : null}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="p-2.5 rounded-xl bg-white/5 border border-white/10 text-gray-400 hover:text-white hover:bg-white/10 disabled:opacity-50"
          aria-label="Refresh index details"
        >
          {loading ? <Loader2 size={18} className="animate-spin" /> : <RefreshCcw size={18} />}
        </button>
      </div>

      {error ? (
        <div className="flex items-start gap-2 text-sm text-red-400/90 rounded-xl border border-red-500/20 bg-red-500/5 px-3 py-2">
          <AlertTriangle size={18} className="shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      ) : null}

      {loading && !details ? (
        <div className="h-48 flex flex-col items-center justify-center gap-3 border border-white/5 rounded-2xl bg-[#0a0a0b]">
          <Loader2 className="animate-spin text-violet-400" size={28} />
          <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">
            Loading {indexName}…
          </span>
        </div>
      ) : details && meta ? (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2 p-5 rounded-2xl bg-violet-500/5 border border-violet-500/15 space-y-3">
              <div className="flex flex-wrap items-end gap-3">
                <span className="text-4xl font-black tabular-nums tracking-tight">
                  {meta.last.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                </span>
                <span className={`text-lg font-bold tabular-nums ${pctClass(meta.percChange)}`}>
                  {meta.percChange >= 0 ? '+' : ''}
                  {meta.percChange.toFixed(2)}%
                </span>
                <span className="text-sm text-gray-500 tabular-nums">
                  ({meta.change >= 0 ? '+' : ''}
                  {meta.change.toFixed(2)})
                </span>
              </div>
              <p className="text-xs text-gray-500">
                {meta.indexName} · session {meta.timeVal || '—'}
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-[#0a0a0b] border border-white/5 space-y-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500">
                Index breadth (constituents)
              </p>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div>
                  <div className="text-lg font-black text-green-400 tabular-nums">{advances}</div>
                  <div className="text-[10px] text-gray-500">Adv</div>
                </div>
                <div>
                  <div className="text-lg font-black text-red-400 tabular-nums">{declines}</div>
                  <div className="text-[10px] text-gray-500">Dec</div>
                </div>
                <div>
                  <div className="text-lg font-black text-gray-400 tabular-nums">{unchanged}</div>
                  <div className="text-[10px] text-gray-500">Unch</div>
                </div>
              </div>
              {indexAdRatio != null ? (
                <p className="text-xs text-gray-400">
                  Constituent A/D:{' '}
                  <span className="font-semibold text-gray-200">{indexAdRatio.toFixed(2)}</span>
                </p>
              ) : null}
            </div>
          </div>

          {ms ? (
            <div className="rounded-2xl border border-white/10 bg-[#0a0a0b] px-4 py-3 flex flex-wrap gap-x-6 gap-y-2 text-xs">
              <span className="text-gray-500 uppercase tracking-wide font-bold">Market</span>
              <span className="text-gray-300">{ms.marketStatusMessage || ms.marketStatus}</span>
              <span className="text-gray-500">
                Trade date: <span className="text-gray-300">{ms.tradeDate}</span>
              </span>
              <span className="text-gray-500">
                Index last:{' '}
                <span className="text-gray-300 tabular-nums">
                  {ms.last.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                </span>
              </span>
              <span className={`tabular-nums font-medium ${pctClass(ms.percentChange)}`}>
                {ms.percentChange >= 0 ? '+' : ''}
                {ms.percentChange.toFixed(2)}%
              </span>
            </div>
          ) : null}

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-2">
            <StatCell label="Open" value={meta.open.toFixed(2)} />
            <StatCell label="High" value={meta.high.toFixed(2)} />
            <StatCell label="Low" value={meta.low.toFixed(2)} />
            <StatCell label="Prev close" value={meta.previousClose.toFixed(2)} />
            <StatCell label="Year high" value={meta.yearHigh.toFixed(2)} />
            <StatCell label="Year low" value={meta.yearLow.toFixed(2)} />
            <StatCell
              label="30d change"
              value={
                <span className={pctClass(meta.perChange30d)}>
                  {meta.perChange30d >= 0 ? '+' : ''}
                  {meta.perChange30d.toFixed(2)}%
                </span>
              }
              sub={details.date30dAgo || meta.date30dAgo}
            />
            <StatCell
              label="365d change"
              value={
                <span className={pctClass(meta.perChange365d)}>
                  {meta.perChange365d >= 0 ? '+' : ''}
                  {meta.perChange365d.toFixed(2)}%
                </span>
              }
              sub={details.date365dAgo || meta.date365dAgo}
            />
            <StatCell label="Traded value" value={formatInr(meta.totalTradedValue)} />
            <StatCell label="Traded volume" value={formatVolume(meta.totalTradedVolume)} />
            <StatCell label="FFMC sum" value={formatInr(meta.ffmc_sum)} />
            <StatCell label="Indicative close" value={meta.indicativeClose.toFixed(2)} />
          </div>

          <div className="space-y-3 border-t border-white/5 pt-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <h3 className="text-xs font-bold uppercase tracking-widest text-gray-500">
                Constituents ({filtered.length})
              </h3>
              <div className="flex flex-wrap items-center gap-2">
                <label className="relative flex items-center">
                  <Search className="absolute left-2.5 text-gray-500" size={14} aria-hidden />
                  <input
                    type="search"
                    value={query}
                    onChange={(e) => {
                      setQuery(e.target.value);
                      setPage(0);
                    }}
                    placeholder="Symbol or name…"
                    className="pl-8 pr-3 py-2 rounded-xl border border-white/10 bg-[#0a0a0b] text-sm text-gray-200 w-44 sm:w-52 outline-none focus:border-violet-500/40"
                  />
                </label>
                <select
                  value={sortKey}
                  onChange={(e) => {
                    setSortKey(e.target.value as SortKey);
                    setPage(0);
                  }}
                  className="rounded-xl border border-white/10 bg-[#0a0a0b] px-3 py-2 text-xs text-gray-300"
                  aria-label="Sort constituents"
                >
                  <option value="pChange">% change</option>
                  <option value="totalTradedValue">Turnover</option>
                  <option value="symbol">Symbol</option>
                </select>
                <button
                  type="button"
                  onClick={() => setSortDesc((d) => !d)}
                  className="px-3 py-2 rounded-xl border border-white/10 bg-[#0a0a0b] text-xs text-gray-300 hover:border-white/20"
                >
                  {sortDesc ? 'Desc' : 'Asc'}
                </button>
              </div>
            </div>

            <div className="overflow-x-auto rounded-2xl border border-white/10">
              <table className="w-full text-left text-xs min-w-[720px]">
                <thead>
                  <tr className="border-b border-white/10 bg-white/3 text-[10px] font-bold uppercase tracking-wider text-gray-500">
                    <th className="px-3 py-2.5">Symbol</th>
                    <th className="px-3 py-2.5 min-w-[140px]">Name</th>
                    <th className="px-3 py-2.5 text-right">LTP</th>
                    <th className="px-3 py-2.5 text-right">Chg %</th>
                    <th className="px-3 py-2.5 text-right">30d %</th>
                    <th className="px-3 py-2.5 text-right">Turnover</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {pageRows.map((r) => (
                    <tr key={r.symbol} className="hover:bg-white/2">
                      <td className="px-3 py-2 font-mono font-semibold text-violet-300/90">{r.symbol}</td>
                      <td className="px-3 py-2 text-gray-300 max-w-[200px] truncate" title={r.companyName}>
                        {r.companyName}
                      </td>
                      <td className="px-3 py-2 text-right font-mono tabular-nums text-gray-200">
                        {r.lastPrice.toFixed(2)}
                      </td>
                      <td className={`px-3 py-2 text-right font-mono tabular-nums ${pctClass(r.pChange)}`}>
                        <span className="inline-flex items-center justify-end gap-0.5">
                          {r.pChange > 0 ? (
                            <TrendingUp size={12} className="opacity-70" />
                          ) : r.pChange < 0 ? (
                            <TrendingDown size={12} className="opacity-70" />
                          ) : null}
                          {r.pChange >= 0 ? '+' : ''}
                          {r.pChange.toFixed(2)}%
                        </span>
                      </td>
                      <td className={`px-3 py-2 text-right font-mono tabular-nums ${pctClass(r.perChange30d)}`}>
                        {r.perChange30d >= 0 ? '+' : ''}
                        {r.perChange30d.toFixed(2)}%
                      </td>
                      <td className="px-3 py-2 text-right font-mono tabular-nums text-gray-400">
                        {formatInr(r.totalTradedValue)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {pageCount > 1 ? (
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-gray-500">
                <span>
                  Page {safePage + 1} of {pageCount}
                </span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={safePage <= 0}
                    onClick={() => setPage((p) => Math.max(0, p - 1))}
                    className="px-3 py-1.5 rounded-lg border border-white/10 disabled:opacity-40 hover:bg-white/5"
                  >
                    Previous
                  </button>
                  <button
                    type="button"
                    disabled={safePage >= pageCount - 1}
                    onClick={() => setPage((p) => p + 1)}
                    className="px-3 py-1.5 rounded-lg border border-white/10 disabled:opacity-40 hover:bg-white/5"
                  >
                    Next
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </>
      ) : !loading ? (
        <p className="text-sm text-gray-500 py-8 text-center">No index data available.</p>
      ) : null}
    </div>
  );
}
