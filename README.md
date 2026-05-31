<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/081aa69c-ab54-49f3-8574-48a38b51334c

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

## Documentation & Progress

For detailed information about the project, refer to these documents:

- 📖 **[Features](./features.md)**: Explore the platform page-by-page (includes Market Analyzer dual-axis grading on Market View).
- 🏗️ **[Architecture](./architecture.md)**: Deep dive into the tech stack, split analyzer APIs, daily portfolio-exposure cache, 24h index score catalog, and Stock Grade AI (shared DB cache + on-demand Gemini).
- 📋 **[Instruction & Workflow](./instruction.md)**: Technical setup and planning steps.
- 🏅 **[Accomplishments](./accomplishments.md)**: Track our project milestones and latest victories.

**Market Analyzer** (Market View): Requires `GEMINI_API_KEY` on the server. Portfolio exposure is computed once per IST day. The full index score catalog is precalculated and cached for **24 hours** (React Query + `localStorage` persist) so reloads and navigation do not re-call Gemini. Per-index desk read uses cache when fresh; otherwise one LLM call per index.

**Stock Grade** (Scanner / Watchlist): Premium AI feature that classifies a stock's business momentum into one of five labels (Exploding, Super growth, Turning around, Nothing big yet, In stress). Grades are stored in a **shared Neon DB cache for 24 hours** — any user's grade is reused for all users. Gemini runs **only when you click the Grade button**; selecting a stock only reads the DB cache silently. Grade appears inline in the chart header with a hover tooltip for the reason.
