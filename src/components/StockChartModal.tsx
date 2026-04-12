'use client';

import { ExternalLink, X } from 'lucide-react';
import { motion } from 'motion/react';
import TradingViewAdvancedChartWidget from './TradingViewAdvancedChartWidget';

type Props = {
  symbol: string;
  displayName?: string;
  onClose: () => void;
};

export default function StockChartModal({ symbol, displayName, onClose }: Props) {
  const title = displayName ?? (symbol.includes(':') ? symbol.split(':')[1] : symbol);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-60 flex items-center justify-center p-3 sm:p-6 bg-[#0a0a0b]/85 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.96, y: 12 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.96, y: 12 }}
        className="relative flex h-[min(88vh,820px)] w-full max-w-5xl flex-col overflow-hidden rounded-3xl border border-white/10 bg-[#161618] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-white/5 bg-[#1a1a1c] px-4 py-3 sm:px-6 sm:py-4">
          <div>
            <h2 className="text-lg font-bold tracking-tight sm:text-xl">{title}</h2>
            <p className="text-[11px] text-gray-500 sm:text-xs">{symbol}</p>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => {
                const path = `/stock-charts?symbol=${encodeURIComponent(symbol)}`;
                window.open(path, '_blank', 'noopener,noreferrer');
              }}
              className="rounded-xl p-2.5 text-gray-400 transition-colors hover:bg-white/5 hover:text-blue-400"
              aria-label="Open holdings workspace with all charts in a new tab"
              title="All holdings & charts"
            >
              <ExternalLink size={20} />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl p-2.5 text-gray-400 transition-colors hover:bg-white/5 hover:text-white"
              aria-label="Close chart"
            >
              <X size={22} />
            </button>
          </div>
        </div>
        <div className="min-h-0 flex-1 bg-[#0f0f0f] p-2 sm:p-4">
          <TradingViewAdvancedChartWidget key={symbol} symbol={symbol} />
        </div>
      </motion.div>
    </motion.div>
  );
}
