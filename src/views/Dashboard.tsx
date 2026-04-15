import React, { useState, useMemo } from 'react';
import { useTradeStore } from '../store/useTradeStore';
import TradeCard from '../components/TradeCard';
import { Search, TrendingUp, TrendingDown, Activity, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import TradeDetail from './TradeDetail'; // We'll create this next
import { markPriceForTrade, useActiveTradeLivePrices } from '@/hooks/useActiveTradeLivePrices';
import StockChartModal from '@/components/StockChartModal';
import { toTradingViewSymbol } from '@/lib/tradingview-symbol';

export default function Dashboard() {
  const { trades, isLoading, settings } = useTradeStore();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'All' | 'Active' | 'Closed'>('All');
  const [tradeTypeFilter, setTradeTypeFilter] = useState<string>('All');
  type SortKey = 'date' | 'invested' | 'pnlValue' | 'pnlPercent';
  const [sortKey, setSortKey] = useState<SortKey>('date');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [selectedTradeId, setSelectedTradeId] = useState<string | null>(null);
  const [chartSymbol, setChartSymbol] = useState<string | null>(null);

  const { activeSymbols, livePriceBySymbol, quotesFetching, quoteErrors } =
    useActiveTradeLivePrices(trades);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('desc'); }
  };

  const tradeTypeOptions = useMemo(() => {
    const fromSettings = (settings.tradeTypes ?? []).map((t) => t.name).filter(Boolean);
    const fromTrades = trades.map((t) => t.type).filter(Boolean);
    return ['All', ...Array.from(new Set([...fromSettings, ...fromTrades]))];
  }, [settings.tradeTypes, trades]);

  const typeFilteredTrades = useMemo(() => {
    if (tradeTypeFilter === 'All') return trades;
    return trades.filter((t) => t.type === tradeTypeFilter);
  }, [trades, tradeTypeFilter]);

  const activeTypeBreakdown = useMemo(() => {
    const activeTrades = trades.filter((t) => t.status === 'Active');
    const totalAllocation = activeTrades.reduce(
      (sum, t) => sum + t.positionSize * markPriceForTrade(t, livePriceBySymbol),
      0,
    );
    const grouped = new Map<string, { type: string; stocks: number; allocation: number }>();

    for (const trade of activeTrades) {
      const key = trade.type || 'Uncategorized';
      const existing = grouped.get(key);
      const allocation = trade.positionSize * markPriceForTrade(trade, livePriceBySymbol);
      if (!existing) {
        grouped.set(key, { type: key, stocks: 1, allocation });
      } else {
        grouped.set(key, {
          ...existing,
          stocks: existing.stocks + 1,
          allocation: existing.allocation + allocation,
        });
      }
    }

    return {
      totalAllocation,
      rows: Array.from(grouped.values()).sort((a, b) => b.allocation - a.allocation),
    };
  }, [trades, livePriceBySymbol]);

  const sortedAndFilteredTrades = useMemo(() => {
    const result = typeFilteredTrades.filter(t => {
      const matchesSearch = t.symbol.toLowerCase().includes(search.toLowerCase());
      const matchesFilter = filter === 'All' || t.status === filter;
      return matchesSearch && matchesFilter;
    });
    
    result.sort((a, b) => {
      let valA = 0; let valB = 0;
      if (sortKey === 'date') { valA = a.entryDate; valB = b.entryDate; }
      else if (sortKey === 'invested') {
        valA = a.positionSize * a.entryPrice;
        valB = b.positionSize * b.entryPrice;
      }
      else if (sortKey === 'pnlValue') {
        const pa = markPriceForTrade(a, livePriceBySymbol);
        const pb = markPriceForTrade(b, livePriceBySymbol);
        valA = a.status === 'Active' ? (pa - a.entryPrice) * a.positionSize : ((a.exitPrice! - a.entryPrice) * a.positionSize);
        valB = b.status === 'Active' ? (pb - b.entryPrice) * b.positionSize : ((b.exitPrice! - b.entryPrice) * b.positionSize);
      }
      else if (sortKey === 'pnlPercent') {
        const pa = markPriceForTrade(a, livePriceBySymbol);
        const pb = markPriceForTrade(b, livePriceBySymbol);
        valA = a.status === 'Active' ? (pa - a.entryPrice) / a.entryPrice : ((a.exitPrice! - a.entryPrice) / a.entryPrice);
        valB = b.status === 'Active' ? (pb - b.entryPrice) / b.entryPrice : ((b.exitPrice! - b.entryPrice) / b.entryPrice);
      }
      return sortDir === 'asc' ? valA - valB : valB - valA;
    });
    return result;
  }, [typeFilteredTrades, search, filter, sortKey, sortDir, livePriceBySymbol]);

  const stats = useMemo(() => {
    const activeTrades = typeFilteredTrades.filter(t => t.status === 'Active');
    const closed = typeFilteredTrades.filter(t => t.status === 'Closed');
    const wins = closed.filter(t => t.exitPrice! > t.entryPrice).length;
    const winRate = closed.length > 0 ? (wins / closed.length) * 100 : 0;
    
    const stocksInvested = activeTrades.reduce((sum, t) => sum + (t.positionSize * t.entryPrice), 0);
    const stocksPresent = activeTrades.reduce(
      (sum, t) => sum + t.positionSize * markPriceForTrade(t, livePriceBySymbol),
      0,
    );
    const stocksUnrealized = stocksPresent - stocksInvested;
    const brokerMarginUsed =
      typeof settings?.brokerMarginUsed === 'number' && Number.isFinite(settings.brokerMarginUsed)
        ? settings.brokerMarginUsed
        : 0;
    const actualInvestedCapital = Math.max(0, stocksInvested - brokerMarginUsed);
    const stocksUnrealizedPct =
      actualInvestedCapital > 0 ? (stocksUnrealized / actualInvestedCapital) * 100 : 0;
    
    return {
      active: activeTrades.length,
      winRate,
      total: typeFilteredTrades.length,
      stocksInvested,
      stocksPresent,
      stocksUnrealized,
      stocksUnrealizedPct,
      brokerMarginUsed,
    };
  }, [typeFilteredTrades, livePriceBySymbol, settings?.brokerMarginUsed]);

  const selectedTrade = trades.find(t => t.id === selectedTradeId);

  if (isLoading) return <div className="flex items-center justify-center h-64">Loading...</div>;

  return (
    <div className="space-y-8">
      {/* Networth Overview & Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="p-6 rounded-3xl bg-amber-600/5 border border-amber-500/10 flex flex-col justify-center gap-1 md:col-span-1">
          <div className="text-xs font-bold text-amber-500/80 uppercase tracking-widest mb-1 flex items-center gap-2">
            <Activity size={14} /> Total Networth
          </div>
          <div className="text-3xl font-black text-amber-500">
             ₹
            {(
              (settings?.networthAssets?.reduce((sum, asset) => sum + (asset.value || 0), 0) || 0) +
              trades
                .filter((t) => t.status === 'Active')
                .reduce((sum, t) => sum + t.positionSize * markPriceForTrade(t, livePriceBySymbol), 0)
              -
              (typeof settings?.brokerMarginUsed === 'number' && Number.isFinite(settings.brokerMarginUsed)
                ? settings.brokerMarginUsed
                : 0)
            ).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
          </div>
          <div className="text-[10px] text-gray-500 mt-2">Static Assets + Active Trades − Margin Used</div>
        </div>

        <div className="p-6 rounded-3xl bg-blue-600/5 border border-blue-500/10 flex items-center gap-5">
          <div className="w-12 h-12 rounded-2xl bg-blue-500/10 flex items-center justify-center text-blue-400">
            <Activity size={24} />
          </div>
          <div>
            <div className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Active Trades</div>
            <div className="text-2xl font-black">{stats.active}</div>
          </div>
        </div>
        
        <div className="p-6 rounded-3xl bg-green-600/5 border border-green-500/10 flex items-center gap-5">
          <div className="w-12 h-12 rounded-2xl bg-green-500/10 flex items-center justify-center text-green-400">
            <TrendingUp size={24} />
          </div>
          <div>
            <div className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Win Rate</div>
            <div className="text-2xl font-black">{stats.winRate.toFixed(1)}%</div>
          </div>
        </div>
        
        <div className="p-6 rounded-3xl bg-purple-600/5 border border-purple-500/10 flex items-center gap-5">
          <div className="w-12 h-12 rounded-2xl bg-purple-500/10 flex items-center justify-center text-purple-400">
            <TrendingDown size={24} />
          </div>
          <div>
            <div className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Total Logs</div>
            <div className="text-2xl font-black">{stats.total}</div>
          </div>
        </div>
      </div>

      {activeSymbols.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-white/10 bg-[#161618] px-4 py-3 text-xs text-gray-400">
          {quotesFetching ? (
            <span className="flex items-center gap-2 text-blue-400/90">
              <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" aria-hidden />
              Refreshing NSE prices…
            </span>
          ) : (
            <span>
              Live NSE (EQ) quotes — refetch on tab focus and every 5 min ({activeSymbols.length}{' '}
              {activeSymbols.length === 1 ? 'symbol' : 'symbols'})
            </span>
          )}
          {quoteErrors > 0 ? (
            <span className="text-amber-500/90">
              {quoteErrors} of {activeSymbols.length} quotes failed (check symbol / NSE)
            </span>
          ) : null}
        </div>
      )}

      {activeTypeBreakdown.rows.length > 0 && (
        <div className="p-6 rounded-3xl bg-cyan-600/5 border border-cyan-500/10">
          <div className="flex items-center justify-between gap-3 mb-4">
            <h2 className="text-sm font-bold text-cyan-400 uppercase tracking-widest">
              Active Allocation By Trade Type
            </h2>
            <button
              type="button"
              onClick={() => setTradeTypeFilter('All')}
              className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest border transition-all ${
                tradeTypeFilter === 'All'
                  ? 'bg-cyan-500/20 border-cyan-400/40 text-cyan-300'
                  : 'bg-[#0a0a0b] border-white/10 text-gray-500 hover:text-gray-300'
              }`}
            >
              All
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {activeTypeBreakdown.rows.map((row) => {
              const allocationPct =
                activeTypeBreakdown.totalAllocation > 0
                  ? (row.allocation / activeTypeBreakdown.totalAllocation) * 100
                  : 0;
              const isActive = tradeTypeFilter === row.type;
              return (
                <button
                  key={row.type}
                  type="button"
                  onClick={() => setTradeTypeFilter(row.type)}
                  className={`text-left p-4 rounded-2xl border transition-all ${
                    isActive
                      ? 'bg-cyan-500/15 border-cyan-400/40'
                      : 'bg-[#0a0a0b] border-white/10 hover:border-white/20'
                  }`}
                >
                  <div className="text-xs font-bold uppercase tracking-wider text-cyan-300 truncate">
                    {row.type}
                  </div>
                  <div className="mt-2 text-sm text-gray-300">
                    Allocation: ₹
                    {row.allocation.toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </div>
                  <div className="text-[11px] text-gray-500 mt-1">
                    Stocks: {row.stocks} · {allocationPct.toFixed(1)}%
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {stats.stocksInvested > 0 && (
        <div className="p-6 rounded-3xl bg-blue-600/5 border border-blue-500/10">
          <h2 className="text-sm font-bold text-blue-400 uppercase tracking-widest mb-4">Stocks & Active Trading Segment</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-4 rounded-2xl bg-[#0a0a0b] border border-white/5">
              <div className="text-[10px] text-gray-500 font-bold uppercase mb-1">Invested Value</div>
              <div className="text-lg font-bold">₹{stats.stocksInvested.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
            </div>
            <div className="p-4 rounded-2xl bg-[#0a0a0b] border border-white/5">
              <div className="text-[10px] text-gray-500 font-bold uppercase mb-1">Present Value</div>
              <div className="text-lg font-bold">₹{stats.stocksPresent.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
            </div>
            <div className="p-4 rounded-2xl bg-[#0a0a0b] border border-white/5">
              <div className="text-[10px] text-gray-500 font-bold uppercase mb-1">Unrealized P&L</div>
              <div className={`text-lg font-bold ${stats.stocksUnrealized >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                ₹{stats.stocksUnrealized.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </div>
            <div className="p-4 rounded-2xl bg-[#0a0a0b] border border-white/5">
              <div className="text-[10px] text-gray-500 font-bold uppercase mb-1">
                Unrealized % (on invested - margin)
              </div>
              <div className={`text-lg font-bold ${stats.stocksUnrealized >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {stats.stocksUnrealizedPct.toFixed(2)}%
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Filters & Search */}
      <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="w-full md:w-auto flex flex-col md:flex-row gap-3">
          <div className="relative w-full md:w-96">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
            <input
              type="text"
              placeholder="Search symbol..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-[#161618] border border-white/5 rounded-2xl pl-12 pr-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2 p-1 bg-[#161618] border border-white/5 rounded-2xl">
            {tradeTypeOptions.map((typeOption) => (
              <button
                key={typeOption}
                type="button"
                onClick={() => setTradeTypeFilter(typeOption)}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                  tradeTypeFilter === typeOption
                    ? 'bg-cyan-600 text-white'
                    : 'text-gray-500 hover:text-gray-300'
                }`}
              >
                {typeOption}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2 p-1 bg-[#161618] border border-white/5 rounded-2xl">
          {(['All', 'Active', 'Closed'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-6 py-2 rounded-xl text-xs font-bold transition-all ${
                filter === f ? 'bg-blue-600 text-white' : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Table Header */}
      <div className="hidden lg:grid grid-cols-7 gap-4 px-6 py-3 text-[10px] font-bold text-gray-500 uppercase tracking-widest border-b border-white/5 mx-2">
        <div className="col-span-2 cursor-pointer hover:text-white transition-colors" onClick={() => handleSort('date')}>
          Symbol & Date {sortKey === 'date' && (sortDir === 'asc' ? '↑' : '↓')}
        </div>
        <div className="cursor-pointer hover:text-white transition-colors" onClick={() => handleSort('invested')}>
          Invested {sortKey === 'invested' && (sortDir === 'asc' ? '↑' : '↓')}
        </div>
        <div>Current Price</div>
        <div className="cursor-pointer hover:text-white transition-colors" onClick={() => handleSort('pnlValue')}>
          P&L Value {sortKey === 'pnlValue' && (sortDir === 'asc' ? '↑' : '↓')}
        </div>
        <div className="cursor-pointer hover:text-white transition-colors" onClick={() => handleSort('pnlPercent')}>
          P&L % {sortKey === 'pnlPercent' && (sortDir === 'asc' ? '↑' : '↓')}
        </div>
        <div className="text-right">Actions</div>
      </div>

      {/* Trade List */}
      <div className="flex flex-col gap-2">
        <AnimatePresence mode="popLayout">
          {sortedAndFilteredTrades.map((trade) => (
            <motion.div
              key={trade.id}
              layout
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
            >
              <TradeCard
                trade={trade}
                onClick={() => setSelectedTradeId(trade.id)}
                onSymbolClick={() => setChartSymbol(toTradingViewSymbol(trade.symbol))}
                livePrice={
                  trade.status === 'Active'
                    ? livePriceBySymbol[trade.symbol.trim().toUpperCase()]
                    : undefined
                }
              />
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {sortedAndFilteredTrades.length === 0 && (
        <div className="text-center py-20">
          <div className="text-gray-600 mb-2">No trades found matching your criteria.</div>
          <button className="text-blue-400 font-bold hover:underline">Log your first trade</button>
        </div>
      )}

      {/* Trade Detail Modal */}
      <AnimatePresence>
        {selectedTradeId && selectedTrade && (
          <TradeDetail 
            trade={selectedTrade} 
            onClose={() => setSelectedTradeId(null)} 
          />
        )}
        {chartSymbol && (
          <StockChartModal symbol={chartSymbol} onClose={() => setChartSymbol(null)} />
        )}
      </AnimatePresence>
    </div>
  );
}
