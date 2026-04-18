'use client';

import { memo, useEffect, useRef } from 'react';
import { tradingViewSymbolPageSlug } from '@/lib/tradingview-symbol';

type Props = {
  /** TradingView symbol, e.g. `BSE:RELIANCE`, `NSE:NIFTY` */
  symbol: string;
  className?: string;
};

const SCRIPT_SRC = 'https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js';

function buildConfig(tvSymbol: string) {
  return {
    allow_symbol_change: true,
    calendar: false,
    details: false,
    hide_side_toolbar: false,
    hide_top_toolbar: false,
    hide_legend: false,
    hide_volume: false,
    hotlist: false,
    interval: 'D',
    locale: 'en',
    save_image: true,
    style: '1',
    symbol: tvSymbol,
    theme: 'dark',
    timezone: 'Etc/UTC',
    backgroundColor: '#0F0F0F',
    gridColor: 'rgba(242, 242, 242, 0.06)',
    watchlist: [],
    withdateranges: true,
    compareSymbols: [],
    studies: [],
    autosize: true,
  };
}

function TradingViewAdvancedChartWidget({ symbol, className }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const tv = symbol.trim();

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !tv) return;

    const slot = container.querySelector<HTMLDivElement>('.tradingview-widget-container__widget');
    if (!slot) return;

    slot.replaceChildren();
    container.querySelectorAll('script[data-tv-advanced]').forEach((el) => el.remove());

    const script = document.createElement('script');
    script.type = 'text/javascript';
    script.src = SCRIPT_SRC;
    script.async = true;
    script.dataset.tvAdvanced = '1';
    script.innerHTML = JSON.stringify(buildConfig(tv));
    container.appendChild(script);

    return () => {
      script.remove();
      slot.replaceChildren();
    };
  }, [tv]);

  const slug = tradingViewSymbolPageSlug(tv || 'BSE:RELIANCE');
  const chartHref = `https://www.tradingview.com/symbols/${slug}/`;

  return (
    <div className={['flex h-full min-h-0 w-full min-w-0 flex-col', className].filter(Boolean).join(' ')}>
      <div
        ref={containerRef}
        className="tradingview-widget-container flex min-h-0 flex-1 flex-col bg-[#0a0a0b]"
      >
        <div className="tradingview-widget-container__widget min-h-0 flex-1 w-full" />
      </div>
      <div className="tradingview-widget-copyright shrink-0 py-2 text-center text-[10px] text-gray-500">
        <a href={chartHref} rel="noopener noreferrer nofollow" target="_blank" className="text-blue-400 hover:text-blue-300">
          Open on TradingView
        </a>
        <span className="trademark"> by TradingView</span>
      </div>
    </div>
  );
}

export default memo(TradingViewAdvancedChartWidget);
