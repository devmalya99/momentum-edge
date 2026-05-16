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
- `src/features`: Modular, feature-specific logic and UI (e.g., 52wScanner, Watchlist, `market-analyzer`).
  - `src/features/market-analyzer/query/`: React Query hook for the index score catalog (`use-index-score-catalog-query.ts`).
  - `src/features/market-analyzer/constants/`: Catalog cache TTL (`INDEX_SCORES_STALE_MS` = 24h).
  - `src/features/market-analyzer/types/`: Shared types for precalculated index scores.
- `src/components`: Reusable UI components (Modals, Cards, Charts, Layout).
- `src/store`: Global state management stores (Auth, Trades, Analytics).
- `src/hooks`: Custom React hooks for shared logic (Live prices, MTF calculations, Market Analyzer orchestration).
- `src/types`: Shared TypeScript contracts (e.g. `marketAnalyzer.ts` — payload scales and Zod schemas).
- `src/lib`: Shared utility libraries (NSE clients, formatters, database clients).
  - `src/lib/market-analyzer/`: Index catalog, A/D series builder, `collect-telemetry.ts` (index + macro, shared VIX/A/D slices for batch scoring), `prefetch-index-scores.ts` (background catalog scorer), `index-score-visual.ts` (tier colors + grouping), `portfolio-exposure-cache.ts` (IST day cache), `api-guard.ts`.
  - `src/lib/ai/market-analyzer-macro-prompt.ts`: Portfolio exposure only (index-blind Calculation B).
  - `src/lib/ai/market-analyzer-index-prompt.ts`: Verdict, position size, and desk rationale (Calculation A).
- `src/utils`: Mathematical and business logic utilities (Risk calculations, Scoring verdicts, `dataSynthesizer.ts` for token compression).
- `src/components/MarketAnalyzer/`: Presentation-only UI — `AnalysisDashboard.tsx`, `IndexScoreSelect.tsx` (position-size–grouped dropdown with color dots).
- `src/db`: Database schema definitions and adapter logic.
- `src/analytics`: Specialized logic for parsing and computing P&L metrics.

## ⚙️ Core Workflows

1. **Market Data Chain**: NSE Official Site → API Proxy → Next.js Server → Client UI (Polled/Synced).
2. **P&L Processing**: `.xlsx` Upload → Client-side Parser → IndexedDB Storage + Server Sync → Custom Analytics View.
3. **Trade Logging**: Setup Analysis → Rule Scoring → Risk Validation → Database Persistence (Prisma).
4. **Networth Balancing**: Manual Entries + Live NSE Quotes → Aggregator → Balance Sheet Logic → Total Networth display.
5. **Market Analyzer** (Market View): Three parallel tracks — **daily macro exposure** (index-blind, IST day cache), **index score catalog** (all indices, 24h React Query cache), and **per-index desk read** (verdict + position size + rationale on demand).

### Market Analyzer pipeline (detail)

```text
MarketView (orchestrator)
  On mount:
    → portfolio-exposure-cache.ts  … read localStorage (IST date key)
    → collectMacroTelemetry()      … VIX + A/D + Nifty 500 only
    → synthesizeMacroPayload()
    → POST /api/market-analyzer/portfolio-exposure
    → write cache for the day

  On AnalysisDashboard mount (index score catalog):
    → useIndexScoreCatalogQuery()  … React Query key: ['market-analyzer','index-scores-catalog']
    → readPersistedIndexScoresCatalog() … hydrate from localStorage if < 24h old
    → if complete + fresh → no Gemini calls
    → else prefetchIndexScores() … shared VIX/A/D once, then 2 concurrent index LLM calls
    → persistIndexScoresCatalog() on each progress update

  On Analyse Market (index change does NOT refetch exposure or catalog):
    → if index has fresh catalog entry → use cached verdict + sizing (no Gemini)
    → else collectMarketTelemetry(idx) → synthesizePayload(idx) → POST /api/market-analyzer

  → useMarketAnalyzer.ts           … split state: portfolioExposure | indexResult
  → AnalysisDashboard.tsx          … IndexScoreSelect + exposure banner + desk read

/api/market-analyzer/portfolio-exposure  … macro Zod in/out → equityExposure + summary
/api/market-analyzer                     … index Zod in/out → verdict + sizing + explanation
```

### Index score catalog (cost control)

| Layer | Role | TTL |
|-------|------|-----|
| React Query (`staleTime`) | In-memory; blocks refetch on navigation/remount | 24 hours |
| `index-scores-persist.ts` | `localStorage` hydration so **page refresh** does not re-run ~70 Gemini calls | 24 hours |
| `prefetch-index-scores.ts` | Batch scorer; seeds from cache, skips indices already scored | — |

**Refetch guards:** `refetchOnMount: false`, `refetchOnWindowFocus: false`, `refetchOnReconnect: false`, `retry: false`. Market View’s top refresh button does **not** invalidate the catalog. Full re-score only via explicit `refreshScores()` (not wired to global refresh).

**UI:** `IndexScoreSelect` groups indices by position size tier (25% → 0%, momentum first) with color-coded dots. Incomplete persisted catalogs stay stale until missing indices are filled.

**Design constraints:** Portfolio exposure must not vary by selected index; one macro LLM call per IST day unless cache cleared. Catalog is index-blind on sizing tiers but stores per-index `positionSizingGuidance` + `verdict`. No Web Workers; no client-side verdict scoring (LLM + prompts only). Tunable lookbacks in `constants.ts`. Index universe in `index-catalog.ts`, resolved via `index-config.ts`.

Folder planning :
when building a new feature use the feature folder

api : for connecting the backend api in a function
query : for connection the api and create the react query hook
helper: for writing addditional helper function 
ui : for organising all the related ui components together