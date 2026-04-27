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
    details: true,
    hide_side_toolbar: false,
    hide_top_toolbar: false,
    hide_legend: false,
    hide_volume: false,
    hotlist: false,
    interval: 'W',
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
    show_popup_button: true,
    popup_height: '650',
    popup_width: '1000',
    studies: ['STD;RSI', 'STD;EMA'],
    autosize: true,
  };
}

function TradingViewAdvancedChartWidget({ symbol, className }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const tv = symbol.trim();

  useEffect(() => {
    const container = containerRef.current;
    // #region agent log
    fetch('http://127.0.0.1:7877/ingest/29a348b5-a888-4abc-ba35-71baf78f947e',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'932973'},body:JSON.stringify({sessionId:'932973',runId:'initial',hypothesisId:'H9',location:'TradingViewAdvancedChartWidget.tsx:47',message:'advanced chart effect start',data:{symbol:tv,hasContainer:Boolean(container)},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    if (!container || !tv) return;

    const slot = container.querySelector<HTMLDivElement>('.tradingview-widget-container__widget');
    // #region agent log
    fetch('http://127.0.0.1:7877/ingest/29a348b5-a888-4abc-ba35-71baf78f947e',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'932973'},body:JSON.stringify({sessionId:'932973',runId:'initial',hypothesisId:'H9',location:'TradingViewAdvancedChartWidget.tsx:52',message:'advanced chart slot lookup',data:{symbol:tv,hasSlot:Boolean(slot),containerClass:container.className},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
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
    // #region agent log
    fetch('http://127.0.0.1:7877/ingest/29a348b5-a888-4abc-ba35-71baf78f947e',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'932973'},body:JSON.stringify({sessionId:'932973',runId:'initial',hypothesisId:'H9',location:'TradingViewAdvancedChartWidget.tsx:65',message:'advanced chart script appended',data:{symbol:tv,scriptSrc:SCRIPT_SRC,childrenCount:container.childElementCount},timestamp:Date.now()})}).catch(()=>{});
    // #endregion

    return () => {
      // #region agent log
      fetch('http://127.0.0.1:7877/ingest/29a348b5-a888-4abc-ba35-71baf78f947e',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'932973'},body:JSON.stringify({sessionId:'932973',runId:'initial',hypothesisId:'H9',location:'TradingViewAdvancedChartWidget.tsx:69',message:'advanced chart cleanup',data:{symbol:tv},timestamp:Date.now()})}).catch(()=>{});
      // #endregion
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
    
    </div>
  );
}

export default memo(TradingViewAdvancedChartWidget);
