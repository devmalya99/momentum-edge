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
- **Market Analyzer**: AI desk mandate with dual-axis grading — daily portfolio exposure plus per-index position sizing.

### Market Analyzer (Market View)

The analyzer uses a **top-down discount model** with two independent calculations. Portfolio exposure is loaded once per IST calendar day; changing the index only re-runs the index-specific read.

**On page load:** `ensurePortfolioExposure()` checks `localStorage` for today’s macro result; on miss, fetches VIX, A/D, and Nifty 500 telemetry → `synthesizeMacroPayload` → `POST /api/market-analyzer/portfolio-exposure`.

**On Analyse Market:** Collects telemetry for the selected index → `synthesizePayload` → `POST /api/market-analyzer` (reuses cached exposure; does not recalculate it).

- **Index selection**: 70+ NSE indices in grouped dropdown — broad, sectoral, thematic, and strategy/factor indices (`index-catalog.ts`).
- **Portfolio exposure (macro, daily)**: Shown in a dedicated banner above position size — same value regardless of which index is selected.
  - Scale: 0% | 10% | 30% | 50% | 70% | 100% | 125%
  - Driven by VIX, A/D, Nifty 500 health, calendar risk, and geopolitical context only.
- **Per-index outputs** (updates when index or Analyse Market changes):
  - **Verdict**: Breakdown | Grinding | Transition | Stage 2 | Momentum | Extreme Alignment
  - **Position size**: 0% | 8% | 12% | 15% | 20% | 25%
  - **Desk rationale**: 2–3 conversational sentences on the selected index (no bullet-dump tone)
- **Token efficiency**: `CompressedPayload` (index) and `CompressedMacroPayload` (macro) built in `dataSynthesizer.ts` on the main thread.
- **Auth**: Logged-in session required; same-origin + `X-Requested-With` on both analyzer API routes.

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
