'use client';

import { memo, useEffect, useRef } from 'react';

const SCREENER_CONFIG = `
        {
          "width": "100%",
          "height": 550,
          "defaultColumn": "overview",
          "defaultScreen": "most_capitalized",
          "market": "india",
          "showToolbar": true,
          "colorTheme": "dark",
          "locale": "en",
          "isTransparent": false
        }`;

function TradingViewScreenerWidget() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const slot = container.querySelector<HTMLDivElement>('.tradingview-widget-container__widget');
    slot?.replaceChildren();

    const script = document.createElement('script');
    script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-screener.js';
    script.type = 'text/javascript';
    script.async = true;
    script.innerHTML = SCREENER_CONFIG.trim();
    container.appendChild(script);

    return () => {
      script.remove();
      slot?.replaceChildren();
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="tradingview-widget-container w-full rounded-2xl border border-white/5 bg-[#0f0f0f] p-3 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.03)] sm:p-4"
    >
      <div
        className="tradingview-widget-container__widget w-full overflow-hidden rounded-xl"
        style={{ minHeight: 550 }}
      />
      <div className="tradingview-widget-copyright mt-3 px-2 text-center text-[11px] text-gray-500">
        <a
          href="https://in.tradingview.com/screener/"
          rel="noopener noreferrer nofollow"
          target="_blank"
        >
          <span className="text-blue-400 hover:text-blue-300">Stock Screener</span>
        </a>
        <span className="trademark">&nbsp;by TradingView</span>
      </div>
    </div>
  );
}

export default memo(TradingViewScreenerWidget);
