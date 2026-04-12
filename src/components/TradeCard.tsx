import React from 'react';
import { Trade } from '../db';
import { getVerdictColor, getTradeTypeColor, calculateProfitPercent } from '../utils/calculations';
import { TrendingUp, TrendingDown, Clock, ChevronRight, Target } from 'lucide-react';
import { format } from 'date-fns';

interface TradeCardProps {
  trade: Trade;
  onClick: () => void;
  /** Opens chart for this symbol; click is isolated from row `onClick`. */
  onSymbolClick?: () => void;
  /** NSE live mark from dashboard quotes; overrides stored currentPrice when set. */
  livePrice?: number;
}

export default function TradeCard({ trade, onClick, onSymbolClick, livePrice }: TradeCardProps) {
  const markPrice =
    trade.status === 'Active'
      ? (typeof livePrice === 'number' && livePrice > 0 ? livePrice : trade.currentPrice ?? trade.entryPrice)
      : trade.exitPrice ?? trade.entryPrice;

  const isProfit = trade.exitPrice ? trade.exitPrice > trade.entryPrice : false;
  const profitPercent = trade.exitPrice ? calculateProfitPercent(trade.entryPrice, trade.exitPrice) : 0;

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

function CheckCircle2({ size, className }: { size?: number, className?: string }) {
  return (
    <svg 
      xmlns="http://www.w3.org/2000/svg" 
      width={size || 24} 
      height={size || 24} 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="3" 
      strokeLinecap="round" 
      strokeLinejoin="round" 
      className={className}
    >
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}
