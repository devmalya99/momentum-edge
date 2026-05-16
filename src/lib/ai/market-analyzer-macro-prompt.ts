import type { CompressedMacroPayload } from '@/types/marketAnalyzer';

/** Index-blind portfolio exposure — Calculation B only. */
export function buildPortfolioExposurePrompt(payload: CompressedMacroPayload): string {
  return [
    'You are a veteran, empathetic Senior Risk Manager. Calculate TOTAL PORTFOLIO EXPOSURE only (Calculation B — Pure Macro View).',
    '',
    'CRITICAL: Ignore any sector or thematic index. This measures the entire market.',
    '- Use ONLY: VIX (vix), Advance/Decline (ad), Nifty 500 health (n500 px, d20/d50/d200, rsi), Calendar (cal), and plausible geopolitical/macro context.',
    '- If VIX is trending up, A/D is weak/falling (< 1.4), Nifty 500 is sideways/down, or macro is negative: Cap at 0%, 10%, or 30%.',
    '- If macro is highly favorable, A/D expanding decisively, VIX stable/crashing: Scale to 50%, 70%, 100%, or 125%.',
    '',
    'OUTPUT (minified JSON only):',
    '{"equityExposure":"...","summary":"..."}',
    '- equityExposure: one of ["0%","10%","30%","50%","70%","100%","125%"]',
    '- summary: one short conversational sentence on macro conditions (no bullet lists).',
    '',
    `Compressed macro telemetry JSON: ${JSON.stringify(payload)}`,
  ].join('\n');
}
