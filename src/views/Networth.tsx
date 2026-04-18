import React, { useState, useRef, useMemo, useEffect } from 'react';
import { useTradeStore } from '../store/useTradeStore';
import { PieChart, Plus, Trash2, Upload, Activity, ShieldAlert, Loader2, Info } from 'lucide-react';
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
  receivables?: number;
};

function InfoHint({ text }: { text: string }) {
  return (
    <span className="relative inline-flex items-center group">
      <button
        type="button"
        aria-label="Info"
        className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-white/20 text-gray-400 hover:text-cyan-300 hover:border-cyan-300/50 transition-colors"
      >
        <Info className="h-3 w-3" aria-hidden />
      </button>
      <span className="pointer-events-none absolute left-1/2 top-full z-20 mt-2 w-64 -translate-x-1/2 rounded-lg border border-white/10 bg-[#111214] px-3 py-2 text-[11px] font-normal normal-case tracking-normal text-gray-300 opacity-0 shadow-xl transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
        {text}
      </span>
    </span>
  );
}

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
      return {
        id: `neon-holding-${String(row.symbol).trim().toUpperCase()}-${idx}`,
        symbol: String(row.symbol).trim().toUpperCase(),
        type: defaultType,
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
        checklist: {
          priorRally: false,
          tightBase: false,
          breakoutLevel: false,
          volumeConfirmation: false,
          emaAlignment: false,
          relativeStrength: false,
        },
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
  }, [
    master?.totalCreditCardDue,
    master?.ppfAmount,
    master?.liquidFundInvestment,
    master?.receivables,
  ]);

  const financialFieldMutation = useMutation({
    mutationFn: async (payload: {
      field: 'duePayables' | 'receivables' | 'ppf' | 'liquidFund';
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

  const addNetworthAsset = () => {
    const newAsset = { id: crypto.randomUUID(), name: 'New Asset', value: 0 };
    updateSettings({ networthAssets: [...(settings.networthAssets || []), newAsset] });
  };

  const updateNetworthAsset = (id: string, updates: any) => {
    updateSettings({
      networthAssets: settings.networthAssets?.map(a => a.id === id ? { ...a, ...updates } : a)
    });
  };

  const deleteNetworthAsset = (id: string) => {
    updateSettings({ networthAssets: settings.networthAssets?.filter(a => a.id !== id) });
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
        console.log('[Networth XLSX] workbook structure', {
          fileName: file.name,
          sheetNames: wb.SheetNames,
          activeSheet: wsname,
          totalRows: data.length,
          previewRows: data.slice(0, 12),
        });
        
        const headerIdx = data.findIndex(row => row.some(cell => typeof cell === 'string' && (cell.includes('Symbol') || cell.includes('ISIN'))));
        
        if (headerIdx === -1) throw new Error('Could not parse XLSX. Missing headers (Symbol, etc). Make sure this is a Zerodha Holdings Excel file.');
        
        const headers = data[headerIdx] as string[];
        console.log('[Networth XLSX] detected header row', {
          headerRowIndex: headerIdx,
          headers,
        });
        
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

        console.log('[Networth XLSX] parsed holdings (payload that replaces server holdings)', {
          parsedHoldings,
          parsedHoldingsCount: parsedHoldings.length,
        });

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
    const assets = settings?.networthAssets || [];
    return assets.reduce((sum, asset) => {
      const name = (asset.name || '').trim().toLowerCase();
      if (hasNeonHoldingsEquity && name === 'stocks') return sum;
      // PPF/Liquid Fund now come from dedicated server-synced inputs below.
      if (name === 'ppf' || name === 'liquid fund' || name === 'liquid_fund') return sum;
      if (name === 'receivables' || name === 'receivable') return sum;
      return sum + (Number(asset.value) || 0);
    }, 0);
  }, [settings?.networthAssets, hasNeonHoldingsEquity]);

  const stocksPresent = activeTrades.reduce(
    (sum, t) => sum + t.positionSize * markPriceForTrade(t, livePriceBySymbol),
    0,
  );
  const brokerMarginUsed =
    typeof settings?.brokerMarginUsed === 'number' && Number.isFinite(settings.brokerMarginUsed)
      ? settings.brokerMarginUsed
      : 0;

  const currentHoldingValueMaster = Number(master?.currentHoldingValue ?? 0);
  const unrealisedPnlMaster = Number(master?.unrealisedPnl ?? 0);
  const unrealisedPnlPctMaster = Number(master?.unrealisedPnlPct ?? 0);
  const totalInvestedGross = Number(master?.totalInvested ?? 0);
  const marginForBasis = Math.max(
    brokerMarginUsed,
    Number.isFinite(Number(master?.marginAmount)) ? Number(master?.marginAmount) : 0,
  );
  const ownCapitalInvested = Math.max(0, totalInvestedGross - marginForBasis);
  const pnlPctOnOwnCapital =
    ownCapitalInvested > 0 ? (unrealisedPnlMaster / ownCapitalInvested) * 100 : 0;
  const returnVsOwnCapital =
    ownCapitalInvested > 0
      ? ((currentHoldingValueMaster - ownCapitalInvested) / ownCapitalInvested) * 100
      : 0;

  const duePayablesSaved = Number(master?.totalCreditCardDue ?? 0);
  const ppfSaved = Number(master?.ppfAmount ?? 0);
  const liquidFundSaved = Number(master?.liquidFundInvestment ?? 0);
  const receivablesSaved = Number(master?.receivables ?? 0);
  const grossTotalValue = manualAssetsValue + stocksPresent;
  const coreAssetsServer = ppfSaved + liquidFundSaved + receivablesSaved;
  const totalLiabilities = brokerMarginUsed + duePayablesSaved;
  const totalValue = grossTotalValue + coreAssetsServer - totalLiabilities;
  const duePayablesDirty =
    duePayablesInput.trim() !== (duePayablesSaved > 0 ? String(duePayablesSaved) : '');
  const ppfDirty = ppfInput.trim() !== (ppfSaved > 0 ? String(ppfSaved) : '');
  const liquidFundDirty =
    liquidFundInput.trim() !== (liquidFundSaved > 0 ? String(liquidFundSaved) : '');
  const receivablesDirty =
    receivablesInput.trim() !== (receivablesSaved > 0 ? String(receivablesSaved) : '');

  const hasStocksManualRow =
    settings?.networthAssets?.some((a) => (a.name || '').trim().toLowerCase() === 'stocks') ?? false;

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-20">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Networth Overview</h1>
        <p className="text-gray-400 mt-1">Manage everything you own outside of active trading here.</p>
      </div>

      <div className="p-8 rounded-3xl bg-amber-600/5 border border-amber-500/10 flex flex-col justify-center items-center gap-1">
        <div className="text-sm font-bold text-amber-500/80 uppercase tracking-widest flex items-center gap-2 mb-2">
            <Activity size={18} /> Total Portfolio Networth
        </div>
        <div className="text-5xl font-black text-amber-500">{formatInr(totalValue)}</div>
        <div className="text-xs text-gray-500 mt-2 max-w-md text-center leading-relaxed">
          {formatInr(manualAssetsValue)} manual / other assets
          {hasNeonHoldingsEquity ? (
            <>
              {' '}
              + {formatInr(stocksPresent)} active equity ({activeTrades.length}{' '}
              {activeTrades.length === 1 ? 'position' : 'positions'}, NSE mark)
            </>
          ) : null}
          {brokerMarginUsed > 0 ? (
            <>
              {' '}
              − {formatInr(brokerMarginUsed)} broker margin used
            </>
          ) : null}
          {ppfSaved > 0 || liquidFundSaved > 0 || receivablesSaved > 0 ? (
            <>
              {' '}
              + {formatInr(coreAssetsServer)} (ppf + liquid fund + receivables)
            </>
          ) : null}
          {duePayablesSaved > 0 ? (
            <>
              {' '}
              − {formatInr(duePayablesSaved)} due payables
            </>
          ) : null}
          {hasNeonHoldingsEquity && hasStocksManualRow ? (
            <span className="block mt-1 text-[10px] text-gray-600">
              The &quot;Stocks&quot; manual row is excluded from the total while you have active trades, to avoid double-counting equity.
            </span>
          ) : null}
          <span className="block mt-1 text-[10px] text-gray-600">
            Actual networth = manual assets + active equity + (ppf + liquid fund + receivables) − (margin +
            due payables).
          </span>
        </div>
        {activeSymbols.length > 0 && quotesFetching ? (
          <div className="mt-2 flex items-center gap-2 text-xs text-blue-400/90">
            <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" aria-hidden />
            Updating NSE marks…
          </div>
        ) : null}
        {activeSymbols.length > 0 && quoteErrors > 0 ? (
          <div className="mt-1 text-[11px] text-amber-500/90">
            {quoteErrors} quote{quoteErrors === 1 ? '' : 's'} failed — present value may use last saved price.
          </div>
        ) : null}
      </div>

      {holdingsQuery.isError ? (
        <div className="p-6 rounded-3xl border border-red-500/25 bg-red-500/5 text-sm text-red-300">
          Could not load holdings from the server. Refresh the page or try again later.
        </div>
      ) : holdingsQuery.isPending ? (
        <div className="p-6 rounded-3xl border border-white/10 bg-[#161618] flex items-center gap-2 text-sm text-gray-400">
          <Loader2 className="h-4 w-4 animate-spin shrink-0 text-blue-400" aria-hidden />
          Loading holdings from server…
        </div>
      ) : showHoldingsEmptyState ? (
        <div className="p-6 rounded-3xl border border-blue-500/20 bg-blue-500/5 space-y-2">
          <h2 className="text-sm font-bold text-blue-300 uppercase tracking-widest">Holdings</h2>
          <p className="text-sm text-gray-300 leading-relaxed">
            <span className="font-semibold text-white">Not enough data.</span>{' '}
            {holdingsResult?.kind === 'unauthorized'
              ? 'Sign in to load positions from the database, or import a holdings file after signing in.'
              : 'There are no rows in your server holdings yet. Use Import Zerodha Holdings below to save positions to the database.'}
          </p>
        </div>
      ) : hasNeonHoldingsEquity ? (
        <div className="p-6 rounded-3xl bg-blue-600/5 border border-blue-500/10 space-y-6">
          <div>
            <h2 className="text-sm font-bold text-blue-400 uppercase tracking-widest">
              Stocks & Active Trading Segment
            </h2>
            <p className="text-[11px] text-gray-500 mt-1.5 leading-relaxed">
              Compare gross / margin-inclusive cost basis (left) with your own capital after subtracting broker
              margin (right). Rupee P&amp;L is the same; percentages differ when margin is used.
            </p>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <div className="space-y-3">
              <h3 className="text-[11px] font-bold text-cyan-300/90 uppercase tracking-widest">
                With margin · gross basis
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="p-4 rounded-2xl bg-[#0a0a0b] border border-white/5">
                  <div className="text-[10px] text-gray-500 font-bold uppercase mb-1 font-mono inline-flex items-center gap-1.5">
                    total_invested
                    <InfoHint text="Gross cost of holdings (Σ qty × average price) at last upload — includes value funded with margin. Source: user_networth_master.total_invested." />
                  </div>
                  <div className="text-lg font-bold flex items-center gap-2">
                    {networthMasterQuery.isPending && master === undefined ? (
                      <Loader2 className="h-5 w-5 animate-spin text-blue-400 shrink-0" aria-hidden />
                    ) : (
                      formatInr(totalInvestedGross)
                    )}
                  </div>
                </div>
                <div className="p-4 rounded-2xl bg-[#0a0a0b] border border-white/5">
                  <div className="text-[10px] text-gray-500 font-bold uppercase mb-1 font-mono">
                    current_holding_value
                  </div>
                  <div className="text-lg font-bold flex items-center gap-2">
                    {networthMasterQuery.isPending && master === undefined ? (
                      <Loader2 className="h-5 w-5 animate-spin text-blue-400 shrink-0" aria-hidden />
                    ) : (
                      formatInr(currentHoldingValueMaster)
                    )}
                  </div>
                  <p className="text-[10px] text-gray-600 mt-1 leading-snug">
                    Σ qty × prev close from last upload (same row as DB).
                  </p>
                </div>
                <div className="p-4 rounded-2xl bg-[#0a0a0b] border border-white/5">
                  <div className="text-[10px] text-gray-500 font-bold uppercase mb-1 font-mono">
                    unrealised_pnl
                  </div>
                  <div
                    className={`text-lg font-bold flex items-center gap-2 ${
                      unrealisedPnlMaster >= 0 ? 'text-green-400' : 'text-red-400'
                    }`}
                  >
                    {networthMasterQuery.isPending && master === undefined ? (
                      <Loader2 className="h-5 w-5 animate-spin text-blue-400 shrink-0" aria-hidden />
                    ) : (
                      formatInr(unrealisedPnlMaster)
                    )}
                  </div>
                  <p className="text-[10px] text-gray-600 mt-1 leading-snug">
                    current_holding_value − total_invested (stored on upload / margin recompute).
                  </p>
                </div>
                <div className="p-4 rounded-2xl bg-[#0a0a0b] border border-white/5">
                  <div className="text-[10px] text-gray-500 font-bold uppercase mb-1 font-mono">
                    unrealised_pnl_pct
                  </div>
                  <div
                    className={`text-lg font-bold flex items-center gap-2 ${
                      unrealisedPnlMaster >= 0 ? 'text-green-400' : 'text-red-400'
                    }`}
                  >
                    {networthMasterQuery.isPending && master === undefined ? (
                      <Loader2 className="h-5 w-5 animate-spin text-blue-400 shrink-0" aria-hidden />
                    ) : (
                      `${unrealisedPnlPctMaster.toFixed(2)}%`
                    )}
                  </div>
                  <p className="text-[10px] text-gray-600 mt-1 leading-snug">
                    vs gross cost basis (total_invested), from master row.
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <h3 className="text-[11px] font-bold text-violet-300/90 uppercase tracking-widest">
                Without margin · own capital
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="p-4 rounded-2xl bg-[#0a0a0b] border border-white/5">
                  <div className="text-[10px] text-gray-500 font-bold uppercase mb-1 font-mono inline-flex items-center gap-1.5">
                    actual_invested
                    <InfoHint text="Your cash in the book: total_invested minus broker margin used (max of local setting and server margin_amount)." />
                  </div>
                  <div className="text-lg font-bold flex items-center gap-2">
                    {networthMasterQuery.isPending && master === undefined ? (
                      <Loader2 className="h-5 w-5 animate-spin text-violet-400 shrink-0" aria-hidden />
                    ) : ownCapitalInvested <= 0 && marginForBasis > 0 ? (
                      <span className="text-gray-500 text-base font-semibold">—</span>
                    ) : (
                      formatInr(ownCapitalInvested)
                    )}
                  </div>
                  <p className="text-[10px] text-gray-600 mt-1 leading-snug">
                    total_invested − margin ({formatInr(marginForBasis)}).
                  </p>
                </div>
                <div className="p-4 rounded-2xl bg-[#0a0a0b] border border-white/5">
                  <div className="text-[10px] text-gray-500 font-bold uppercase mb-1 font-mono inline-flex items-center gap-1.5">
                    actual_profit
                    <InfoHint text="Same absolute unrealised P&amp;L as gross view: current_holding_value − total_invested." />
                  </div>
                  <div
                    className={`text-lg font-bold flex items-center gap-2 ${
                      unrealisedPnlMaster >= 0 ? 'text-green-400' : 'text-red-400'
                    }`}
                  >
                    {networthMasterQuery.isPending && master === undefined ? (
                      <Loader2 className="h-5 w-5 animate-spin text-violet-400 shrink-0" aria-hidden />
                    ) : (
                      formatInr(unrealisedPnlMaster)
                    )}
                  </div>
                </div>
                <div className="p-4 rounded-2xl bg-[#0a0a0b] border border-white/5">
                  <div className="text-[10px] text-gray-500 font-bold uppercase mb-1 font-mono">
                    pnl_pct_on_own
                  </div>
                  <div
                    className={`text-lg font-bold flex items-center gap-2 ${
                      pnlPctOnOwnCapital >= 0 ? 'text-green-400' : 'text-red-400'
                    }`}
                  >
                    {networthMasterQuery.isPending && master === undefined ? (
                      <Loader2 className="h-5 w-5 animate-spin text-violet-400 shrink-0" aria-hidden />
                    ) : ownCapitalInvested <= 0 ? (
                      <span className="text-gray-500 text-base font-semibold">—</span>
                    ) : (
                      `${pnlPctOnOwnCapital.toFixed(2)}%`
                    )}
                  </div>
                  <p className="text-[10px] text-gray-600 mt-1 leading-snug">
                    unrealised_pnl ÷ actual_invested (return on cash you put in).
                  </p>
                </div>
                <div className="p-4 rounded-2xl bg-[#0a0a0b] border border-white/5">
                  <div className="text-[10px] text-gray-500 font-bold uppercase mb-1 font-mono inline-flex items-center gap-1.5">
                    return_vs_own
                    <InfoHint text="Mark-to-market vs own capital: (current_holding_value − actual_invested) / actual_invested. Larger than P&amp;L% on own when part of the book was margin-funded." />
                  </div>
                  <div
                    className={`text-lg font-bold flex items-center gap-2 ${
                      returnVsOwnCapital >= 0 ? 'text-green-400' : 'text-red-400'
                    }`}
                  >
                    {networthMasterQuery.isPending && master === undefined ? (
                      <Loader2 className="h-5 w-5 animate-spin text-violet-400 shrink-0" aria-hidden />
                    ) : ownCapitalInvested <= 0 ? (
                      <span className="text-gray-500 text-base font-semibold">—</span>
                    ) : (
                      `${returnVsOwnCapital.toFixed(2)}%`
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <section className="p-6 rounded-3xl bg-[#161618] border border-white/5 space-y-4">
        <h2 className="text-sm font-bold text-gray-500 uppercase tracking-widest">
          Margin Adjustment
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 rounded-2xl bg-[#0a0a0b] border border-white/5 space-y-2">
            <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest">
              Broker Margin Used
            </label>
            <div className="flex items-center gap-2">
              <span className="text-gray-500">₹</span>
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
                className="w-full bg-transparent outline-none font-bold text-lg"
                placeholder="0"
              />
            </div>
            <p className="text-[10px] text-gray-600">
              Enter borrowed margin from broker. This is subtracted from gross portfolio value.
            </p>
          </div>
          <div className="p-4 rounded-2xl bg-[#0a0a0b] border border-white/5">
            <div className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-2">
              Actual Networth Formula
            </div>
            <div className="text-sm text-gray-300 leading-relaxed">
              {formatInr(grossTotalValue)} gross assets + {formatInr(coreAssetsServer)} (ppf + liquid + receivables)
              − {formatInr(totalLiabilities)} liabilities ={' '}
              <span className="font-black text-amber-400">{formatInr(totalValue)}</span>
            </div>
          </div>
        </div>
      </section>

      <section className="p-6 rounded-3xl bg-[#161618] border border-white/5 space-y-4">
        <h2 className="text-sm font-bold text-gray-500 uppercase tracking-widest">
          Server-Saved Core Assets
        </h2>
        <p className="text-[11px] text-gray-600 leading-relaxed">
          These map directly to `user_networth_master` columns: due payables (what you owe) →
          `total_credit_card_due`, receivables (what others owe you) → `receivables`, ppf → `ppf_amount`,
          liquid fund → `liquid_fund_investment`.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
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
        </div>
        {financialFieldMutation.isError ? (
          <p className="text-xs text-red-400">
            {financialFieldMutation.error instanceof Error
              ? financialFieldMutation.error.message
              : 'Failed to save'}
          </p>
        ) : null}
      </section>

      {error && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 flex items-start gap-3">
          <ShieldAlert className="text-red-400 shrink-0" size={20} />
          <div className="text-sm text-red-400 font-medium">{error}</div>
        </div>
      )}

      <section className="p-8 rounded-3xl bg-[#161618] border border-white/5 space-y-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <PieChart className="text-green-400" size={24} />
            <h2 className="text-xl font-bold">Manual & Imported Assets</h2>
          </div>
          
          <div className="flex gap-2">
              <input 
                  type="file" 
                  ref={fileInputRef} 
                  accept=".xlsx, .xls, .csv" 
                  className="hidden" 
                  onChange={handleFileUpload}
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isImporting}
                className="flex items-center gap-2 text-xs font-bold bg-green-500/10 text-green-400 hover:bg-green-500/20 disabled:opacity-60 disabled:cursor-not-allowed px-4 py-2 rounded-xl transition-all"
              >
                {isImporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload size={14} />}
                {isImporting ? 'Importing...' : 'Import Zerodha Holdings'}
              </button>
              <button
                onClick={addNetworthAsset}
                className="flex items-center gap-2 text-xs font-bold bg-white/5 hover:bg-white/10 px-4 py-2 rounded-xl transition-all"
              >
                <Plus size={14} /> Add Asset
              </button>
          </div>
        </div>

        {isImporting && (
          <div className="rounded-2xl border border-blue-500/20 bg-blue-500/5 p-4">
            <div className="text-[10px] font-bold uppercase tracking-widest text-blue-300">
              Import In Progress
            </div>
            <div className="mt-2 space-y-1.5 text-sm text-gray-300">
              <div className="flex items-center gap-2">
                {importStep === 'uploading' ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-300" />
                ) : (
                  <span className="text-green-400">✓</span>
                )}
                <span>Parsing spreadsheet</span>
              </div>
              <div className="flex items-center gap-2">
                {importStep === 'saving' ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-300" />
                ) : importStep === 'uploading' ? (
                  <span className="text-gray-500">•</span>
                ) : (
                  <span className="text-green-400">✓</span>
                )}
                <span>Saving holdings to Neon &amp; refreshing</span>
              </div>
            </div>
          </div>
        )}
        
        <div className="space-y-3">
          {settings.networthAssets?.map(asset => {
              return (
                  <div key={asset.id} className="flex gap-4 items-center p-3 rounded-2xl border bg-[#0a0a0b] border-white/5">
                    <div className="flex-2 flex items-center gap-2 pl-2">
                        <input
                          type="text"
                          value={asset.name}
                          onChange={(e) => updateNetworthAsset(asset.id, { name: e.target.value })}
                          className="w-full bg-transparent outline-none font-bold placeholder-gray-600"
                          placeholder="Asset Name (e.g. PPF, Bank)"
                        />
                    </div>
                    <div className="flex-1 flex items-center gap-2">
                      <span className="text-gray-500">₹</span>
                      <input
                        type="number"
                        value={asset.value}
                        onChange={(e) => updateNetworthAsset(asset.id, { value: parseFloat(e.target.value) })}
                        className="w-full bg-transparent outline-none font-medium text-right pr-2"
                        placeholder="Value"
                      />
                    </div>
                    <button
                      onClick={() => deleteNetworthAsset(asset.id)}
                      className="p-3 text-red-500/50 hover:text-red-400 hover:bg-red-500/10 rounded-xl transition-all shrink-0"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
              );
          })}
          {(!settings.networthAssets || settings.networthAssets.length === 0) && (
            <div className="text-center py-10">
                <p className="text-gray-500 text-sm italic">No assets defined. Time to track your wealth!</p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
