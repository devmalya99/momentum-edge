'use client';

import React, { useState, useMemo, useCallback } from 'react';
import { useTradeStore } from '../store/useTradeStore';
import PortfolioKanbanBoard from '../components/PortfolioKanbanBoard';
import TradeCard from '../components/TradeCard';
import { Search, TrendingUp, TrendingDown, Activity, Loader2, LayoutGrid, List, Columns2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Link from 'next/link';
import TradeDetail from './TradeDetail'; // We'll create this next
import { markPriceForTrade, useActiveTradeLivePrices } from '@/hooks/useActiveTradeLivePrices';
import StockChartModal from '@/components/StockChartModal';
import { toTradingViewSymbol } from '@/lib/tradingview-symbol';

export default function Dashboard() {
  const { trades, isLoading, settings, updateTrade, updateSettings } = useTradeStore();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'All' | 'Active' | 'Closed'>('All');
  const [tradeTypeFilter, setTradeTypeFilter] = useState<string>('All');
  type SortKey = 'date' | 'invested' | 'pnlValue' | 'pnlPercent';
  const [sortKey, setSortKey] = useState<SortKey>('date');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [selectedTradeId, setSelectedTradeId] = useState<string | null>(null);
  const [chartSymbol, setChartSymbol] = useState<string | null>(null);
  const [portfolioLayout, setPortfolioLayout] = useState<'both' | 'board' | 'table'>('both');

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setSortKey(key);
      setSortDir('desc');
    }
  };

  const { activeSymbols, livePriceBySymbol, quotesFetching, quoteErrors } =
    useActiveTradeLivePrices(trades);

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

  const filteredTrades = useMemo(
    () =>
      typeFilteredTrades.filter((t) => {
        const matchesSearch = t.symbol.toLowerCase().includes(search.toLowerCase());
        const matchesFilter = filter === 'All' || t.status === filter;
        return matchesSearch && matchesFilter;
      }),
    [typeFilteredTrades, search, filter],
  );

  const kanbanDisplayTrades = useMemo(() => {
    return trades.filter((t) => {
      const matchesSearch = t.symbol.toLowerCase().includes(search.toLowerCase());
      const matchesFilter = filter === 'All' || t.status === filter;
      return matchesSearch && matchesFilter;
    });
  }, [trades, search, filter]);

  const tableSortedTrades = useMemo(() => {
    const result = [...filteredTrades];
    result.sort((a, b) => {
      let valA = 0;
      let valB = 0;
      if (sortKey === 'date') {
        valA = a.entryDate;
        valB = b.entryDate;
      } else if (sortKey === 'invested') {
        valA = a.positionSize * a.entryPrice;
        valB = b.positionSize * b.entryPrice;
      } else if (sortKey === 'pnlValue') {
        const pa = markPriceForTrade(a, livePriceBySymbol);
        const pb = markPriceForTrade(b, livePriceBySymbol);
        valA =
          a.status === 'Active'
            ? (pa - a.entryPrice) * a.positionSize
            : (a.exitPrice! - a.entryPrice) * a.positionSize;
        valB =
          b.status === 'Active'
            ? (pb - b.entryPrice) * b.positionSize
            : (b.exitPrice! - b.entryPrice) * b.positionSize;
      } else if (sortKey === 'pnlPercent') {
        const pa = markPriceForTrade(a, livePriceBySymbol);
        const pb = markPriceForTrade(b, livePriceBySymbol);
        valA =
          a.status === 'Active'
            ? (pa - a.entryPrice) / a.entryPrice
            : (a.exitPrice! - a.entryPrice) / a.entryPrice;
        valB =
          b.status === 'Active'
            ? (pb - b.entryPrice) / b.entryPrice
            : (b.exitPrice! - b.entryPrice) / b.entryPrice;
      }
      return sortDir === 'asc' ? valA - valB : valB - valA;
    });
    return result;
  }, [filteredTrades, sortKey, sortDir, livePriceBySymbol]);

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

  const handleKanbanUpdateType = useCallback(
    async (tradeId: string, typeName: string) => {
      await updateTrade(tradeId, { type: typeName });
    },
    [updateTrade],
  );

  const handleKanbanAddColumn = useCallback(
    async (config: (typeof settings.tradeTypes)[number]) => {
      await updateSettings({ tradeTypes: [...(settings.tradeTypes || []), config] });
    },
    [settings.tradeTypes, updateSettings],
  );

  if (isLoading) return <div className="flex items-center justify-center h-64">Loading...</div>;

  return (
    <div className="space-y-8">
      {/* Networth Overview & Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {/* Total Networth Card (Amber) */}
        <div className="relative overflow-hidden p-6 rounded-[24px] bg-linear-to-br from-[#1c140a] to-[#0a0a0c] border border-amber-500/20 shadow-lg shadow-amber-900/10 flex flex-col justify-center gap-1 md:col-span-1 group transition-all hover:border-amber-500/40">
          <div className="absolute -right-4 -top-4 text-amber-500/5 transition-transform duration-700 group-hover:scale-110 group-hover:rotate-12 pointer-events-none">
            <Activity size={140} strokeWidth={1} />
          </div>
          <div className="relative z-10 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-amber-500/80 mb-2">
            <div className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></div> Total Networth
          </div>
          <div className="relative z-10 text-4xl font-black text-white tracking-tight drop-shadow-md">
            ₹{(
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
          <div className="relative z-10 text-[10px] text-amber-500/50 mt-1 font-semibold tracking-wider">
            ASSETS + TRADES − MARGIN
          </div>
        </div>

        {/* Active Trades Card (Blue) */}
        <div className="relative overflow-hidden p-6 rounded-[24px] bg-linear-to-br from-[#0c1624] to-[#0a0a0c] border border-blue-500/20 shadow-lg shadow-blue-900/10 flex items-center gap-5 group transition-all hover:border-blue-500/40">
          <div className="relative z-10 w-14 h-14 rounded-2xl bg-blue-500/10 flex items-center justify-center text-blue-400 border border-blue-500/20 shadow-inner shadow-blue-500/10">
            <Activity size={24} strokeWidth={2.5} />
          </div>
          <div className="relative z-10">
            <div className="text-[10px] font-black text-blue-400/70 uppercase tracking-widest mb-1">Active Positions</div>
            <div className="text-3xl font-black text-white">{stats.active}</div>
          </div>
          <div className="absolute right-[-5%] top-1/2 -translate-y-1/2 text-blue-500/5 transition-transform duration-700 group-hover:-translate-x-2 pointer-events-none">
            <Activity size={100} strokeWidth={1} />
          </div>
        </div>
        
        {/* Win Rate Card (Green) */}
        <div className="relative overflow-hidden p-6 rounded-[24px] bg-linear-to-br from-[#0a1c12] to-[#0a0a0c] border border-emerald-500/20 shadow-lg shadow-emerald-900/10 flex items-center gap-5 group transition-all hover:border-emerald-500/40">
          <div className="relative z-10 w-14 h-14 rounded-2xl bg-emerald-500/10 flex items-center justify-center text-emerald-400 border border-emerald-500/20 shadow-inner shadow-emerald-500/10">
            <TrendingUp size={24} strokeWidth={2.5} />
          </div>
          <div className="relative z-10">
            <div className="text-[10px] font-black text-emerald-400/70 uppercase tracking-widest mb-1">Historical Win Rate</div>
            <div className="text-3xl font-black text-white">{stats.winRate.toFixed(1)}%</div>
          </div>
          <div className="absolute right-[-5%] top-1/2 -translate-y-1/2 text-emerald-500/5 transition-transform duration-700 group-hover:-translate-x-2 pointer-events-none">
            <TrendingUp size={100} strokeWidth={1} />
          </div>
        </div>
        
        {/* Total Logs Card (Purple) */}
        <div className="relative overflow-hidden p-6 rounded-[24px] bg-linear-to-br from-[#1b0d23] to-[#0a0a0c] border border-purple-500/20 shadow-lg shadow-purple-900/10 flex items-center gap-5 group transition-all hover:border-purple-500/40">
          <div className="relative z-10 w-14 h-14 rounded-2xl bg-purple-500/10 flex items-center justify-center text-violet-400 border border-purple-500/20 shadow-inner shadow-purple-500/10">
            <TrendingDown size={24} strokeWidth={2.5} />
          </div>
          <div className="relative z-10">
            <div className="text-[10px] font-black text-violet-400/70 uppercase tracking-widest mb-1">Total Monitored</div>
            <div className="text-3xl font-black text-white">{stats.total}</div>
          </div>
          <div className="absolute right-[-5%] top-1/2 -translate-y-1/2 text-purple-500/5 transition-transform duration-700 group-hover:-translate-x-2 pointer-events-none">
            <TrendingDown size={100} strokeWidth={1} />
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
        <div className="relative overflow-hidden p-6 rounded-[24px] bg-linear-to-b from-[#06141c] to-[#0a0a0c] border border-cyan-500/10 shadow-lg shadow-cyan-900/5">
          <div className="absolute top-0 inset-x-0 h-px bg-linear-to-r from-transparent via-cyan-500/20 to-transparent"></div>
          <div className="relative z-10 flex items-center justify-between gap-3 mb-6">
            <h2 className="text-sm font-black text-cyan-400 uppercase tracking-widest flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-cyan-400 shadow-[0_0_10px_rgba(34,211,238,0.8)]"></div>
              Capital Allocation Heatmap
            </h2>
            <button
              type="button"
              onClick={() => setTradeTypeFilter('All')}
              className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border transition-all ${
                tradeTypeFilter === 'All'
                  ? 'bg-cyan-500/20 border-cyan-400/40 text-cyan-300 shadow-[0_0_15px_rgba(34,211,238,0.2)]'
                  : 'bg-[#121215] border-white/5 text-gray-500 hover:text-gray-300 hover:bg-white/5'
              }`}
            >
              Show All
            </button>
          </div>
          <div className="relative z-10 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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
                  className={`text-left p-5 rounded-[20px] transition-all group relative overflow-hidden ${
                    isActive
                      ? 'bg-cyan-500/10 border border-cyan-400/40 shadow-[0_0_20px_rgba(34,211,238,0.1)]'
                      : 'bg-[#121215]/80 border border-white/5 hover:border-cyan-500/20 hover:bg-[#161d26]'
                  }`}
                >
                  <div className="text-xs font-black uppercase tracking-wider text-cyan-200 truncate group-hover:text-cyan-300 transition-colors">
                    {row.type}
                  </div>
                  <div className="mt-3 text-lg font-black text-white">
                    ₹{row.allocation.toLocaleString(undefined, {
                      minimumFractionDigits: 0,
                      maximumFractionDigits: 0,
                    })}
                  </div>
                  <div className="flex items-center justify-between text-[11px] font-bold mt-2">
                    <span className="text-gray-400">{row.stocks} stocks</span>
                    <span className="text-cyan-400/80 bg-cyan-500/10 px-2 py-0.5 rounded-md">{allocationPct.toFixed(1)}% overall</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {stats.stocksInvested > 0 && (
        <div className="relative overflow-hidden p-6 rounded-[24px] bg-linear-to-b from-[#0a121f] to-[#0a0a0c] border border-sky-500/10 shadow-lg shadow-sky-900/5">
          <div className="absolute top-0 inset-x-0 h-px bg-linear-to-r from-transparent via-sky-500/20 to-transparent"></div>
          <h2 className="relative z-10 text-sm font-black text-sky-400 uppercase tracking-widest mb-5 flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-sky-400 shadow-[0_0_10px_rgba(56,189,248,0.8)]"></div>
            Portfolio Capital Utilization
          </h2>
          <div className="relative z-10 grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-4 rounded-[20px] bg-[#121215]/80 border border-white/5 backdrop-blur-md">
              <div className="text-[10px] text-gray-500 font-bold uppercase mb-1">Gross Invested</div>
              <div className="text-xl font-black text-white">₹{stats.stocksInvested.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</div>
            </div>
            <div className="p-4 rounded-[20px] bg-[#121215]/80 border border-white/5 backdrop-blur-md">
              <div className="text-[10px] text-gray-500 font-bold uppercase mb-1">Present Market Value</div>
              <div className="text-xl font-black text-white">₹{stats.stocksPresent.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</div>
            </div>
            <div className={`p-4 rounded-[20px] bg-[#121215]/80 border ${stats.stocksUnrealized >= 0 ? 'border-emerald-500/20' : 'border-rose-500/20'} backdrop-blur-md`}>
              <div className={`text-[10px] font-bold uppercase mb-1 ${stats.stocksUnrealized >= 0 ? 'text-emerald-500/70' : 'text-rose-500/70'}`}>Unrealized P&L</div>
              <div className={`text-xl font-black ${stats.stocksUnrealized >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {stats.stocksUnrealized >= 0 ? '+' : ''}₹{stats.stocksUnrealized.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
              </div>
            </div>
            <div className={`p-4 rounded-[20px] bg-[#121215]/80 border ${stats.stocksUnrealized >= 0 ? 'border-emerald-500/20' : 'border-rose-500/20'} backdrop-blur-md`}>
              <div className={`text-[10px] font-bold uppercase mb-1 ${stats.stocksUnrealized >= 0 ? 'text-emerald-500/70' : 'text-rose-500/70'}`}>
                Net ROI (Ex-Margin)
              </div>
              <div className={`text-xl font-black ${stats.stocksUnrealized >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {stats.stocksUnrealized >= 0 ? '+' : ''}{stats.stocksUnrealizedPct.toFixed(2)}%
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Filter / Control Bar (Glassmorphism) */}
      <div className="sticky top-2 z-20 flex flex-col xl:flex-row gap-4 items-center justify-between p-3 rounded-[24px] bg-[#0c0c0e]/80 backdrop-blur-2xl border border-white/10 shadow-2xl shadow-black/80">
        <div className="w-full md:w-auto flex flex-col md:flex-row gap-3 items-center">
          <div className="relative w-full md:w-80 shrink-0">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
            <input
              type="text"
              placeholder="Search ticker symbol..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-[#161618]/80 hover:bg-[#1a1a1d] border border-white/5 rounded-[16px] pl-11 pr-4 py-2.5 text-sm font-medium focus:outline-none focus:border-blue-500/40 focus:ring-1 focus:ring-blue-500/40 transition-all placeholder:text-gray-600"
            />
          </div>
          <div className="flex flex-wrap items-center gap-1.5 p-1.5 bg-[#121214] border border-white/5 rounded-[20px] shadow-inner shadow-black/50 overflow-x-auto w-full md:w-auto no-scrollbar">
            {tradeTypeOptions.map((typeOption) => (
              <button
                key={typeOption}
                type="button"
                onClick={() => setTradeTypeFilter(typeOption)}
                className={`shrink-0 px-4 py-1.5 rounded-[14px] text-[11px] font-black uppercase tracking-wider transition-all duration-300 ${
                  tradeTypeFilter === typeOption
                    ? 'bg-blue-600 text-white shadow-[0_0_15px_rgba(37,99,235,0.4)] border border-blue-500/50'
                    : 'text-gray-500 hover:text-gray-300 hover:bg-white/5 border border-transparent'
                }`}
              >
                {typeOption}
              </button>
            ))}
          </div>
        </div>
        
        <div className="flex flex-wrap items-center justify-end gap-3 shrink-0">
          <div
            className="flex items-center gap-1 rounded-[20px] border border-white/5 bg-[#121214] p-1.5 shadow-inner shadow-black/50"
            role="group"
            aria-label="Portfolio view"
          >
            {(
              [
                { id: 'both' as const, label: 'Both', Icon: Columns2 },
                { id: 'board' as const, label: 'Board', Icon: LayoutGrid },
                { id: 'table' as const, label: 'Table', Icon: List },
              ] as const
            ).map(({ id, label, Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => setPortfolioLayout(id)}
                className={`flex items-center gap-1.5 rounded-[14px] px-3 py-1.5 text-[11px] font-black uppercase tracking-wider transition-all duration-300 ${
                  portfolioLayout === id
                    ? 'bg-violet-600 text-white shadow-[0_0_15px_rgba(124,58,237,0.4)] border border-violet-500/50'
                    : 'text-gray-500 hover:bg-white/5 hover:text-gray-300 border border-transparent'
                }`}
              >
                <Icon size={14} className="shrink-0 opacity-90" aria-hidden />
                <span>{label}</span>
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1 rounded-[20px] border border-white/5 bg-[#121214] p-1.5 shadow-inner shadow-black/50">
            {(['All', 'Active', 'Closed'] as const).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFilter(f)}
                className={`px-4 py-1.5 rounded-[14px] text-[11px] font-black uppercase tracking-wider transition-all duration-300 ${
                  filter === f 
                    ? 'bg-emerald-600 text-white shadow-[0_0_15px_rgba(5,150,105,0.4)] border border-emerald-500/50' 
                    : 'text-gray-500 hover:text-gray-300 hover:bg-white/5 border border-transparent'
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>
      </div>

      {filteredTrades.length === 0 && kanbanDisplayTrades.length === 0 ? (
        <div className="rounded-3xl border border-white/5 bg-[#161618] py-16 text-center">
          <div className="mb-2 text-gray-600">No trades found matching your criteria.</div>
          <Link href="/entry" className="font-bold text-blue-400 hover:underline">
            Log your first trade
          </Link>
        </div>
      ) : (
        <div className="space-y-10">
          {portfolioLayout !== 'table' ? (
            <div className="rounded-3xl border border-white/5 bg-[#161618] p-4 sm:p-5">
              <PortfolioKanbanBoard
                trades={kanbanDisplayTrades}
                tradeTypes={settings.tradeTypes ?? []}
                livePriceBySymbol={livePriceBySymbol}
                onUpdateTradeType={handleKanbanUpdateType}
                onAddTradeType={handleKanbanAddColumn}
                onCardClick={(t) => setSelectedTradeId(t.id)}
                onSymbolClick={(t) => setChartSymbol(toTradingViewSymbol(t.symbol))}
              />
            </div>
          ) : null}

          {portfolioLayout !== 'board' ? (
          <div>
            <h2 className="mb-4 text-sm font-bold uppercase tracking-widest text-gray-500">
              Sortable list
            </h2>
            <div className="hidden lg:grid grid-cols-7 gap-4 px-6 py-3 text-[10px] font-bold text-gray-500 uppercase tracking-widest border-b border-white/5 mx-2">
              <div
                className="col-span-2 cursor-pointer hover:text-white transition-colors"
                onClick={() => handleSort('date')}
              >
                Symbol & Date {sortKey === 'date' && (sortDir === 'asc' ? '↑' : '↓')}
              </div>
              <div
                className="cursor-pointer hover:text-white transition-colors"
                onClick={() => handleSort('invested')}
              >
                Invested {sortKey === 'invested' && (sortDir === 'asc' ? '↑' : '↓')}
              </div>
              <div>Current Price</div>
              <div
                className="cursor-pointer hover:text-white transition-colors"
                onClick={() => handleSort('pnlValue')}
              >
                P&L Value {sortKey === 'pnlValue' && (sortDir === 'asc' ? '↑' : '↓')}
              </div>
              <div
                className="cursor-pointer hover:text-white transition-colors"
                onClick={() => handleSort('pnlPercent')}
              >
                P&L % {sortKey === 'pnlPercent' && (sortDir === 'asc' ? '↑' : '↓')}
              </div>
              <div className="text-right">Actions</div>
            </div>
            <div className="flex flex-col gap-2">
              <AnimatePresence mode="popLayout">
                {tableSortedTrades.map((trade) => (
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
          </div>
          ) : null}
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
