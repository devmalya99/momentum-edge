# Project Features Analysis

This document provides a comprehensive list of features implemented in the Momentum Edge platform, organized page by page.

## 1. Dashboard (`/dashboard`)
*The central hub for tracking active trades and overall portfolio health.*

- **Networth Overview**: Real-time display of total networth (Static Assets + Active Trades − Margin Used).
- **Global Performance Stats**: Quick glance at Active Trades count, Win Rate, and Total logs.
- **Live NSE Quotes**: Automatically fetches real-time prices for all active trades from NSE.
- **Allocation Breakdown**: Visualizes capital distribution across different trade types (e.g., Swing, Momentum).
- **Unrealized P&L Tracker**: monitor absolute and percentage gains for all active positions.
- **Interactive Trade Cards**: Expandable cards for each trade showing entry, current price, and live P&L.
- **Advanced Filtering**: Categorize trades by status (Active/Closed/All) or trade type.
- **Dynamic Sorting**: Organize trades by Date, Invested Amount, or P&L performance.

## 2. Analytics (`/analytics`)
*Deep-dive performance metrics and lifetime profit tracking.*

- **Zerodha P&L Importer**: Support for uploading and parsing Zerodha equity P&L (.xlsx) files.
- **Bank Capital Tracker**: Log lifetime cash transfers from bank to trading account.
- **True Market Profit**: Calculates actual lifetime return (`Value - Margin - Cash In`).
- **Equity Curve Visualization**: Line chart showing cumulative profit progress over time.
- **P&L Distribution Chart**: Bar chart sorting trades from largest loss to largest gain.
- **Efficiency Scoring**: Automatically calculates Profitability %, Risk Control (Large Loss tracking), and Cost Efficiency.
- **Local Persistence**: Data is stored securely in IndexedDB for privacy and speed.

## 3. Market View (`/market-view`)
*Institutional-grade market breadth and sentiment tools.*

- **Live A/D Ratio**: Real-time Advance/Decline monitoring for the entire NSE cash segment.
- **Sentiment Status**: AI-powered status updates (Strong Bullish, Bearish, etc.).
- **Trade Scoring Guidance**: Suggested trade scores (0-10) based on current market breadth.
- **FII/DII Oscillator**: Tracks Foreign Institutional Investor positioning in index futures.
- **Live Institutional Context**: Guidance on "Trap backdrops" or "Capitulation" levels based on FII data.
- **Historical Breadth**: Smoothed plotting of A/D trends across weeks and months.
- **Large Deals Panel**: Monitor significant block and bulk transactions in real-time.
- **India VIX Tracker**: Session history and volatility regime context for risk sizing.
- **NSE Index Details & Technicals**: Benchmark index panels with OHLC, EMA stack, RSI, and MACD (e.g. NIFTY 50 kline board).
- **Market Analyzer** *(new)*: AI desk mandate for allocation and exposure by index.

### Market Analyzer (Market View)

On **Analyse Market**, the page compiles telemetry, compresses it client-side, and calls a session-protected Gemini route. The dashboard is presentation-only; `MarketView` owns fetch and hook orchestration.

- **Index selection**: NIFTY 50, NIFTY 500, NIFTY METAL, NIFTY PHARMA (same NSE graph symbols; no symbol-specific client logic).
- **Inputs synthesized**: VIX (1mo, 2-day clubs), index closes (2mo, 3-day clubs), A/D ratio (1.5mo, 3-day clubs), EMA 20/50/200 % deltas from spot (1mo, 2-day clubs), current RSI/MACD, days-to-month-end, Thu/Fri weekend-risk flag.
- **Outputs**:
  - **Verdict**: Calm | Breeze | Gale | Storm | Hurricane
  - **Position size**: 0% | 8% | 12% | 15% | 20% | 25%
  - **Equity exposure** (incl. leverage ceiling): 5% | 30% | 50% | 70% | 100% | 120%
  - **Desk rationale**: Short explanation of the read
- **Token efficiency**: Short-key `CompressedPayload` built in `dataSynthesizer.ts` on the main thread before the API call.
- **Auth**: Requires logged-in session; same-origin + `X-Requested-With` checks on `POST /api/market-analyzer`.

## 4. Trade Entry (`/entry`)
*A disciplined 3-step engine for high-quality trade logging.*

- **Setup Scoring Engine**: Quantify trade quality using custom rules before entry.
- **NSE Symbol Search**: Debounced search for NSE tickers with automatic metadata fetching.
- **Risk Calculator**: Calculates position size and absolute money at risk vs stop loss.
- **Risk/Reward Planner**: Visualizes potential reward and R:R ratio based on target gain %.
- **Enforced Checklist**: Technical checks (Prior Rally, Volume, EMA Alignment) required for execution.
- **Risk Threshold Blocking**: Prevents logging trades if the risk % exceeds account settings.

## 5. Networth (`/networth`)
*Holistic wealth management and balance sheet tools.*

- **Consolidated Balance Sheet**: Integrates Manual Assets, Stocks, PPF, Liquid Funds, and Liabilities.
- **Holdings Import**: Batch import stocks from Zerodha Holdings Excel reports.
- **Margin-Adjusted Analytics**: Toggle between Gross returns and "Return on Own Capital".
- **Asset Manager**: Create and track custom asset classes (Gold, Real Estate, etc.).
- **Live Mark-to-Market**: All holdings and assets are marked to current NSE prices if applicable.

## 6. 52W High Scanner (`/52w-scanner`)
*Real-time momentum opportunity discovery.*

- **Momentum Candidate Feed**: Live list of stocks hitting 52-week highs on NSE.
- **Chart Workspace**: Side-by-side Technical analysis via embedded TradingView charts.
- **Watchlist Quick-Sync**: One-click bookmarking of scanner results for further review.

## 7. MTF Checker (`/mtf-checker`)
*Strategic simulator for Margin Trading Facility.*

- **Cost Simulator**: Interactive slider to see daily/monthly interest costs for borrowing.
- **Leverage Risk Indicator**: visual gauge of risk levels when using 2x or 3x leverage.
- **Capital Integration**: Pulls existing account values to simulate realistic borrowing limits.

## 8. Scoring Rules (`/rules`)
*Customizable strategy definition center.*

- **Define Categories**: Organize rules into Structure, Trend, Confirmation, and Context.
- **Weightage Management**: Assign max scores to different rules to tune your strategy.
- **Toggle Control**: Instantly enable or disable rules globally.

## 9. Watchlist (`/watchlist`)
*Curated space for technical breakouts.*

- **Asset Monitoring**: A focused list of bookmarked stocks.
- **Synced Charting**: Direct integration with TradingView Advanced Charting for technical set-ups.
- **Cross-App Sync**: Works seamlessly with the 52W High Scanner.
