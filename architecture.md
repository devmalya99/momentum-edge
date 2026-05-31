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
  - `api`: Server-side API endpoints (NSE data, settings, database sync, AI routes).
    - `api/ai/stock-grade`: POST — shared DB cache read/write; Gemini on miss only.
- `src/views`: Page-specific components containing core UI logic for each route.
- `src/features`: Modular, feature-specific logic and UI (e.g., 52wScanner, Watchlist, `market-analyzer`).
  - `src/features/market-analyzer/query/`: React Query hook for the index score catalog (`use-index-score-catalog-query.ts`).
  - `src/features/market-analyzer/constants/`: Catalog cache TTL (`INDEX_SCORES_STALE_MS` = 24h).
  - `src/features/market-analyzer/types/`: Shared types for precalculated index scores.
  - `src/features/ai/useStockGradeQuery.ts`: `useStockGrade` hook — DB hydrate on ticker change, Gemini only on Grade button click.
  - `src/features/scanner/StockGradeInline.tsx`: Inline grade badge in chart header (with reason tooltip).
- `src/components`: Reusable UI components (Modals, Cards, Charts, Layout).
- `src/store`: Global state management stores (Auth, Trades, Analytics).
- `src/hooks`: Custom React hooks for shared logic (Live prices, MTF calculations, Market Analyzer orchestration).
- `src/types`: Shared TypeScript contracts (e.g. `marketAnalyzer.ts` — payload scales and Zod schemas).
- `src/lib`: Shared utility libraries (NSE clients, formatters, database clients).
  - `src/lib/market-analyzer/`: Index catalog, A/D series builder, `collect-telemetry.ts` (index + macro, shared VIX/A/D slices for batch scoring), `prefetch-index-scores.ts` (background catalog scorer), `index-score-visual.ts` (tier colors + grouping), `portfolio-exposure-cache.ts` (IST day cache), `api-guard.ts`.
  - `src/lib/ai/stock-grade.ts`: Zod schemas, grade labels, compact prompts.
  - `src/lib/ai/stock-grade-generator.ts`: Vercel AI SDK `generateText` + Google Search grounding.
  - `src/lib/ai/stock-grade-client.ts`: Client fetch helpers (`fetchStockGrade`, `fetchStockGradeCacheOnly`).
  - `src/lib/ai/google-model.ts`: Shared Gemini provider; `stockGradeModel()` with `extractJsonMiddleware`.
  - `src/lib/db/ai-stock-grade-cache.ts`: Shared Neon cache table (`ai_stock_grade_cache`, 24h TTL).
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
6. **Stock Grade** (Scanner / Watchlist): On-demand AI momentum classification per equity — shared 24h DB cache, Gemini only on explicit Grade button click.

### Stock Grade pipeline (Scanner & Watchlist)

```text
User selects stock
  → useStockGrade() hydrates from DB only (cacheOnly: true) — no Gemini
  → if ai_stock_grade_cache hit → show grade inline in chart header

User clicks Grade (premium)
  → POST /api/ai/stock-grade (refresh: false)
  → DB fresh hit? → return instantly (all users share same grade)
  → DB miss/stale? → generateText (Gemini 2.5 Flash + Google Search) → upsert DB → show grade

Chart header (StockGradeInline)
  → BSE:NSE symbol + color-coded badge: Grade: <label>
  → hover tooltip shows 1-sentence reason
```

**Grade labels:** Exploding | Super growth | Turning around | Nothing big yet | In stress

| Layer | Role | TTL |
|-------|------|-----|
| `ai_stock_grade_cache` (Neon) | Shared source of truth across all users | 24 hours |
| React Query (`staleTime`) | In-memory per ticker; blocks duplicate client fetches | 24 hours |
| `cacheOnly` API flag | Read DB only — never calls Gemini (used on ticker change) | — |

**Cost controls:** `enabled: false` on React Query (no auto-fetch on mount); Gemini runs only when user clicks Grade and DB cache is miss/stale. Compact system + user prompts; `stopWhen: stepCountIs(3)`; `temperature: 0.1`. Uses Vercel AI SDK (`generateText`) with `google.tools.googleSearch({})` — not raw `@google/genai`.

**Auth:** Premium membership required; session cookie + same-origin + `X-Requested-With` via `api-guard.ts`.

**UI surfaces:** `Scanner52wWorkspace` (Todays Special) and `WatchlistWorkspace` — violet **Grade** button beside Business Analysis.

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