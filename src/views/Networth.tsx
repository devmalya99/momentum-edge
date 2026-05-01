import React, { useState, useRef, useMemo, useEffect } from 'react';
import { useTradeStore } from '../store/useTradeStore';
import { PieChart, Plus, Trash2, Upload, ShieldAlert, Loader2 } from 'lucide-react';
import * as xlsx from 'xlsx';
import { markPriceForTrade, useActiveTradeLivePrices } from '@/hooks/useActiveTradeLivePrices';
import { formatInr } from '@/lib/format-inr';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Trade } from '@/db';

type NeonHoldingRow = {
  symbol: string;
  quantity: number;
  average_price: number;
  previous_close_price: number;
  trade_type?: string | null;
};

type HoldingsQueryData =
  | { kind: 'unauthorized' }
  | { kind: 'ok'; holdings: NeonHoldingRow[] };

type NetworthMasterPayload = {
  totalInvested: number;
  currentHoldingValue: number;
  unrealisedPnl: number;
  unrealisedPnlPct: number;
  marginAmount: number;
  realInvestFromBank: number;
  ppfAmount: number;
  liquidFundInvestment: number;
  totalCreditCardDue: number;
  bankBalance?: number;
  receivables?: number;
  zerodhaCashHolding?: number;
};

type NetworthAssetRow = {
  id: number;
  name: string;
  value: number;
};

type ManualAssetDraft = {
  localId: string;
  id?: number;
  name: string;
  value: string;
};

export default function Networth() {
  const { settings, updateSettings } = useTradeStore();
  const queryClient = useQueryClient();

  const holdingsQuery = useQuery({
    queryKey: ['networth-holdings'],
    queryFn: async (): Promise<HoldingsQueryData> => {
      const res = await fetch('/api/holdings', { cache: 'no-store' });
      if (res.status === 401) return { kind: 'unauthorized' };
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? 'Failed to load holdings');
      }
      const body = (await res.json()) as { holdings?: NeonHoldingRow[] };
      const holdings = Array.isArray(body.holdings) ? body.holdings : [];
      return { kind: 'ok', holdings };
    },
    retry: 1,
  });

  const holdingsResult = holdingsQuery.data;
  const holdingsRows = holdingsResult?.kind === 'ok' ? holdingsResult.holdings : [];
  const showHoldingsEmptyState =
    holdingsQuery.isFetched &&
    (holdingsResult?.kind === 'unauthorized' ||
      (holdingsResult?.kind === 'ok' && holdingsRows.length === 0));

  const syntheticHoldingsTrades = useMemo((): Trade[] => {
    if (holdingsResult?.kind !== 'ok') return [];
    const defaultType = settings.tradeTypes?.[0]?.name || 'Buy & Forget';
    return holdingsResult.holdings.map((row, idx) => {
      const entry = Number(row.average_price) || 0;
      const close = Number(row.previous_close_price) || entry;
      const fromDb =
        typeof row.trade_type === 'string' && row.trade_type.trim() ? row.trade_type.trim() : null;
      return {
        id: `neon-holding-${String(row.symbol).trim().toUpperCase()}-${idx}`,
        symbol: String(row.symbol).trim().toUpperCase(),
        type: fromDb ?? defaultType,
        entryPrice: entry,
        currentPrice: close > 0 ? close : entry,
        stopLoss: entry > 0 ? entry * 0.9 : 0,
        positionSize: Number(row.quantity) || 0,
        status: 'Active' as const,
        entryDate: Date.now() + idx,
        ruleScores: {},
        totalScore: 0,
        maxPossibleScore: 0,
        scorePercentage: 0,
        verdict: 'B' as const,
        checklist: {},
        notes: '',
        mistakes: [],
      };
    });
  }, [holdingsResult, settings.tradeTypes]);

  const networthMasterQuery = useQuery({
    queryKey: ['networth-master'],
    queryFn: async () => {
      const res = await fetch('/api/networth/master', { cache: 'no-store' });
      if (!res.ok) throw new Error('Failed to load networth master');
      const body = (await res.json()) as { master: NetworthMasterPayload };
      return body.master;
    },
    retry: 1,
  });

  const master = networthMasterQuery.data;
  const { livePriceBySymbol, quotesFetching, quoteErrors, activeSymbols } =
    useActiveTradeLivePrices(syntheticHoldingsTrades);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importStep, setImportStep] = useState<'uploading' | 'saving' | null>(null);
  const [duePayablesInput, setDuePayablesInput] = useState('');
  const [ppfInput, setPpfInput] = useState('');
  const [liquidFundInput, setLiquidFundInput] = useState('');
  const [receivablesInput, setReceivablesInput] = useState('');
  const [zerodhaCashHoldingInput, setZerodhaCashHoldingInput] = useState('');
  const [bankBalanceInput, setBankBalanceInput] = useState('');

  useEffect(() => {
    if (!master) return;
    setDuePayablesInput(
      master.totalCreditCardDue > 0 ? String(master.totalCreditCardDue) : '',
    );
    setPpfInput(master.ppfAmount > 0 ? String(master.ppfAmount) : '');
    setLiquidFundInput(
      master.liquidFundInvestment > 0 ? String(master.liquidFundInvestment) : '',
    );
    setReceivablesInput(
      Number(master.receivables) > 0 ? String(Number(master.receivables)) : '',
    );
    setZerodhaCashHoldingInput(
      Number(master.zerodhaCashHolding) > 0 ? String(Number(master.zerodhaCashHolding)) : '',
    );
    setBankBalanceInput(Number(master.bankBalance) > 0 ? String(Number(master.bankBalance)) : '');
  }, [
    master?.totalCreditCardDue,
    master?.ppfAmount,
    master?.liquidFundInvestment,
    master?.receivables,
    master?.zerodhaCashHolding,
    master?.bankBalance,
  ]);

  const financialFieldMutation = useMutation({
    mutationFn: async (payload: {
      field:
        | 'duePayables'
        | 'receivables'
        | 'ppf'
        | 'liquidFund'
        | 'zerodhaCashHolding'
        | 'bankBalance';
      value: number;
    }) => {
      const res = await fetch('/api/networth/master/financials', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const body = (await res.json().catch(() => null)) as
        | { ok?: boolean; error?: string; master?: NetworthMasterPayload }
        | null;
      if (!res.ok || !body?.ok || !body.master) {
        throw new Error(body?.error ?? 'Failed to save field');
      }
      return body.master;
    },
    onSuccess: (nextMaster) => {
      queryClient.setQueryData(['networth-master'], nextMaster);
    },
  });
  const networthAssetsQuery = useQuery({
    queryKey: ['networth-assets'],
    queryFn: async (): Promise<NetworthAssetRow[]> => {
      const res = await fetch('/api/networth/assets', { cache: 'no-store' });
      if (!res.ok) throw new Error('Failed to load manual assets');
      const body = (await res.json()) as { assets?: NetworthAssetRow[] };
      return Array.isArray(body.assets) ? body.assets : [];
    },
    retry: 1,
  });
  const networthAssets = networthAssetsQuery.data;

  const [assetDrafts, setAssetDrafts] = useState<ManualAssetDraft[]>([]);
  useEffect(() => {
    if (!networthAssets) {
      setAssetDrafts((prev) =>
        prev.length > 0 ? prev : [{ localId: crypto.randomUUID(), name: '', value: '' }],
      );
      return;
    }
    const mapped = networthAssets.map((asset) => ({
      localId: `saved-${asset.id}`,
      id: asset.id,
      name: asset.name,
      value: String(asset.value ?? 0),
    }));
    setAssetDrafts(mapped.length > 0 ? mapped : [{ localId: crypto.randomUUID(), name: '', value: '' }]);
  }, [networthAssets]);

  const assetMutation = useMutation({
    mutationFn: async (draft: ManualAssetDraft) => {
      const raw = Number(draft.value);
      const value = Number.isFinite(raw) ? raw : 0;
      if (draft.id) {
        const res = await fetch('/api/networth/assets', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: draft.id, name: draft.name.trim(), value }),
        });
        const body = (await res.json().catch(() => null)) as
          | { ok?: boolean; error?: string; asset?: NetworthAssetRow }
          | null;
        if (!res.ok || !body?.ok || !body.asset) {
          throw new Error(body?.error ?? 'Failed to update asset');
        }
        return body.asset;
      }
      const res = await fetch('/api/networth/assets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: draft.name.trim(), value }),
      });
      const body = (await res.json().catch(() => null)) as
        | { ok?: boolean; error?: string; asset?: NetworthAssetRow }
        | null;
      if (!res.ok || !body?.ok || !body.asset) {
        throw new Error(body?.error ?? 'Failed to create asset');
      }
      return body.asset;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['networth-assets'] });
    },
  });

  const deleteAssetMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch('/api/networth/assets', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      const body = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
      if (!res.ok || !body?.ok) throw new Error(body?.error ?? 'Failed to delete asset');
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['networth-assets'] });
    },
  });

  const addAssetDraftRow = () => {
    setAssetDrafts((prev) => [...prev, { localId: crypto.randomUUID(), name: '', value: '' }]);
  };


  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    const file = e.target.files?.[0];
    if (!file) return;
    void (async () => {
      setIsImporting(true);
      setImportStep('uploading');
      try {
        const buf = await file.arrayBuffer();
        const wb = xlsx.read(buf, { type: 'array' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = xlsx.utils.sheet_to_json<any[]>(ws, { header: 1 });
        
        const headerIdx = data.findIndex(row => row.some(cell => typeof cell === 'string' && (cell.includes('Symbol') || cell.includes('ISIN'))));
        
        if (headerIdx === -1) throw new Error('Could not parse XLSX. Missing headers (Symbol, etc). Make sure this is a Zerodha Holdings Excel file.');
        
        const headers = data[headerIdx] as string[];
      
        
        const symIdx = headers.findIndex(h => h && h.toString().trim() === 'Symbol');
        const qtyIdx = headers.findIndex(h => h && h.toString().includes('Quantity Available'));
        const avgPriceIdx = headers.findIndex(h => h && h.toString().includes('Average Price'));
        const closePriceIdx = headers.findIndex(h => h && h.toString().includes('Previous Closing Pr'));

        if (symIdx === -1 || qtyIdx === -1 || closePriceIdx === -1 || avgPriceIdx === -1) {
             throw new Error('Missing columns. Cannot find Symbol, Quantity, Average Price, or Closing Price headers.');
        }

        const parsedHoldings: {
          symbol: string;
          quantity: number;
          averagePrice: number;
          previousClosePrice: number;
        }[] = [];

        for (let i = headerIdx + 1; i < data.length; i++) {
            const row = data[i];
            if (!row || row.length === 0) continue;

            const symbol = row[symIdx];
            if (!symbol || symbol === 'Total' || symbol === 'Summary') continue;

            const qty = parseFloat(row[qtyIdx] || 0);
            const entryPrice = parseFloat(row[avgPriceIdx] || 0);
            const currentPrice = parseFloat(row[closePriceIdx] || 0);

            if (qty > 0 && entryPrice > 0) {
                 parsedHoldings.push({
                   symbol: String(symbol).trim().toUpperCase(),
                   quantity: qty,
                   averagePrice: entryPrice,
                   previousClosePrice: currentPrice > 0 ? currentPrice : entryPrice,
                 });
            }
        }


        const res = await fetch('/api/holdings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ holdings: parsedHoldings }),
        });
        const holdingsBody = (await res.json().catch(() => null)) as
          | { error?: string; master?: NetworthMasterPayload }
          | null;
        if (!res.ok) {
          throw new Error(holdingsBody?.error ?? 'Failed to save holdings to server.');
        }
        if (holdingsBody?.master) {
          queryClient.setQueryData(['networth-master'], holdingsBody.master);
        } else {
          await queryClient.invalidateQueries({ queryKey: ['networth-master'] });
        }

        setImportStep('saving');
        await queryClient.invalidateQueries({ queryKey: ['networth-holdings'] });
        await queryClient.invalidateQueries({ queryKey: ['networth-master'] });
        alert(`Holdings saved to server. Uploaded ${parsedHoldings.length} rows.`);
        
        if (fileInputRef.current) fileInputRef.current.value = '';
      } catch (err: any) {
        setError(err.message || 'Error parsing file.');
      } finally {
        setIsImporting(false);
        setImportStep(null);
      }
    })();
  };

  const activeTrades = syntheticHoldingsTrades;
  const hasNeonHoldingsEquity = holdingsRows.length > 0;

  /** Sum manual / imported assets. If you have logged active trades, the template "Stocks" row is skipped so equity is not double-counted. */
  const manualAssetsValue = useMemo(() => {
    const assets = networthAssets ?? [];
    return assets.reduce((sum, asset) => {
      const name = (asset.name || '').trim().toLowerCase();
      if (hasNeonHoldingsEquity && name === 'stocks') return sum;
      // PPF/Liquid Fund now come from dedicated server-synced inputs below.
      if (name === 'ppf' || name === 'liquid fund' || name === 'liquid_fund') return sum;
      if (name === 'receivables' || name === 'receivable') return sum;
      return sum + (Number(asset.value) || 0);
    }, 0);
  }, [networthAssets, hasNeonHoldingsEquity]);

  const stocksPresent = activeTrades.reduce(
    (sum, t) => sum + t.positionSize * markPriceForTrade(t, livePriceBySymbol),
    0,
  );
  const brokerMarginUsed =
    typeof settings?.brokerMarginUsed === 'number' && Number.isFinite(settings.brokerMarginUsed)
      ? settings.brokerMarginUsed
      : 0;

  const currentHoldingValueMaster = Number(master?.currentHoldingValue ?? 0);
  const totalInvestedGross = Number(master?.totalInvested ?? 0);

  const duePayablesSaved = Number(master?.totalCreditCardDue ?? 0);
  const bankBalanceSaved = Number(master?.bankBalance ?? 0);
  const ppfSaved = Number(master?.ppfAmount ?? 0);
  const liquidFundSaved = Number(master?.liquidFundInvestment ?? 0);
  const receivablesSaved = Number(master?.receivables ?? 0);
  const zerodhaCashHoldingSaved = Number(master?.zerodhaCashHolding ?? 0);
  const realInvestFromBankSaved = Number(master?.realInvestFromBank ?? 0);
  const marginAmountSaved = Number(master?.marginAmount ?? 0);
  const actualInvestmentFromBank = realInvestFromBankSaved;
  const currentHoldingValueWithoutMargin =
    currentHoldingValueMaster + zerodhaCashHoldingSaved - marginAmountSaved;
  const netPnlWithoutMargin = currentHoldingValueWithoutMargin - actualInvestmentFromBank;
  const netPnlPctWithoutMargin =
    actualInvestmentFromBank > 0 ? (netPnlWithoutMargin / actualInvestmentFromBank) * 100 : 0;
  const grossTotalValue = manualAssetsValue + stocksPresent;
  const coreAssetsServer =
    bankBalanceSaved + ppfSaved + liquidFundSaved + receivablesSaved + zerodhaCashHoldingSaved;
  const totalLiabilities = brokerMarginUsed + duePayablesSaved;
  const totalValue = grossTotalValue + coreAssetsServer - totalLiabilities;
  const duePayablesDirty =
    duePayablesInput.trim() !== (duePayablesSaved > 0 ? String(duePayablesSaved) : '');
  const ppfDirty = ppfInput.trim() !== (ppfSaved > 0 ? String(ppfSaved) : '');
  const liquidFundDirty =
    liquidFundInput.trim() !== (liquidFundSaved > 0 ? String(liquidFundSaved) : '');
  const receivablesDirty =
    receivablesInput.trim() !== (receivablesSaved > 0 ? String(receivablesSaved) : '');
  const zerodhaCashHoldingDirty =
    zerodhaCashHoldingInput.trim() !==
    (zerodhaCashHoldingSaved > 0 ? String(zerodhaCashHoldingSaved) : '');
  const bankBalanceDirty =
    bankBalanceInput.trim() !== (bankBalanceSaved > 0 ? String(bankBalanceSaved) : '');
  const hasStocksManualRow =
    (networthAssets ?? []).some((a) => (a.name || '').trim().toLowerCase() === 'stocks');

  return (
    <div className="max-w-[1300px] mx-auto space-y-6 pb-24">
      <input type="file" ref={fileInputRef} accept=".xlsx, .xls, .csv" className="hidden" onChange={handleFileUpload} />

      <div className="rounded-3xl border border-cyan-500/20 bg-linear-to-br from-[#0f131d] via-[#0b0e15] to-[#07090d] px-6 py-5 md:px-8 md:py-6 shadow-2xl shadow-black/50">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl md:text-3xl font-black uppercase tracking-wider text-white">
              Financial Command Center
            </h1>
            <p className="text-xs font-semibold uppercase tracking-widest text-gray-500 mt-1">
              Real-time portfolio consolidation and asset allocation
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isImporting}
              className="inline-flex items-center gap-2 rounded-xl border border-emerald-400/25 bg-emerald-500/10 px-4 py-2 text-xs font-bold uppercase tracking-widest text-emerald-300 hover:bg-emerald-500/20 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isImporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload size={14} />}
              {isImporting ? 'Importing...' : 'Update Holdings'}
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <div className="rounded-2xl border border-cyan-500/20 bg-[#0b1018] p-4">
          <div className="text-[10px] uppercase tracking-widest text-gray-500">Total Assets</div>
          <div className="text-xl font-black text-cyan-300">{formatInr(grossTotalValue + coreAssetsServer)}</div>
        </div>
        <div className="rounded-2xl border border-rose-500/20 bg-[#130f14] p-4">
          <div className="text-[10px] uppercase tracking-widest text-gray-500">Risk Exposure</div>
          <div className="text-xl font-black text-rose-300">{formatInr(totalLiabilities)}</div>
        </div>
        <div className="rounded-2xl border border-emerald-500/20 bg-[#0f1712] p-4">
          <div className="text-[10px] uppercase tracking-widest text-gray-500">Core Base</div>
          <div className="text-xl font-black text-emerald-300">{formatInr(coreAssetsServer)}</div>
        </div>
        <div className="rounded-2xl border border-white/20 bg-[#0d0f14] p-4">
          <div className="text-[10px] uppercase tracking-widest text-gray-500">Net Wealth</div>
          <div className="text-xl font-black text-white">{formatInr(totalValue)}</div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
        <section className="xl:col-span-4 rounded-3xl border border-cyan-500/20 bg-[#0b1018]/90 p-5 space-y-4 shadow-xl shadow-cyan-950/20">
          <h2 className="text-sm font-black uppercase tracking-widest text-cyan-300">Portfolio Overview</h2>
          <div className="rounded-2xl border border-cyan-400/20 bg-[#0b1621] p-4">
            <div className="text-[10px] font-bold uppercase tracking-widest text-cyan-400/80">
              Current Zerodha Holding
            </div>
            <div className="mt-1 text-4xl font-black tracking-tight text-cyan-300">
              {formatInr(currentHoldingValueWithoutMargin)}
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <div>
                <div className="text-[10px] uppercase tracking-widest text-gray-500">Actual Investment</div>
                <div className="font-bold text-white">{formatInr(actualInvestmentFromBank)}</div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-widest text-gray-500">Total Invested</div>
                <div className="font-bold text-white">{formatInr(totalInvestedGross)}</div>
              </div>
            </div>
            <div className="mt-4 rounded-xl border border-emerald-400/20 bg-emerald-500/10 p-3">
              <div className="text-[10px] uppercase tracking-widest text-emerald-300/80">Net PnL</div>
              <div className={`text-2xl font-black ${netPnlWithoutMargin >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>
                {formatInr(netPnlWithoutMargin)}
              </div>
              <div className={`text-sm font-bold ${netPnlPctWithoutMargin >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>
                {actualInvestmentFromBank > 0 ? `${netPnlPctWithoutMargin.toFixed(2)}%` : '—'}
              </div>
            </div>
          </div>
          {activeSymbols.length > 0 && quotesFetching ? (
            <div className="flex items-center gap-2 text-xs text-blue-400">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Updating NSE marks...
            </div>
          ) : null}
          {activeSymbols.length > 0 && quoteErrors > 0 ? (
            <div className="text-[11px] text-amber-400">
              {quoteErrors} quote{quoteErrors === 1 ? '' : 's'} failed; using last saved price.
            </div>
          ) : null}
        </section>

        <section className="xl:col-span-4 rounded-3xl border border-rose-500/20 bg-[#130f14]/90 p-5 space-y-4 shadow-xl shadow-rose-950/20">
          <h2 className="text-sm font-black uppercase tracking-widest text-rose-300">Margin & Liabilities</h2>
          <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
            <label className="text-[10px] font-black uppercase tracking-widest text-gray-500">Broker Margin Used</label>
            <div className="mt-2 flex items-center gap-2">
              <span className="text-2xl font-bold text-gray-400">₹</span>
              <input
                type="number"
                min={0}
                value={brokerMarginUsed}
                onChange={async (e) => {
                  const next = Number(e.target.value);
                  await updateSettings({
                    brokerMarginUsed: Number.isFinite(next) && next > 0 ? next : 0,
                  });
                  await queryClient.invalidateQueries({ queryKey: ['networth-master'] });
                }}
                className="w-full bg-transparent outline-none text-4xl font-black text-rose-100"
                placeholder="0"
              />
            </div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-black/30 p-4 space-y-2 text-sm">
            <div className="text-[10px] font-black uppercase tracking-widest text-rose-200/80">Actual Networth Formula</div>
            <div className="flex items-center justify-between text-gray-300"><span>Gross Assets</span><span>{formatInr(grossTotalValue)}</span></div>
            <div className="flex items-center justify-between text-gray-300"><span>Core Base</span><span>{formatInr(coreAssetsServer)}</span></div>
            <div className="flex items-center justify-between text-gray-300"><span>Total Liabilities</span><span>- {formatInr(totalLiabilities)}</span></div>
            <div className="mt-2 border-t border-white/10 pt-2 flex items-center justify-between font-black text-lg text-white">
              <span>Net Wealth</span><span>{formatInr(totalValue)}</span>
            </div>
          </div>
        </section>

        <section className="xl:col-span-4 rounded-3xl border border-lime-500/20 bg-[#10160f]/90 p-5 space-y-4 shadow-xl shadow-lime-950/20">
          <h2 className="text-sm font-black uppercase tracking-widest text-lime-300">Core Base Management</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="p-4 rounded-2xl bg-[#0a0a0b] border border-white/5 space-y-3">
            <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest">
              due_payables
            </label>
            <p className="text-[10px] text-gray-600">Amount you owe others (liability).</p>
            <div className="flex items-center gap-2">
              <span className="text-gray-500">₹</span>
              <input
                type="number"
                min={0}
                step="0.01"
                value={duePayablesInput}
                onChange={(e) => setDuePayablesInput(e.target.value)}
                className="w-full bg-transparent outline-none font-bold text-lg"
                placeholder="0"
              />
            </div>
            <button
              type="button"
              disabled={!duePayablesDirty || financialFieldMutation.isPending}
              onClick={() => {
                const n = parseFloat(duePayablesInput);
                const v = Number.isFinite(n) && n >= 0 ? n : 0;
                void financialFieldMutation.mutateAsync({ field: 'duePayables', value: v });
              }}
              className="w-full inline-flex items-center justify-center gap-2 text-xs font-bold bg-blue-500/15 text-blue-300 hover:bg-blue-500/25 disabled:opacity-50 disabled:cursor-not-allowed px-3 py-2 rounded-xl transition-all uppercase tracking-widest"
            >
              {financialFieldMutation.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : null}
              Save
            </button>
          </div>

          <div className="p-4 rounded-2xl bg-[#0a0a0b] border border-white/5 space-y-3">
            <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest">
              Receivables
            </label>
            <p className="text-[10px] text-gray-600">Money others owe you (asset).</p>
            <div className="flex items-center gap-2">
              <span className="text-gray-500">₹</span>
              <input
                type="number"
                min={0}
                step="0.01"
                value={receivablesInput}
                onChange={(e) => setReceivablesInput(e.target.value)}
                className="w-full bg-transparent outline-none font-bold text-lg"
                placeholder="0"
              />
            </div>
            <button
              type="button"
              disabled={!receivablesDirty || financialFieldMutation.isPending}
              onClick={() => {
                const n = parseFloat(receivablesInput);
                const v = Number.isFinite(n) && n >= 0 ? n : 0;
                void financialFieldMutation.mutateAsync({ field: 'receivables', value: v });
              }}
              className="w-full inline-flex items-center justify-center gap-2 text-xs font-bold bg-blue-500/15 text-blue-300 hover:bg-blue-500/25 disabled:opacity-50 disabled:cursor-not-allowed px-3 py-2 rounded-xl transition-all uppercase tracking-widest"
            >
              {financialFieldMutation.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : null}
              Save
            </button>
          </div>

          <div className="p-4 rounded-2xl bg-[#0a0a0b] border border-white/5 space-y-3">
            <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest">
              ppf
            </label>
            <div className="flex items-center gap-2">
              <span className="text-gray-500">₹</span>
              <input
                type="number"
                min={0}
                step="0.01"
                value={ppfInput}
                onChange={(e) => setPpfInput(e.target.value)}
                className="w-full bg-transparent outline-none font-bold text-lg"
                placeholder="0"
              />
            </div>
            <button
              type="button"
              disabled={!ppfDirty || financialFieldMutation.isPending}
              onClick={() => {
                const n = parseFloat(ppfInput);
                const v = Number.isFinite(n) && n >= 0 ? n : 0;
                void financialFieldMutation.mutateAsync({ field: 'ppf', value: v });
              }}
              className="w-full inline-flex items-center justify-center gap-2 text-xs font-bold bg-blue-500/15 text-blue-300 hover:bg-blue-500/25 disabled:opacity-50 disabled:cursor-not-allowed px-3 py-2 rounded-xl transition-all uppercase tracking-widest"
            >
              {financialFieldMutation.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : null}
              Save
            </button>
          </div>

          <div className="p-4 rounded-2xl bg-[#0a0a0b] border border-white/5 space-y-3">
            <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest">
              liquid_fund
            </label>
            <div className="flex items-center gap-2">
              <span className="text-gray-500">₹</span>
              <input
                type="number"
                min={0}
                step="0.01"
                value={liquidFundInput}
                onChange={(e) => setLiquidFundInput(e.target.value)}
                className="w-full bg-transparent outline-none font-bold text-lg"
                placeholder="0"
              />
            </div>
            <button
              type="button"
              disabled={!liquidFundDirty || financialFieldMutation.isPending}
              onClick={() => {
                const n = parseFloat(liquidFundInput);
                const v = Number.isFinite(n) && n >= 0 ? n : 0;
                void financialFieldMutation.mutateAsync({ field: 'liquidFund', value: v });
              }}
              className="w-full inline-flex items-center justify-center gap-2 text-xs font-bold bg-blue-500/15 text-blue-300 hover:bg-blue-500/25 disabled:opacity-50 disabled:cursor-not-allowed px-3 py-2 rounded-xl transition-all uppercase tracking-widest"
            >
              {financialFieldMutation.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : null}
              Save
            </button>
          </div>

          <div className="p-4 rounded-2xl bg-[#0a0a0b] border border-white/5 space-y-3">
            <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest">
              zerodha_cash_holding
            </label>
            <p className="text-[10px] text-gray-600">Remaining cash available in Zerodha account.</p>
            <div className="flex items-center gap-2">
              <span className="text-gray-500">₹</span>
              <input
                type="number"
                min={0}
                step="0.01"
                value={zerodhaCashHoldingInput}
                onChange={(e) => setZerodhaCashHoldingInput(e.target.value)}
                className="w-full bg-transparent outline-none font-bold text-lg"
                placeholder="0"
              />
            </div>
            <button
              type="button"
              disabled={!zerodhaCashHoldingDirty || financialFieldMutation.isPending}
              onClick={() => {
                const n = parseFloat(zerodhaCashHoldingInput);
                const v = Number.isFinite(n) && n >= 0 ? n : 0;
                void financialFieldMutation.mutateAsync({ field: 'zerodhaCashHolding', value: v });
              }}
              className="w-full inline-flex items-center justify-center gap-2 text-xs font-bold bg-blue-500/15 text-blue-300 hover:bg-blue-500/25 disabled:opacity-50 disabled:cursor-not-allowed px-3 py-2 rounded-xl transition-all uppercase tracking-widest"
            >
              {financialFieldMutation.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : null}
              Save
            </button>
          </div>
          <div className="p-4 rounded-2xl bg-[#0a0a0b] border border-white/5 space-y-3">
            <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest">
              total_bank_balance
            </label>
            <p className="text-[10px] text-gray-600">Current total bank cash balance from master.</p>
            <div className="flex items-center gap-2">
              <span className="text-gray-500">₹</span>
              <input
                type="number"
                min={0}
                step="0.01"
                value={bankBalanceInput}
                onChange={(e) => setBankBalanceInput(e.target.value)}
                className="w-full bg-transparent outline-none font-bold text-lg"
                placeholder="0"
              />
            </div>
            <button
              type="button"
              disabled={!bankBalanceDirty || financialFieldMutation.isPending}
              onClick={() => {
                const n = parseFloat(bankBalanceInput);
                const v = Number.isFinite(n) && n >= 0 ? n : 0;
                void financialFieldMutation.mutateAsync({ field: 'bankBalance', value: v });
              }}
              className="w-full inline-flex items-center justify-center gap-2 text-xs font-bold bg-blue-500/15 text-blue-300 hover:bg-blue-500/25 disabled:opacity-50 disabled:cursor-not-allowed px-3 py-2 rounded-xl transition-all uppercase tracking-widest"
            >
              {financialFieldMutation.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : null}
              Save
            </button>
          </div>
          </div>
        </section>
      </div>

      {financialFieldMutation.isError ||
      assetMutation.isError ||
      deleteAssetMutation.isError ? (
        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">
          {financialFieldMutation.error instanceof Error
            ? financialFieldMutation.error.message
            : assetMutation.error instanceof Error
                ? assetMutation.error.message
                : deleteAssetMutation.error instanceof Error
                  ? deleteAssetMutation.error.message
              : 'Failed to save'}
        </div>
      ) : null}

      {holdingsQuery.isError ? (
        <div className="rounded-2xl border border-rose-500/25 bg-[#1a0f12] p-4 text-sm text-rose-300">
          <ShieldAlert className="inline-block mr-2 h-4 w-4" /> Could not load holdings from server.
        </div>
      ) : holdingsQuery.isPending ? (
        <div className="rounded-2xl border border-white/10 bg-[#11151e] p-4 text-sm text-gray-300 flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading secure holdings...
        </div>
      ) : showHoldingsEmptyState ? (
        <div className="rounded-2xl border border-blue-500/25 bg-blue-500/10 p-4 text-sm text-blue-200">
          No equity records found in DB yet. Import Zerodha holdings to populate master values.
        </div>
      ) : null}

      {error && (
        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300 flex items-start gap-2">
          <ShieldAlert className="h-4 w-4 mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <section className="rounded-3xl border border-white/10 bg-[#0c0f15] p-6 space-y-5 shadow-2xl shadow-black/50">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl border border-cyan-500/30 bg-cyan-500/10 flex items-center justify-center text-cyan-300">
              <PieChart size={18} />
            </div>
            <div>
              <h3 className="text-base font-black uppercase tracking-widest text-white">Manual Asset Matrix</h3>
              <p className="text-[11px] uppercase tracking-wider text-gray-500">
                Secondary assets and offline allocations
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="text-sm font-bold text-gray-300">{formatInr(manualAssetsValue)}</div>
            <button
              type="button"
              onClick={addAssetDraftRow}
              className="inline-flex items-center gap-1 rounded-lg border border-white/15 bg-white/5 px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-widest text-white hover:bg-white/10"
            >
              <Plus size={12} /> Add Asset
            </button>
          </div>
        </div>

        {isImporting && (
          <div className="rounded-xl border border-blue-500/30 bg-blue-500/10 p-3 text-sm text-blue-200">
            <div className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>
                {importStep === 'uploading'
                  ? 'Parsing spreadsheet...'
                  : 'Saving holdings to Neon and refreshing...'}
              </span>
            </div>
          </div>
        )}

        <div className="space-y-3">
          {assetDrafts.map((asset) => {
            const rowBusy =
              assetMutation.isPending || (asset.id ? deleteAssetMutation.isPending : false);
            return (
              <div
                key={asset.localId}
                className="flex flex-col md:flex-row gap-4 md:items-center p-4 rounded-2xl border border-white/10 bg-black/30 hover:bg-black/40 transition-colors"
              >
                <div className="flex-2 flex items-center gap-3 pl-2">
                  <div className="w-1.5 h-4 rounded-full bg-gray-700"></div>
                  <input
                    type="text"
                    value={asset.name}
                    onChange={(e) =>
                      setAssetDrafts((prev) =>
                        prev.map((x) => (x.localId === asset.localId ? { ...x, name: e.target.value } : x)),
                      )
                    }
                    className="w-full bg-transparent outline-none font-bold text-white placeholder-gray-600"
                    placeholder="Asset Name (e.g. Real Estate, Bank)"
                  />
                </div>
                <div className="flex-1 flex items-center gap-2 bg-black/40 rounded-xl px-3 py-2 border border-white/10">
                  <span className="text-gray-500 font-black">₹</span>
                  <input
                    type="number"
                    value={asset.value}
                    onChange={(e) =>
                      setAssetDrafts((prev) =>
                        prev.map((x) => (x.localId === asset.localId ? { ...x, value: e.target.value } : x)),
                      )
                    }
                    className="w-full bg-transparent outline-none font-black text-white text-right"
                    placeholder="0"
                  />
                </div>
                <button
                  type="button"
                  disabled={!asset.name.trim() || rowBusy}
                  onClick={() => void assetMutation.mutateAsync(asset)}
                  className="px-3 py-2 rounded-xl text-xs font-bold uppercase tracking-widest bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Save
                </button>
                <button
                  onClick={() => {
                    if (asset.id) {
                      void deleteAssetMutation.mutateAsync(asset.id);
                      return;
                    }
                    setAssetDrafts((prev) => {
                      const next = prev.filter((x) => x.localId !== asset.localId);
                      return next.length > 0
                        ? next
                        : [{ localId: crypto.randomUUID(), name: '', value: '' }];
                    });
                  }}
                  className="p-3 bg-red-500/10 text-red-300 hover:text-red-200 hover:bg-red-500/20 rounded-xl transition-all shrink-0 self-end md:self-auto"
                  aria-label="Delete Asset"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            );
          })}
        </div>
      </section>

      {hasNeonHoldingsEquity && hasStocksManualRow ? (
        <p className="text-[11px] text-gray-500">
          Note: the &quot;Stocks&quot; manual row is excluded while live holdings exist to avoid double counting.
        </p>
      ) : null}
    </div>
  );
}
