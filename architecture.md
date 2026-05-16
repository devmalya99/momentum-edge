# Project Architecture

This document outlines the technical architecture, technology stack, and directory structure of the Momentum Edge platform.

## 🚀 Technology Stack

- **Framework**: [Next.js](https://nextjs.org/) (App Router)
- **Language**: [TypeScript](https://www.typescriptlang.org/)
- **UI & Styling**:
  - **TailwindCSS (v4)**: High-performance utility-first styling.
  - **Framer Motion**: Premium micro-animations and page transitions.
  - **Lucide React**: Minimalist iconography.
  - **Shadcn/UI**: High-quality UI components.
- **State Management**:
  - **Zustand**: Lightweight, scalable global state management.
  - **React Query (TanStack)**: Server state management, caching, and background synchronization.
- **Charts & Data**:
  - **TradingView Widgets**: Lightweight and Advanced chart integrations.
  - **Recharts**: Custom internal data visualizations (Equity curves, A/D plots).
- **Backend & API**:
  - **Next.js API Routes**: Serverless execution for NSE data fetching and DB operations.
  - **Google Gemini API**: AI-powered market context and sentiment analysis.
- **Database & Persistence**:
  - **Prisma**: Type-safe ORM for server-side persistence (PostgreSQL).
  - **IndexedDB**: Local client-side storage for P&L imports and performance caching.
  - **Zustand Persistence**: Local browser storage for UI settings and active session state.

## 📂 Directory Structure

- `src/app`: Primary Next.js App Router directory.
  - `(app)`: Protected application routes (Dashboard, Analytics, etc.).
  - `(auth)`: Authentication routes (Login, Signup).
  - `api`: Server-side API endpoints (NSE data, settings, database sync).
- `src/views`: Page-specific components containing core UI logic for each route.
- `src/features`: Modular, feature-specific logic and UI (e.g., 52wScanner, Watchlist).
- `src/components`: Reusable UI components (Modals, Cards, Charts, Layout).
- `src/store`: Global state management stores (Auth, Trades, Analytics).
- `src/hooks`: Custom React hooks for shared logic (Live prices, MTF calculations, Market Analyzer orchestration).
- `src/types`: Shared TypeScript contracts (e.g. `marketAnalyzer.ts` — payload scales and Zod schemas).
- `src/lib`: Shared utility libraries (NSE clients, formatters, database clients).
  - `src/lib/market-analyzer/`: Market Analyzer support — tunable constants, index symbol map, A/D series builder, telemetry collection.
  - `src/lib/ai/market-analyzer-prompt.ts`: Gemini system prompt for desk-style market reads.
- `src/utils`: Mathematical and business logic utilities (Risk calculations, Scoring verdicts, `dataSynthesizer.ts` for token compression).
- `src/components/MarketAnalyzer/`: Presentation-only UI for analyzer results (`AnalysisDashboard.tsx`).
- `src/db`: Database schema definitions and adapter logic.
- `src/analytics`: Specialized logic for parsing and computing P&L metrics.

## ⚙️ Core Workflows

1. **Market Data Chain**: NSE Official Site → API Proxy → Next.js Server → Client UI (Polled/Synced).
2. **P&L Processing**: `.xlsx` Upload → Client-side Parser → IndexedDB Storage + Server Sync → Custom Analytics View.
3. **Trade Logging**: Setup Analysis → Rule Scoring → Risk Validation → Database Persistence (Prisma).
4. **Networth Balancing**: Manual Entries + Live NSE Quotes → Aggregator → Balance Sheet Logic → Total Networth display.
5. **Market Analyzer** (Market View): User selects index → `collectMarketTelemetry` (VIX, index OHLC/EMAs, A/D, RSI/MACD) → `dataSynthesizer.synthesizePayload` (main-thread clubbing & EMA deltas) → `POST /api/market-analyzer` (session + same-origin) → Gemini → verdict, position size %, equity exposure %, and desk explanation rendered in `AnalysisDashboard`.

### Market Analyzer pipeline (detail)

```text
MarketView (orchestrator)
  → collect-telemetry.ts     … parallel NSE / Neon fetches
  → build-ad-ratio-series.ts … isolated A/D merge (chart code untouched)
  → dataSynthesizer.ts      … clubDays, EMA % deltas, calendar flags
  → useMarketAnalyzer.ts     … POST + result state
  → AnalysisDashboard.tsx    … props-only UI

/api/market-analyzer         … Zod in/out, Gemini flash-lite, JSON-only response
```

**Design constraints:** No Web Workers; no per-index client scoring (LLM + prompt only); tunable lookbacks in `src/lib/market-analyzer/constants.ts`. Supported indices: NIFTY 50, NIFTY 500, NIFTY METAL, NIFTY PHARMA (uniform symbol map in `index-config.ts`).

Folder planning :
when building a new feature use the feature folder

api : for connecting the backend api in a function
query : for connection the api and create the react query hook
helper: for writing addditional helper function 
ui : for organising all the related ui components together