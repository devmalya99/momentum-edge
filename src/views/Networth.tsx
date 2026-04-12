import React, { useState, useRef, useMemo } from 'react';
import { useTradeStore } from '../store/useTradeStore';
import { PieChart, Plus, Trash2, Upload, Activity, ShieldAlert, Loader2 } from 'lucide-react';
import * as xlsx from 'xlsx';
import { markPriceForTrade, useActiveTradeLivePrices } from '@/hooks/useActiveTradeLivePrices';
import { formatInr } from '@/lib/format-inr';

export default function Networth() {
  const { settings, updateSettings, trades, addTrades } = useTradeStore();
  const { livePriceBySymbol, quotesFetching, quoteErrors, activeSymbols } =
    useActiveTradeLivePrices(trades);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);

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

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = xlsx.read(bstr, { type: 'binary' });
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

        const defaultType = settings.tradeTypes?.[0]?.name || 'Buy & Forget';
        const existingActiveSymbols = new Set(trades.filter(t => t.status === 'Active').map(t => t.symbol));
        const newTrades = [];
        
        for (let i = headerIdx + 1; i < data.length; i++) {
            const row = data[i];
            if (!row || row.length === 0) continue;
            
            const symbol = row[symIdx];
            if (!symbol || symbol === 'Total' || symbol === 'Summary') continue;
            
            const qty = parseFloat(row[qtyIdx] || 0);
            const entryPrice = parseFloat(row[avgPriceIdx] || 0);
            const currentPrice = parseFloat(row[closePriceIdx] || 0);
            
            if (qty > 0 && entryPrice > 0 && !existingActiveSymbols.has(symbol)) {
                 newTrades.push({ 
                     symbol: symbol,
                     type: defaultType,
                     entryPrice: entryPrice,
                     currentPrice: currentPrice,
                     stopLoss: entryPrice * 0.9, // placeholder stoploss -10%
                     positionSize: qty,
                     status: 'Active',
                     ruleScores: {},
                     totalScore: 0,
                     maxPossibleScore: 0,
                     scorePercentage: 0,
                     verdict: 'B' as const,
                     checklist: {
                       priorRally: false, tightBase: false, breakoutLevel: false,
                       volumeConfirmation: false, emaAlignment: false, relativeStrength: false
                     },
                     notes: 'Imported dynamically from Broker Holdings Statement.',
                     mistakes: []
                 });
            }
        }
        
        if (newTrades.length > 0) {
            addTrades(newTrades as any);
            alert(`Successfully imported ${newTrades.length} new trades to dashboard!`);
        } else {
            alert('No new holdings found, or all symbols are already active in your dashboard.');
        }
        
        if (fileInputRef.current) fileInputRef.current.value = '';
      } catch (err: any) {
        setError(err.message || 'Error parsing file.');
      }
    };
    reader.readAsBinaryString(file);
  };

  const activeTrades = trades.filter((t) => t.status === 'Active');
  const hasActiveEquity = activeTrades.length > 0;

  /** Sum manual / imported assets. If you have logged active trades, the template "Stocks" row is skipped so equity is not double-counted. */
  const manualAssetsValue = useMemo(() => {
    const assets = settings?.networthAssets || [];
    return assets.reduce((sum, asset) => {
      const name = (asset.name || '').trim().toLowerCase();
      if (hasActiveEquity && name === 'stocks') return sum;
      return sum + (Number(asset.value) || 0);
    }, 0);
  }, [settings?.networthAssets, hasActiveEquity]);

  const stocksInvested = activeTrades.reduce((sum, t) => sum + t.positionSize * t.entryPrice, 0);
  const stocksPresent = activeTrades.reduce(
    (sum, t) => sum + t.positionSize * markPriceForTrade(t, livePriceBySymbol),
    0,
  );
  const stocksUnrealized = stocksPresent - stocksInvested;
  const stocksUnrealizedPct = stocksInvested > 0 ? (stocksUnrealized / stocksInvested) * 100 : 0;

  const totalValue = manualAssetsValue + stocksPresent;

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
          {hasActiveEquity ? (
            <>
              {' '}
              + {formatInr(stocksPresent)} active equity ({activeTrades.length}{' '}
              {activeTrades.length === 1 ? 'position' : 'positions'}, NSE mark)
            </>
          ) : null}
          {hasActiveEquity && hasStocksManualRow ? (
            <span className="block mt-1 text-[10px] text-gray-600">
              The &quot;Stocks&quot; manual row is excluded from the total while you have active trades, to avoid double-counting equity.
            </span>
          ) : null}
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

      {stocksInvested > 0 && (
        <div className="p-6 rounded-3xl bg-blue-600/5 border border-blue-500/10">
          <h2 className="text-sm font-bold text-blue-400 uppercase tracking-widest mb-4">Stocks & Active Trading Segment</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-4 rounded-2xl bg-[#0a0a0b] border border-white/5">
              <div className="text-[10px] text-gray-500 font-bold uppercase mb-1">Invested Value</div>
              <div className="text-lg font-bold">{formatInr(stocksInvested)}</div>
            </div>
            <div className="p-4 rounded-2xl bg-[#0a0a0b] border border-white/5">
              <div className="text-[10px] text-gray-500 font-bold uppercase mb-1">Present Value</div>
              <div className="text-lg font-bold">{formatInr(stocksPresent)}</div>
            </div>
            <div className="p-4 rounded-2xl bg-[#0a0a0b] border border-white/5">
              <div className="text-[10px] text-gray-500 font-bold uppercase mb-1">Unrealized P&L</div>
              <div className={`text-lg font-bold ${stocksUnrealized >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {formatInr(stocksUnrealized)}
              </div>
            </div>
            <div className="p-4 rounded-2xl bg-[#0a0a0b] border border-white/5">
              <div className="text-[10px] text-gray-500 font-bold uppercase mb-1">Unrealized %</div>
              <div className={`text-lg font-bold ${stocksUnrealized >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {stocksUnrealizedPct.toFixed(2)}%
              </div>
            </div>
          </div>
        </div>
      )}

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
                className="flex items-center gap-2 text-xs font-bold bg-green-500/10 text-green-400 hover:bg-green-500/20 px-4 py-2 rounded-xl transition-all"
              >
                <Upload size={14} /> Import Zerodha Holdings
              </button>
              <button
                onClick={addNetworthAsset}
                className="flex items-center gap-2 text-xs font-bold bg-white/5 hover:bg-white/10 px-4 py-2 rounded-xl transition-all"
              >
                <Plus size={14} /> Add Asset
              </button>
          </div>
        </div>
        
        <div className="space-y-3">
          {settings.networthAssets?.map(asset => {
              return (
                  <div key={asset.id} className="flex gap-4 items-center p-3 rounded-2xl border bg-[#0a0a0b] border-white/5">
                    <div className="flex-[2] flex items-center gap-2 pl-2">
                        <input
                          type="text"
                          value={asset.name}
                          onChange={(e) => updateNetworthAsset(asset.id, { name: e.target.value })}
                          className="w-full bg-transparent outline-none font-bold placeholder-gray-600"
                          placeholder="Asset Name (e.g. PPF, Bank)"
                        />
                    </div>
                    <div className="flex-[1] flex items-center gap-2">
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
