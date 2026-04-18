# Instructions & Workflow

## Tech Stack
- **Frontend**: React (v19), Vite, TailwindCSS (v4), Framer Motion, Zustand
- **Backend/API Integration**: Express, Google GenAI SDK (`@google/genai`)
- **Language**: TypeScript

## Project Planning & Step-By-Step Workflow

### ✅ Step 1: Initial Setup
- Installed core client/server dependencies.
- Configured foundational tracking files (`accomplishments.md`, `instruction.md`).

### ✅ Step 2: Env Configuration, DB, & Trade Settings
- Rename `.env.example` to `.env.local` and initialized Dev Server.
- Configured Risk rules blocking trade entries via max risk % parameters.
- Built-out generic `TradeTypes` & `NetworthAssets` allowing custom entries per user.

### ✅ Step 3: Layout & Advanced UI
- Created dedicated Networth Tab within sidebar.
- Added `xlsx` processor to deserialize Zerodha Equity Holdings reports directly into the database.
- Implemented rich hover-tooltips for Trade Context during form data entry.

### ✅ Step 5: Documentation & System Mapping
- Performed a full project audit to map all features page-by-page.
- Created `features.md` to serve as a user and developer functionality guide.
- Developed `architecture.md` detailing the technical stack and folder structure.
- Updated `accomplishments.md` and `README.md` to reflect the current high-performance state of the app.

### ✅ Step 6: Bug Fixing & UI Stability
- **Fixed Kanban Drop Bug**: Resolved issue where trades couldn't be dropped into different columns in `PortfolioKanbanBoard`.
- **Refined Event Bubbling**: Corrected `onDragOver` and `onDrop` propagation to ensure consistent state updates.
