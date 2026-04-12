'use client';

import { memo, useEffect, useRef } from 'react';
import { tradingViewSymbolPageSlug } from '@/lib/tradingview-symbol';

type Props = {
  symbol: string;
  className?: string;
};

function buildConfig(symbol: string) {
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
    symbol,
    theme: 'dark',
    timezone: 'Etc/UTC',
    backgroundColor: '#0F0F0F',
    gridColor: 'rgba(242, 242, 242, 0.06)',
    watchlist: [] as string[],
    withdateranges: false,
    compareSymbols: [] as string[],
    studies: [] as string[],
    autosize: true,
  };
}

function TradingViewAdvancedChartWidget({ symbol, className }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const script = document.createElement('script');
    script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js';
    script.type = 'text/javascript';
    script.async = true;
    script.innerHTML = JSON.stringify(buildConfig(symbol));
    container.appendChild(script);

    return () => {
      script.remove();
      const slot = container.querySelector('.tradingview-widget-container__widget');
      slot?.replaceChildren();
    };
  }, [symbol]);

  const slug = tradingViewSymbolPageSlug(symbol);
  const label = symbol.includes(':') ? symbol.split(':')[1] : symbol;

  return (
    <div
      ref={containerRef}
      className={
        className ??
        'tradingview-widget-container flex h-full min-h-[420px] w-full flex-col'
      }
    >
      <div className="tradingview-widget-container__widget min-h-0 w-full flex-1" />
      <div className="tradingview-widget-copyright shrink-0 px-2 pt-2 text-center text-[11px] text-gray-500">
        <a
          href={`https://www.tradingview.com/symbols/${slug}/`}
          rel="noopener noreferrer nofollow"
          target="_blank"
        >
          <span className="text-blue-400 hover:text-blue-300">{label} chart</span>
        </a>
        <span className="trademark">&nbsp;by TradingView</span>
      </div>
    </div>
  );
}

export default memo(TradingViewAdvancedChartWidget);
