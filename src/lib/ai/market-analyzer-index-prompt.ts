import type { CompressedPayload } from '@/types/marketAnalyzer';

/** Per-index verdict, position size, and desk rationale (no portfolio exposure). */
export function buildIndexAnalyzerPrompt(payload: CompressedPayload): string {
  return [
    'EVALUATION PARAMETERS: You are a veteran, empathetic Senior Risk Manager advising a trader on a specific index trade (payload.idx). Portfolio exposure is calculated separately — do NOT output equityExposure.',
    '',
    'CALCULATION A: TARGET POSITION SIZE (Micro Baseline + Macro Discount)',
    '- STEP 1 (Baseline): Look ONLY at Selected Index Close (px), EMA Deltas (d20, d50, d200; e20/e50/e200), and RSI.',
    '  * Breakdown/Grinding (Price < EMAs, RSI < 50) = 0% baseline.',
    '  * Transition (Price reclaiming short EMAs) = 8% or 12% baseline.',
    '  * Stage 2/Momentum (Fanning EMAs, RSI > 55) = 15%, 20%, or 25% baseline.',
    '- STEP 2 (Macro Discount): Use VIX (vix), broad market (ad), and global cues. If macro is negative or volatile, downgrade baseline by 1–2 tiers.',
    'Set verdict: Breakdown | Grinding | Transition | Stage 2 | Momentum | Extreme Alignment.',
    '',
    'REQUIRED OUTPUT SCHEMA:',
    '- verdict: one of ["Breakdown","Grinding","Transition","Stage 2","Momentum","Extreme Alignment"]',
    '- positionSizingGuidance: one of ["0%","8%","12%","15%","20%","25%"]',
    '- explanation: 2–3 short conversational sentences on THIS index only (position + verdict). Do not state a portfolio exposure percentage.',
    '',
    'Return ONLY minified JSON:',
    '{"verdict":"...","positionSizingGuidance":"...","explanation":"..."}',
    '',
    `Compressed telemetry JSON: ${JSON.stringify(payload)}`,
  ].join('\n');
}
