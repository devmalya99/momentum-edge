'use client';

import { memo, useEffect, useRef } from 'react';

const WIDGET_SCRIPT_INNER = `
        {
          "lineWidth": 2,
          "lineType": 0,
          "chartType": "area",
          "fontColor": "rgb(106, 109, 120)",
          "gridLineColor": "rgba(242, 242, 242, 0.06)",
          "volumeUpColor": "rgba(34, 171, 148, 0.5)",
          "volumeDownColor": "rgba(247, 82, 95, 0.5)",
          "backgroundColor": "#0F0F0F",
          "widgetFontColor": "#DBDBDB",
          "upColor": "#22ab94",
          "downColor": "#f7525f",
          "borderUpColor": "#22ab94",
          "borderDownColor": "#f7525f",
          "wickUpColor": "#22ab94",
          "wickDownColor": "#f7525f",
          "colorTheme": "dark",
          "isTransparent": false,
          "locale": "en",
          "chartOnly": false,
          "scalePosition": "right",
          "scaleMode": "Normal",
          "fontFamily": "-apple-system, BlinkMacSystemFont, Trebuchet MS, Roboto, Ubuntu, sans-serif",
          "valuesTracking": "1",
          "changeMode": "price-and-percent",
          "symbols": [
            [
              "INDEX:SENSEX|1D"
            ]
          ],
          "dateRanges": [
            "1d|1",
            "1m|30",
            "3m|60",
            "12m|1D",
            "60m|1W",
            "all|1M"
          ],
          "fontSize": "10",
          "headerFontSize": "medium",
          "autosize": false,
          "width": "100%",
          "height": "620",
          "noTimeScale": false,
          "hideDateRanges": false,
          "hideMarketStatus": false,
          "hideSymbolLogo": false
        }`;

function TradingViewWidget() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const script = document.createElement('script');
    script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-symbol-overview.js';
    script.type = 'text/javascript';
    script.async = true;
    script.innerHTML = WIDGET_SCRIPT_INNER.trim();
    container.appendChild(script);

    return () => {
      script.remove();
      const slot = container.querySelector('.tradingview-widget-container__widget');
      slot?.replaceChildren();
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="tradingview-widget-container w-full rounded-2xl border border-white/5 bg-[#0f0f0f] p-3 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.03)] sm:p-4"
    >
      <div
        className="tradingview-widget-container__widget w-full"
        style={{ height: 320, minHeight: 280 }}
      />
      <div className="tradingview-widget-copyright mt-3 px-2 text-center text-[11px] text-gray-500">
        <a
          href="https://www.tradingview.com/symbols/INDEX-SENSEX/"
          rel="noopener noreferrer nofollow"
          target="_blank"
        >
          <span className="text-blue-400 hover:text-blue-300">SENSEX quote</span>
        </a>
        <span className="trademark">&nbsp;by TradingView</span>
      </div>
    </div>
  );
}

export default memo(TradingViewWidget);
