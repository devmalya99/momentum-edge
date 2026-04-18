import React from 'react';
import { Trade } from '../db';
import { getVerdictColor, getTradeTypeColor, calculateProfitPercent } from '../utils/calculations';
import { Clock, ChevronRight } from 'lucide-react';
import { format } from 'date-fns';

interface TradeCardProps {
  trade: Trade;
  onClick: () => void;
  /** Opens chart for this symbol; click is isolated from row `onClick`. */
  onSymbolClick?: () => void;
  /** NSE live mark from dashboard quotes; overrides stored currentPrice when set. */
  livePrice?: number;
  /** Compact vertical card for Kanban columns (column already shows trade type). */
  variant?: 'default' | 'kanban';
}

export default function TradeCard({
  trade,
  onClick,
  onSymbolClick,
  livePrice,
  variant = 'default',
}: TradeCardProps) {
  const markPrice =
    trade.status === 'Active'
      ? (typeof livePrice === 'number' && livePrice > 0 ? livePrice : trade.currentPrice ?? trade.entryPrice)
      : trade.exitPrice ?? trade.entryPrice;

  const isProfit = trade.exitPrice ? trade.exitPrice > trade.entryPrice : false;
  const profitPercent = trade.exitPrice ? calculateProfitPercent(trade.entryPrice, trade.exitPrice) : 0;

  const pnlValue =
    trade.status === 'Active'
      ? (markPrice - trade.entryPrice) * trade.positionSize
      : (trade.exitPrice! - trade.entryPrice) * trade.positionSize;
  const pnlPct =
    trade.status === 'Active'
      ? ((markPrice - trade.entryPrice) / trade.entryPrice) * 100
      : profitPercent;
  const pnlPositive = trade.status === 'Active' ? markPrice - trade.entryPrice >= 0 : isProfit;

  if (variant === 'kanban') {
    return (
      <div
        draggable={false}
        role="button"
        tabIndex={0}
        onClick={onClick}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onClick();
          }
        }}
        className="group/card relative w-full cursor-pointer overflow-hidden rounded-2xl border border-white/[0.08] bg-gradient-to-b from-[#1c1c1f] to-[#141416] p-4 text-left shadow-lg shadow-black/40 ring-1 ring-inset ring-white/[0.04] transition-all duration-200 hover:border-white/15 hover:shadow-xl hover:shadow-black/50 hover:ring-white/[0.07]"
      >
        <div
          className={`pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent opacity-80`}
        />
        <div
          className={`absolute left-0 top-0 h-full w-[3px] rounded-l-2xl ${
            trade.status === 'Active' ? 'bg-gradient-to-b from-blue-400 to-blue-600' : isProfit ? 'bg-gradient-to-b from-emerald-400 to-emerald-700' : 'bg-gradient-to-b from-rose-400 to-rose-700'
          }`}
        />

        <div className="relative pl-3">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              {onSymbolClick ? (
                <button
                  type="button"
                  draggable={false}
                  onClick={(e) => {
                    e.stopPropagation();
                    onSymbolClick();
                  }}
                  className="block truncate text-left font-black tracking-tight text-white transition-colors hover:text-sky-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/50 rounded-md text-lg"
                >
                  {trade.symbol}
                </button>
              ) : (
                <h3 className="truncate text-lg font-black tracking-tight text-white">{trade.symbol}</h3>
              )}
              <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-gray-500">
                <span className="inline-flex items-center gap-1">
                  <Clock className="h-3 w-3 shrink-0 opacity-70" />
                  {format(trade.entryDate, 'MMM d, yyyy')}
                </span>
                <span className="text-gray-600">·</span>
                <span className="font-mono tabular-nums text-gray-400">{trade.positionSize} qty</span>
              </div>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1.5">
              <span
                className={`text-[9px] font-black uppercase tracking-widest ${getVerdictColor(trade.verdict)} rounded-md border px-1.5 py-0.5`}
              >
                {trade.verdict}
              </span>
              {trade.status === 'Active' ? (
                <span className="rounded-md border border-sky-500/35 bg-sky-500/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-sky-300">
                  Active
                </span>
              ) : (
                <span className="rounded-md border border-white/10 bg-white/[0.03] px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-gray-500">
                  Closed
                </span>
              )}
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2.5 rounded-xl bg-black/25 p-3 ring-1 ring-inset ring-white/[0.06]">
            <div>
              <div className="text-[9px] font-bold uppercase tracking-wider text-gray-500">Invested</div>
              <div className="mt-0.5 font-semibold tabular-nums text-gray-200">
                ₹{(trade.positionSize * trade.entryPrice).toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </div>
            </div>
            <div>
              <div className="text-[9px] font-bold uppercase tracking-wider text-gray-500">Mark</div>
              <div className="mt-0.5 font-semibold tabular-nums text-amber-300/95">
                ₹{markPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </div>
            <div>
              <div className="text-[9px] font-bold uppercase tracking-wider text-gray-500">P&L</div>
              <div className={`mt-0.5 text-sm font-bold tabular-nums ${pnlPositive ? 'text-emerald-400' : 'text-rose-400'}`}>
                ₹{pnlValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </div>
            </div>
            <div>
              <div className="text-[9px] font-bold uppercase tracking-wider text-gray-500">P&L %</div>
              <div className={`mt-0.5 text-sm font-bold tabular-nums ${pnlPositive ? 'text-emerald-400' : 'text-rose-400'}`}>
                {pnlPct.toFixed(2)}%
              </div>
            </div>
          </div>

          <div className="mt-3 flex items-center justify-between border-t border-white/[0.06] pt-2.5 text-gray-500 transition-colors group-hover/card:text-gray-400">
            <span className="text-[10px] font-medium">Open details</span>
            <ChevronRight className="h-4 w-4 opacity-60 transition-transform group-hover/card:translate-x-0.5 group-hover/card:opacity-100" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
      className="w-full cursor-pointer text-left p-4 rounded-xl bg-[#161618] border border-white/5 hover:border-white/10 hover:bg-[#1a1a1c] transition-all group relative overflow-hidden flex flex-col lg:grid lg:grid-cols-7 lg:items-center gap-4 px-6"
    >
      {/* Status Indicator */}
      <div className={`absolute top-0 left-0 w-1 h-full ${trade.status === 'Active' ? 'bg-blue-500' : isProfit ? 'bg-green-500' : 'bg-red-500'}`} />

      {/* Symbol & Date col-span-2 */}
      <div className="lg:col-span-2 flex flex-col gap-1 w-full pl-2">
        <div className="flex items-center gap-2">
          {onSymbolClick ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onSymbolClick();
              }}
              className="text-xl font-bold tracking-tight rounded-md text-left text-white hover:text-blue-400 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60"
            >
              {trade.symbol}
            </button>
          ) : (
            <h3 className="text-xl font-bold tracking-tight">{trade.symbol}</h3>
          )}
          <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full border ${getTradeTypeColor(trade.type)} truncate max-w-[100px]`}>
            {trade.type}
          </span>
        </div>
        <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 text-xs text-gray-500">
              <Clock size={12} />
              {format(trade.entryDate, 'MMM d, yyyy')}
            </div>
            <div className={`text-[10px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded border inline-block ${getVerdictColor(trade.verdict)}`}>
              {trade.verdict}
            </div>
        </div>
      </div>

      {/* Invested */}
      <div className="space-y-1">
        <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest lg:hidden">Invested</div>
        <div className="text-sm font-semibold">₹{(trade.positionSize * trade.entryPrice).toFixed(2)}</div>
      </div>

      {/* Current Price */}
      <div className="space-y-1">
        <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest lg:hidden">Current Price</div>
        <div className="text-sm font-semibold text-amber-400/90">₹{markPrice.toFixed(2)}</div>
      </div>

      {/* P&L Value */}
      <div className="space-y-1">
        <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest lg:hidden">P&L Value</div>
        {trade.status === 'Active' ? (
          <div className={`text-sm font-bold flex flex-col`}>
            <span className={(markPrice - trade.entryPrice) >= 0 ? 'text-green-400' : 'text-red-400'}>
              ₹{((markPrice - trade.entryPrice) * trade.positionSize).toFixed(2)}
            </span>
          </div>
        ) : (
          <div className={`text-sm font-bold flex flex-col`}>
             <span className={isProfit ? 'text-green-400' : 'text-red-400'}>
               ₹{((trade.exitPrice! - trade.entryPrice) * trade.positionSize).toFixed(2)}
             </span>
          </div>
        )}
      </div>

      {/* P&L % */}
      <div className="space-y-1">
        <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest lg:hidden">P&L %</div>
        {trade.status === 'Active' ? (
          <div className={`text-sm font-bold flex flex-col`}>
            <span className={(markPrice - trade.entryPrice) >= 0 ? 'text-green-400' : 'text-red-400'}>
              {(((markPrice - trade.entryPrice) / trade.entryPrice) * 100).toFixed(2)}%
            </span>
          </div>
        ) : (
          <div className={`text-sm font-bold flex flex-col`}>
             <span className={isProfit ? 'text-green-400' : 'text-red-400'}>
               {profitPercent.toFixed(2)}%
             </span>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center lg:justify-end w-full lg:text-right text-gray-600 group-hover:text-white transition-colors gap-3 lg:gap-2">
         {trade.status === 'Active' ? <div className="text-[10px] font-bold text-blue-500 border border-blue-500/30 bg-blue-500/10 px-2 py-0.5 rounded uppercase tracking-widest">Active</div> : <div className="text-[10px] font-bold text-gray-500 border border-white/10 px-2 py-0.5 rounded uppercase tracking-widest">Closed</div>}
         <ChevronRight size={18} />
      </div>
    </div>
  );
}
