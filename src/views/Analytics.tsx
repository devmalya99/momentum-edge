'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import {
  Upload,
  Loader2,
  ShieldAlert,
  CheckCircle2,
  TrendingUp,
  TrendingDown,
  Receipt,
  Wallet,
  PieChart,
  Shield,
  Scale,
  GitBranch,
  Landmark,
} from 'lucide-react';
import { parsePnlXlsxBufferToIndexedRecord } from '@/analytics/pnlXlsxToIndexedRecord';
import { saveAnalyticsPnlUpload } from '@/db/traderAnalyticsDb';
import {
  computeAnalyticsPnlOverview,
  computeAnalyticsQualityMetrics,
  LARGE_LOSS_THRESHOLD_INR,
  useAnalyticsPnlStore,
} from '@/store/useAnalyticsPnlStore';
import { formatInr } from '@/lib/format-inr';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import EquityCurveChart from '@/components/trader-analytics/EquityCurveChart';
import TradePnlPctDistributionChart from '@/components/trader-analytics/TradePnlPctDistributionChart';

function isEmptyStringCell(v: unknown): boolean {
  if (v === '') return true;
  if (typeof v === 'string' && v.trim() === '') return true;
  return false;
}

function compactRows(rows: unknown[][]): unknown[][] {
  return rows
    .map((row) => (Array.isArray(row) ? row : []).filter((cell) => !isEmptyStringCell(cell)))
    .filter((row) => row.length > 0);
}

function signedClass(n: number): string {
  if (n > 0) return 'text-emerald-400';
  if (n < 0) return 'text-red-400';
  return 'text-gray-300';
}

function formatPct(n: number | null, digits = 1): string {
  if (n === null || Number.isNaN(n)) return '—';
  return `${n.toFixed(digits)}%`;
}

type NetworthMasterSnapshot = {
  currentHoldingValue: number;
  zerodhaCashHolding?: number;
  marginAmount: number;
  realInvestFromBank: number;
};

export default function Analytics() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [justSaved, setJustSaved] = useState(false);

  const queryClient = useQueryClient();
  const record = useAnalyticsPnlStore((s) => s.record);
  const hydrate = useAnalyticsPnlStore((s) => s.hydrate);
  const setRecord = useAnalyticsPnlStore((s) => s.setRecord);

  const networthMasterQuery = useQuery({
    queryKey: ['networth-master'],
    queryFn: async (): Promise<NetworthMasterSnapshot | null> => {
      const res = await fetch('/api/networth/master', { cache: 'no-store' });
      if (res.status === 401) return null;
      if (!res.ok) throw new Error('Failed to load networth master');
      const body = (await res.json()) as { master: NetworthMasterSnapshot };
      return body.master;
    },
    retry: 1,
  });

  const [bankInput, setBankInput] = useState('');
  useEffect(() => {
    const m = networthMasterQuery.data;
    if (m === null || m === undefined) return;
    setBankInput(m.realInvestFromBank > 0 ? String(m.realInvestFromBank) : '');
  }, [networthMasterQuery.data?.realInvestFromBank]);

  const saveBankInvestMutation = useMutation({
    mutationFn: async (realInvestFromBank: number) => {
      const res = await fetch('/api/networth/real-invest-from-bank', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ realInvestFromBank }),
      });
      const body = (await res.json().catch(() => null)) as
        | { error?: string; ok?: boolean; master?: NetworthMasterSnapshot }
        | null;
      if (!res.ok) {
        throw new Error(body?.error ?? 'Failed to save');
      }
      if (!body?.ok) throw new Error('Invalid server response');
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['networth-master'] });
    },
  });

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  const overview = record ? computeAnalyticsPnlOverview(record) : null;
  const quality =
    record && overview ? computeAnalyticsQualityMetrics(record, overview) : null;
  const sum = record?.pnl_summary;

  const master = networthMasterQuery.data;
  const currentHolding = master ? Number(master.currentHoldingValue) || 0 : 0;
  const zerodhaCashHolding = master ? Number(master.zerodhaCashHolding) || 0 : 0;
  const marginAmt = master ? Number(master.marginAmount) || 0 : 0;
  const bankSaved = master ? Number(master.realInvestFromBank) || 0 : 0;
  const draftBank = (() => {
    const n = parseFloat(bankInput);
    return Number.isFinite(n) && n >= 0 ? n : bankSaved;
  })();
  const realReturnLifeTimeSaved =
    master !== null && master !== undefined
      ? currentHolding + zerodhaCashHolding - marginAmt - bankSaved
      : null;
  const realReturnLifeTimePreview =
    master !== null && master !== undefined
      ? currentHolding + zerodhaCashHolding - marginAmt - draftBank
      : null;
  const totalReturnPctSaved =
    realReturnLifeTimeSaved !== null && bankSaved > 0 ? (realReturnLifeTimeSaved / bankSaved) * 100 : null;
  const endValueSaved =
    master !== null && master !== undefined ? currentHolding + zerodhaCashHolding - marginAmt : null;
  const cagrAssumeOneYearSaved =
    endValueSaved !== null && bankSaved > 0 ? (Math.pow(endValueSaved / bankSaved, 1 / 1) - 1) * 100 : null;
  const bankInputDirty =
    master !== null &&
    master !== undefined &&
    bankInput.trim() !== (master.realInvestFromBank > 0 ? String(master.realInvestFromBank) : '');

  const chartTrades = useMemo(
    () =>
      record?.trade_details.map((t) => ({
        pnl: t.realised_pnl,
        label: t.symbol,
        pnlPct: t.realised_pnl_pct,
        totalTradeValue: t.total_trade_value,
      })) ?? [],
    [record],
  );
  const investmentStart = bankSaved > 0 ? bankSaved : 1000;

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setJustSaved(false);
    setBusy(true);
    try {
      const buf = await file.arrayBuffer();
      const workbook = XLSX.read(buf, { type: 'array', cellDates: true });

      for (const name of workbook.SheetNames) {
        const sheet = workbook.Sheets[name];
        if (!sheet) continue;
        const rawRows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
          header: 1,
          defval: '',
          raw: false,
        }) as unknown[][];
        const cleaned = compactRows(rawRows);
      }

      const result = parsePnlXlsxBufferToIndexedRecord(buf);
      if (!result.ok) {
        setError(result.error);
        return;
      }

      await saveAnalyticsPnlUpload(result.data);
      setRecord(result.data);
      setJustSaved(true);
      console.log('[Analytics xlsx] validated & saved to IndexedDB:');
    } catch (err) {
      console.error('[Analytics xlsx] failed:', err);
      setError(err instanceof Error ? err.message : 'Failed to read the file.');
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-20">
      <div className="relative overflow-hidden rounded-3xl border border-cyan-500/20 bg-[#090d16] p-6 sm:p-8">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(6,182,212,0.2),transparent_45%),radial-gradient(circle_at_bottom_left,rgba(99,102,241,0.2),transparent_40%)]" />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-white">Analytics</h1>
            <p className="mt-2 max-w-2xl text-sm text-cyan-100/70">
              Comprehensive capital breakdown and realized P&amp;L verification across your current
              investment lifecycle.
            </p>
          </div>
          <div className="flex gap-2">
            <span className="inline-flex items-center rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-cyan-100/80">
              Verified ledger
            </span>
            <span className="inline-flex items-center rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-gray-300">
              Session local sync
            </span>
          </div>
        </div>
      </div>

      <section className="rounded-3xl border border-cyan-500/20 bg-[#070c14] p-8 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.02)] space-y-6">
        <div className="flex items-center gap-2">
          <Landmark className="text-cyan-300" size={22} />
          <h2 className="text-lg font-semibold tracking-tight text-cyan-100">Bank capital &amp; true market profit</h2>
        </div>
        <p className="text-xs text-cyan-100/60 leading-relaxed">
          Enter the <span className="text-gray-400">net</span> amount you have transferred from your bank into
          this trading account over time (cash in, ignoring paper margin). We store it as{' '}
          <span className="font-mono text-gray-400">real_invest_from_bank</span> on the server. Lifetime true
          return uses your uploaded holdings value and broker margin from the Networth flow:{' '}
          <span className="font-mono text-gray-400">
            current_holding_value + zerodha_cash_holding − margin_amount − real_invest_from_bank
          </span>.
        </p>

        {networthMasterQuery.isPending ? (
          <div className="flex items-center gap-2 text-sm text-gray-400">
            <Loader2 className="h-4 w-4 animate-spin shrink-0" aria-hidden />
            Loading networth data…
          </div>
        ) : master === null ? (
          <p className="text-sm text-gray-500">Sign in to save bank transfers and see lifetime return.</p>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-5 rounded-2xl bg-[#080b12] border border-cyan-500/15 space-y-3">
                <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-500">
                  real_invest_from_bank (₹)
                </label>
                <div className="flex items-center gap-2">
                  <span className="text-gray-500">₹</span>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={bankInput}
                    onChange={(e) => setBankInput(e.target.value)}
                    disabled={saveBankInvestMutation.isPending}
                    className="w-full bg-transparent outline-none font-bold text-lg"
                    placeholder="0"
                  />
                </div>
                <button
                  type="button"
                  disabled={saveBankInvestMutation.isPending || !bankInputDirty}
                  onClick={() => {
                    const n = parseFloat(bankInput);
                    const v = Number.isFinite(n) && n >= 0 ? n : 0;
                    void saveBankInvestMutation.mutateAsync(v);
                  }}
                  className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 disabled:opacity-50 disabled:cursor-not-allowed text-[#001018] text-xs font-bold uppercase tracking-wider"
                >
                  {saveBankInvestMutation.isPending ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                  ) : null}
                  Save to server
                </button>
                {saveBankInvestMutation.isError ? (
                  <p className="text-xs text-red-400">{saveBankInvestMutation.error.message}</p>
                ) : null}
              </div>
              <div className="p-5 rounded-2xl bg-[#080b12] border border-cyan-500/15 ring-1 ring-cyan-500/20 space-y-3">
                <div className="text-[10px] font-bold uppercase tracking-widest text-gray-500">
                  real_return_life_time (saved)
                </div>
                <div
                  className={`text-2xl font-bold tabular-nums ${
                    realReturnLifeTimeSaved === null
                      ? 'text-gray-400'
                      : realReturnLifeTimeSaved >= 0
                        ? 'text-emerald-400'
                        : 'text-red-400'
                  }`}
                >
                  {realReturnLifeTimeSaved === null ? '—' : formatInr(realReturnLifeTimeSaved)}
                </div>
                <div className="text-[11px] text-gray-600 space-y-1 font-mono tabular-nums leading-relaxed">
                  <div className="flex justify-between gap-2">
                    <span className="text-gray-500">current_holding_value</span>
                    <span>{formatInr(currentHolding)}</span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-gray-500">+ zerodha_cash_holding</span>
                    <span>+{formatInr(zerodhaCashHolding)}</span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-gray-500">− margin_amount</span>
                    <span>−{formatInr(marginAmt)}</span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-gray-500">− real_invest_from_bank</span>
                    <span>−{formatInr(bankSaved)}</span>
                  </div>
                </div>
                <div className="border-t border-white/10 pt-3 space-y-1">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-gray-500">total_return_%</span>
                    <span className={signedClass(totalReturnPctSaved ?? 0)}>{formatPct(totalReturnPctSaved, 2)}</span>
                  </div>
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-gray-500">cagr (assume 1 year)</span>
                    <span className={signedClass(cagrAssumeOneYearSaved ?? 0)}>
                      {formatPct(cagrAssumeOneYearSaved, 2)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
            {bankInputDirty && realReturnLifeTimePreview !== null ? (
              <p className="text-[11px] text-gray-500">
                Preview with unsaved input:{' '}
                <span className={signedClass(realReturnLifeTimePreview)}>
                  {formatInr(realReturnLifeTimePreview)}
                </span>
              </p>
            ) : null}
          </>
        )}
      </section>

      {overview && (
        <section className="rounded-3xl border border-white/10 bg-[#0a1019] p-8 space-y-6">
          <div className="flex items-center gap-2">
            <Wallet className="text-emerald-300" size={22} />
            <h2 className="text-lg font-semibold tracking-tight text-white">P&amp;L overview</h2>
          </div>
          <p className="text-xs text-gray-400 leading-relaxed">
            Totals use per-symbol <span className="text-gray-400">realised_pnl</span> from your file.
            Charges and other credit/debit come from the broker summary block. Net after fees = sum of
            symbol P&amp;L − charges + other credit &amp; debit (signed).
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-5 rounded-2xl bg-[#070b11] border border-emerald-500/15">
              <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-2">
                <TrendingUp className="text-emerald-500/90" size={14} />
                Total profit (before fees &amp; charges)
              </div>
              <div className={`text-2xl font-bold tabular-nums ${signedClass(overview.totalProfitBeforeFees)}`}>
                {formatInr(overview.totalProfitBeforeFees)}
              </div>
              <p className="text-[11px] text-gray-600 mt-1">Sum of winning symbol rows only</p>
            </div>
            <div className="p-5 rounded-2xl bg-[#070b11] border border-red-500/15">
              <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-2">
                <TrendingDown className="text-red-400/90" size={14} />
                Total loss
              </div>
              <div className="text-2xl font-bold tabular-nums text-red-400">
                {formatInr(overview.totalLoss)}
              </div>
              <p className="text-[11px] text-gray-600 mt-1">Magnitude from losing symbol rows</p>
            </div>
            <div className="p-5 rounded-2xl bg-[#070b11] border border-amber-500/15">
              <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-2">
                <Receipt className="text-amber-400/90" size={14} />
                Total charges
              </div>
              <div className="text-2xl font-bold tabular-nums text-amber-200/90">
                {formatInr(overview.totalCharges)}
              </div>
              <p className="text-[11px] text-gray-600 mt-1">From summary &quot;Charges&quot; line</p>
            </div>
            <div className="p-5 rounded-2xl bg-[#070b11] border border-cyan-500/20 ring-1 ring-cyan-500/20">
              <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-2">
                <Wallet className="text-blue-400/90" size={14} />
                Profit after fees &amp; charges
              </div>
              <div className={`text-2xl font-bold tabular-nums ${signedClass(overview.profitAfterFeesAndCharges)}`}>
                {formatInr(overview.profitAfterFeesAndCharges)}
              </div>
              <p className="text-[11px] text-gray-600 mt-1">
                Σ symbol P&amp;L ({formatInr(overview.netRealizedFromSymbols)}) − charges + other
              </p>
            </div>
          </div>
        </section>
      )}

      {chartTrades.length > 0 && (
        <section className="rounded-3xl border border-cyan-500/20 bg-[#070d16] p-8 space-y-4">
          <div>
            <h2 className="text-lg font-semibold tracking-tight text-cyan-100">
              Cumulative realized profit chart
            </h2>
            <p className="text-xs text-cyan-100/60 mt-1 max-w-2xl leading-relaxed">
              Running total of per-symbol <span className="text-gray-400">realised_pnl</span> in the
              order rows appear in your workbook. Starts at zero; each step adds that row&apos;s P&amp;L
              (can go negative). This is trading profit only — not cash balance, margin, or holdings
              value.
            </p>
          </div>
          <div className="w-full min-h-[300px] min-w-0">
            <EquityCurveChart
              trades={chartTrades}
              height={300}
              curveOptions={{ includeOrigin: true }}
              xAxisLabel="Trade # (workbook row order)"
              cumulativeLabel="Net realized profit"
            />
          </div>
        </section>
      )}

      {chartTrades.length > 0 && (
        <section className="p-8 rounded-3xl bg-[#0a0a0b] border border-white/5 space-y-4">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">Investment growth (capital + P&amp;L)</h2>
            <p className="text-xs text-gray-500 mt-1 max-w-2xl leading-relaxed">
              Starts from <span className="text-gray-400">real_invest_from_bank</span> and then applies
              each row&apos;s <span className="text-gray-400">realised_pnl</span> in order (profit adds,
              loss subtracts). Using{' '}
              <span className="text-gray-300 font-mono">{formatInr(investmentStart)}</span>{' '}
              as starting capital {bankSaved > 0 ? '(from saved bank value)' : '(fallback default)'}.
            </p>
          </div>
          <div className="w-full min-h-[300px] min-w-0">
            <EquityCurveChart
              trades={chartTrades}
              height={300}
              curveOptions={{ includeOrigin: true, initialEquity: investmentStart }}
              xAxisLabel="Trade # (workbook row order)"
              cumulativeLabel="Investment value"
              yAxisMode="fitRange"
            />
          </div>
        </section>
      )}

      {chartTrades.length > 0 && (
        <section className="p-8 rounded-3xl bg-[#0a0a0b] border border-white/5 space-y-4">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">Realized P&amp;L per symbol (sorted)</h2>
            <p className="text-xs text-gray-500 mt-1 max-w-2xl leading-relaxed">
              One bar per symbol row, ordered from <span className="text-gray-400">largest loss</span> to{' '}
              <span className="text-gray-400">largest profit</span> by{' '}
              <span className="text-gray-400">realised_pnl</span> (rupees). Bar height is rupee P&amp;L; hover
              still shows return % and total trade value when present in the file.
            </p>
          </div>
          <div className="w-full min-h-[320px] min-w-0">
            <TradePnlPctDistributionChart trades={chartTrades} height={320} />
          </div>
        </section>
      )}

      {quality && overview && (
        <section className="p-8 rounded-3xl bg-blue-600/5 border border-blue-500/15 space-y-6">
          <div className="flex items-center gap-2">
            <PieChart className="text-blue-400" size={22} />
            <h2 className="text-lg font-semibold tracking-tight">Performance metrics</h2>
          </div>
          <p className="text-xs text-gray-500 leading-relaxed">
            Based on per-symbol rows in your file. Cost efficiency uses the broker summary
            &quot;Charges&quot; total (includes brokerage, STT, GST, stamp duty, and similar lines)
            divided by <span className="text-gray-400">gross profit</span> (sum of winning rows).
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-5 rounded-2xl bg-[#0a0a0b] border border-white/5">
              <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-2">
                <PieChart className="text-emerald-400/90" size={14} />
                Profitability
              </div>
              <div className="text-2xl font-bold tabular-nums text-emerald-300">
                {formatPct(quality.profitabilityPct)}
              </div>
              <p className="text-[11px] text-gray-600 mt-1">
                {quality.profitableTradeCount} profitable / {quality.totalTradeCount} symbols — share
                of rows with realized gain
              </p>
            </div>
            <div className="p-5 rounded-2xl bg-[#0a0a0b] border border-white/5">
              <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-2">
                <Shield className="text-amber-400/90" size={14} />
                Risk control
              </div>
              <div
                className={`text-2xl font-bold tabular-nums ${
                  quality.riskControlLargeLossPct === null
                    ? 'text-gray-400'
                    : quality.riskControlLargeLossPct <= 25
                      ? 'text-emerald-300'
                      : quality.riskControlLargeLossPct <= 50
                        ? 'text-amber-200'
                        : 'text-red-300'
                }`}
              >
                {formatPct(quality.riskControlLargeLossPct)}
              </div>
              <p className="text-[11px] text-gray-600 mt-1">
                Loss &gt; {formatInr(LARGE_LOSS_THRESHOLD_INR)} (≈1% of ₹1L) on{' '}
                {quality.losingTradesWithLargeLoss} of {quality.losingTradeCount} losing rows —{' '}
                <span className="text-gray-500">lower is better</span>
              </p>
            </div>
            <div className="p-5 rounded-2xl bg-[#0a0a0b] border border-white/5">
              <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-2">
                <Scale className="text-violet-400/90" size={14} />
                Cost efficiency
              </div>
              <div
                className={`text-2xl font-bold tabular-nums ${
                  quality.costEfficiencyPct === null
                    ? 'text-gray-400'
                    : quality.costEfficiencyPct <= 15
                      ? 'text-emerald-300'
                      : quality.costEfficiencyPct <= 35
                        ? 'text-amber-200'
                        : 'text-red-300'
                }`}
              >
                {formatPct(quality.costEfficiencyPct)}
              </div>
              <p className="text-[11px] text-gray-600 mt-1">
                Total charges {formatInr(overview.totalCharges)} ÷ gross profit{' '}
                {formatInr(overview.totalProfitBeforeFees)} × 100 —{' '}
                <span className="text-gray-500">lower is better</span>
                {quality.costEfficiencyPct === null ? (
                  <span className="block mt-0.5 text-amber-500/80">N/A when gross profit is zero</span>
                ) : null}
              </p>
            </div>
            <div className="p-5 rounded-2xl bg-[#0a0a0b] border border-white/5">
              <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-2">
                <GitBranch className="text-sky-400/90" size={14} />
                Consistency
              </div>
              <div className="text-2xl font-bold tabular-nums text-sky-300">
                {quality.consistencyPerfect
                  ? '∞'
                  : formatPct(quality.consistencyWinVsLossPct)}
              </div>
              <p className="text-[11px] text-gray-600 mt-1">
                Profitable ({quality.profitableTradeCount}) ÷ losing ({quality.losingTradeCount}) ×
                100 — <span className="text-gray-500">higher is better</span>
                {quality.consistencyPerfect ? (
                  <span className="block mt-0.5 text-emerald-500/80">No losing rows in this file</span>
                ) : null}
                {quality.losingTradeCount === 0 && quality.profitableTradeCount === 0 ? (
                  <span className="block mt-0.5 text-gray-500">No wins or losses to compare</span>
                ) : null}
              </p>
            </div>
          </div>
        </section>
      )}

      <section className="p-8 rounded-3xl bg-[#14181f] border border-white/10 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Upload className="text-emerald-400" size={24} />
            <div>
              <h2 className="text-lg font-semibold">P&amp;L spreadsheet</h2>
              <p className="text-sm text-gray-500">.xlsx — parse, validate, save to IndexedDB</p>
            </div>
          </div>
          <div>
            <input
              ref={inputRef}
              type="file"
              accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              className="hidden"
              onChange={onFile}
              disabled={busy}
            />
            <button
              type="button"
              disabled={busy}
              onClick={() => inputRef.current?.click()}
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-sm font-medium"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Upload className="h-4 w-4" aria-hidden />}
              {busy ? 'Processing…' : 'Upload .xlsx'}
            </button>
          </div>
        </div>

        {error && (
          <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 flex items-start gap-3">
            <ShieldAlert className="text-red-400 shrink-0" size={20} />
            <div className="text-sm text-red-400 font-medium">{error}</div>
          </div>
        )}

        {justSaved && !error && (
          <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-start gap-3">
            <CheckCircle2 className="text-emerald-400 shrink-0" size={20} />
            <div className="text-sm text-emerald-400 font-medium">
              Saved {record?.trade_details.length ?? 0} trade row(s) — store and IndexedDB updated.
            </div>
          </div>
        )}
      </section>

      {record && sum && (
        <section className="p-8 rounded-3xl bg-[#0b1119] border border-cyan-500/15 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-bold text-cyan-100/80 uppercase tracking-widest">
              Broker summary (stored)
            </h3>
            <span className="rounded-md border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] uppercase tracking-wider text-gray-300">
              Read only
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            <div className="flex justify-between gap-4 p-3 rounded-xl bg-[#0f1621] border border-white/10">
              <span className="text-gray-500">Charges</span>
              <span className="font-mono tabular-nums">{sum.Charges ?? '—'}</span>
            </div>
            <div className="flex justify-between gap-4 p-3 rounded-xl bg-[#0f1621] border border-white/10">
              <span className="text-gray-500">Other Credit &amp; Debit</span>
              <span className="font-mono tabular-nums">{sum['Other Credit & Debit'] ?? '—'}</span>
            </div>
            <div className="flex justify-between gap-4 p-3 rounded-xl bg-[#0f1621] border border-white/10">
              <span className="text-gray-500">Realized P&amp;L</span>
              <span className="font-mono tabular-nums">{sum['Realized P&L'] ?? '—'}</span>
            </div>
            <div className="flex justify-between gap-4 p-3 rounded-xl bg-[#0f1621] border border-white/10">
              <span className="text-gray-500">Unrealized P&amp;L</span>
              <span className="font-mono tabular-nums">{sum['Unrealized P&L'] ?? '—'}</span>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
