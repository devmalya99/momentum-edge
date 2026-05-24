import { z } from 'zod';

export const BUSINESS_ANALYSIS_MODEL = 'gemini-2.5-flash';
export const BUSINESS_ANALYSIS_CACHE_TTL_SECONDS = 12 * 60 * 60;
/** Gemini explicit context cache TTL — reused across all tickers until expiry. */
export const BUSINESS_ANALYSIS_GEMINI_CONTEXT_CACHE_TTL_SECONDS = 24 * 60 * 60;
export const BUSINESS_SEGMENT_MAX_ITEMS = 6;

export const businessMomentumCategorySchema = z.enum([
  'A+',
  'A',
  'B+',
  'B',
  'C+',
  'C',
  'D',
  'F',
]);

export const businessDirectionSchema = z.enum(['up', 'flat', 'down']);

export const businessAnalysisRequestSchema = z.object({
  ticker: z.string().trim().min(1).max(40),
  companyName: z.string().trim().min(1).max(180),
  refresh: z.boolean().optional(),
});

const scorecardField = z.coerce.number().int().min(1).max(10);

export const businessScorecardSchema = z.object({
  revenueGrowth: scorecardField,
  profitGrowth: scorecardField,
  operatingMargins: scorecardField,
  demandVisibility: scorecardField,
  orderInflows: scorecardField,
  expansionCapacityGrowth: scorecardField,
  managementExecution: scorecardField,
  balanceSheetQuality: scorecardField,
  cashFlowStrength: scorecardField,
  industryTailwinds: scorecardField,
  valuationComfort: scorecardField,
  marketExpectations: scorecardField,
});

const SCORECARD_KEYS = [
  'revenueGrowth',
  'profitGrowth',
  'operatingMargins',
  'demandVisibility',
  'orderInflows',
  'expansionCapacityGrowth',
  'managementExecution',
  'balanceSheetQuality',
  'cashFlowStrength',
  'industryTailwinds',
  'valuationComfort',
  'marketExpectations',
] as const satisfies ReadonlyArray<keyof z.infer<typeof businessScorecardSchema>>;

const REMOVED_LLM_FIELDS = ['strategicInterpretation', 'finalVerdict'] as const;

/** Prompt guidance only — Zod accepts longer/richer model output than these targets. */
export const BUSINESS_ANALYSIS_LLM_LIMITS = {
  executiveSummary: { minChars: 20, maxChars: 2000, sentences: '4-6' },
  ratingReasons: { minItems: 2, maxItems: 6, itemMinChars: 3, itemMaxChars: 120 },
  keyPositives: { minItems: 1, maxItems: 6, itemMinChars: 3, itemMaxChars: 220 },
  keyRisks: { minItems: 1, maxItems: 4, itemMinChars: 3, itemMaxChars: 220 },
  businessSegments: { minItems: 3, maxItems: 6, itemMaxChars: 40 },
} as const;

const GENERIC_BUSINESS_SEGMENT_PHRASES = new Set([
  'industrial chemical',
  'industrial chemicals',
  'consumer durables',
  'electronics manufacturing',
  'manufacturing',
  'diversified',
  'conglomerate',
  'trading',
  'services',
  'financial services',
  'banking',
  'fmcg',
  'it services',
  'technology',
  'industrials',
  'chemicals',
  'consumer goods',
  'healthcare',
  'pharmaceuticals',
  'infrastructure',
  'real estate',
  'automobiles',
  'auto components',
  'engineering',
  'capital goods',
]);

const LENIENT_MAX_LIST_ITEMS = 12;

/** Accepts any non-empty text from the model (no max length). */
const lenientText = z.coerce.string().trim().min(1);

/** Narrative fields — no max length; empty string allowed if model omits content. */
const lenientLongText = z.coerce.string().trim();

function coerceStringList(val: unknown, maxItems = LENIENT_MAX_LIST_ITEMS): string[] {
  const items: string[] = [];
  if (Array.isArray(val)) {
    for (const item of val) {
      if (typeof item === 'string' && item.trim()) items.push(item.trim());
      else if (typeof item === 'number' && Number.isFinite(item)) items.push(String(item));
    }
  } else if (typeof val === 'string' && val.trim()) {
    items.push(val.trim());
  }
  return items.slice(0, maxItems);
}

function lenientStringListSchema(maxItems = LENIENT_MAX_LIST_ITEMS) {
  return z.preprocess(
    (val) => coerceStringList(val, maxItems),
    z.array(z.string().trim().min(1)).max(maxItems),
  );
}

function normalizeSegmentLabel(raw: string): string {
  return raw.trim().replace(/\s+/g, ' ');
}

function isGenericBusinessSegment(label: string): boolean {
  return GENERIC_BUSINESS_SEGMENT_PHRASES.has(normalizeSegmentLabel(label).toLowerCase());
}

export function coerceBusinessSegments(
  val: unknown,
  maxItems = BUSINESS_SEGMENT_MAX_ITEMS,
): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of coerceStringList(val, maxItems + 8)) {
    const label = normalizeSegmentLabel(item);
    if (label.length < 2 || label.length > BUSINESS_ANALYSIS_LLM_LIMITS.businessSegments.itemMaxChars) {
      continue;
    }
    if (isGenericBusinessSegment(label)) continue;
    const key = label.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(label);
    if (out.length >= maxItems) break;
  }
  return out;
}

function businessSegmentListSchema() {
  return z.preprocess(
    (val) => coerceBusinessSegments(val),
    z.array(z.string().trim().min(2).max(BUSINESS_ANALYSIS_LLM_LIMITS.businessSegments.itemMaxChars)).max(
      BUSINESS_SEGMENT_MAX_ITEMS,
    ),
  );
}

function clampScorecardValue(value: unknown): number | undefined {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return undefined;
  return Math.max(1, Math.min(10, Math.round(n)));
}

export function normalizeMomentumCategory(raw: unknown): BusinessMomentumCategory | undefined {
  if (typeof raw !== 'string') return undefined;
  const compact = raw.trim().replace(/\s+/g, '').toUpperCase();
  const aliases: Record<string, BusinessMomentumCategory> = {
    'A+': 'A+',
    A: 'A',
    'B+': 'B+',
    B: 'B',
    'C+': 'C+',
    C: 'C',
    D: 'D',
    F: 'F',
    APLUS: 'A+',
    BPLUS: 'B+',
    CPLUS: 'C+',
  };
  return aliases[compact];
}

function preprocessBusinessAnalysisLlm(raw: unknown): unknown {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return raw;
  const obj = { ...(raw as Record<string, unknown>) };
  for (const key of REMOVED_LLM_FIELDS) delete obj[key];

  const category = normalizeMomentumCategory(obj.category);
  if (category) obj.category = category;

  if (obj.scorecard && typeof obj.scorecard === 'object' && !Array.isArray(obj.scorecard)) {
    const scorecard = { ...(obj.scorecard as Record<string, unknown>) };
    for (const key of SCORECARD_KEYS) {
      const clamped = clampScorecardValue(scorecard[key]);
      if (clamped != null) scorecard[key] = clamped;
    }
    obj.scorecard = scorecard;
  }

  const stringListKeys = ['ratingReasons'] as const;
  for (const key of stringListKeys) {
    obj[key] = coerceStringList(obj[key], LENIENT_MAX_LIST_ITEMS);
  }

  if (obj.operatingSegments != null && obj.businessSegments == null) {
    obj.businessSegments = obj.operatingSegments;
  }
  obj.businessSegments = coerceBusinessSegments(obj.businessSegments);

  delete obj.keyPositives;
  delete obj.keyRisks;
  delete obj.executiveSummary;

  return obj;
}

export const businessAnalysisLlmSchema = z.preprocess(
  preprocessBusinessAnalysisLlm,
  z.object({
    category: businessMomentumCategorySchema,
    scorecard: businessScorecardSchema,
    businessSegments: businessSegmentListSchema(),
    ratingReasons: lenientStringListSchema(),
  }),
);

export const businessAnalysisHighlightsRequestSchema = z.object({
  ticker: z.string().trim().min(1).max(40),
  companyName: z.string().trim().min(1).max(180),
  refresh: z.boolean().optional(),
});

function preprocessBusinessAnalysisHighlights(raw: unknown): unknown {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return raw;
  const obj = { ...(raw as Record<string, unknown>) };
  obj.keyPositives = coerceStringList(obj.keyPositives, LENIENT_MAX_LIST_ITEMS);
  obj.keyRisks = coerceStringList(obj.keyRisks, LENIENT_MAX_LIST_ITEMS);
  if (obj.executiveSummary != null) {
    obj.executiveSummary = String(obj.executiveSummary).trim();
  }
  return obj;
}

export const businessAnalysisHighlightsLlmSchema = z.preprocess(
  preprocessBusinessAnalysisHighlights,
  z.object({
    executiveSummary: lenientLongText,
    keyPositives: lenientStringListSchema(),
    keyRisks: lenientStringListSchema(),
  }),
);

export const businessAnalysisHighlightsResponseSchema = z.object({
  ticker: z.string().trim().min(1).max(40),
  companyName: z.string().trim().min(1).max(180),
  executiveSummary: lenientLongText.default(''),
  keyPositives: lenientStringListSchema().default([]),
  keyRisks: lenientStringListSchema().default([]),
  meta: z.object({
    model: z.string().trim().min(1),
    generatedAt: z.string().trim().min(1),
    cacheStatus: z.enum(['hit', 'miss', 'stale-refreshed']),
  }),
});

export const businessAnalysisSourceSchema = z.object({
  title: z.coerce.string().trim().min(1),
  uri: z.coerce.string().trim().min(1),
});

export const businessAnalysisResponseSchema = z.object({
  ticker: z.string().trim().min(1).max(40),
  companyName: z.string().trim().min(1).max(180),
  category: businessMomentumCategorySchema,
  compositeScore: z.number().int().min(0).max(100),
  direction: businessDirectionSchema,
  previousCategory: businessMomentumCategorySchema.optional(),
  previousCompositeScore: z.number().int().min(0).max(100).optional(),
  scorecard: businessScorecardSchema,
  businessSegments: businessSegmentListSchema().default([]),
  executiveSummary: lenientLongText.default(''),
  ratingReasons: lenientStringListSchema(),
  keyPositives: lenientStringListSchema().default([]),
  keyRisks: lenientStringListSchema().default([]),
  sources: z.array(businessAnalysisSourceSchema),
  meta: z.object({
    model: z.string().trim().min(1),
    generatedAt: z.string().trim().min(1),
    cacheExpiresAt: z.string().trim().min(1),
    cacheStatus: z.enum(['hit', 'miss', 'stale-refreshed']),
    webSearchQueries: z.array(z.string()),
  }),
});

export const businessAnalysisSummariesRequestSchema = z.object({
  tickers: z.array(z.string().trim().min(1).max(40)).min(1).max(1000),
});

export const businessAnalysisSummariesResponseSchema = z.object({
  summaries: z.array(
    z.object({
      ticker: z.string().trim().min(1),
      category: businessMomentumCategorySchema,
      compositeScore: z.number().int().min(0).max(100),
      direction: businessDirectionSchema,
      previousCategory: businessMomentumCategorySchema.optional(),
      previousCompositeScore: z.number().int().min(0).max(100).optional(),
      ratingReasons: lenientStringListSchema(),
      isStale: z.boolean(),
    }),
  ),
});

type GroundingChunkLike = {
  web?: {
    title?: string;
    uri?: string;
  };
};

type GroundingMetadataLike = {
  groundingChunks?: GroundingChunkLike[];
  webSearchQueries?: string[];
};

const CATEGORY_RANK: Record<BusinessMomentumCategory, number> = {
  'A+': 8,
  A: 7,
  'B+': 6,
  B: 5,
  'C+': 4,
  C: 3,
  D: 2,
  F: 1,
};

export type BusinessAnalysisHighlightsResponse = z.infer<typeof businessAnalysisHighlightsResponseSchema>;
export type BusinessAnalysisHighlightsLlmPayload = z.infer<typeof businessAnalysisHighlightsLlmSchema>;
export type BusinessAnalysisResponse = z.infer<typeof businessAnalysisResponseSchema>;
export type BusinessAnalysisLlmPayload = z.infer<typeof businessAnalysisLlmSchema>;
export type BusinessScorecard = z.infer<typeof businessScorecardSchema>;
export type BusinessMomentumCategory = z.infer<typeof businessMomentumCategorySchema>;
export type BusinessDirection = z.infer<typeof businessDirectionSchema>;

export function normalizeBusinessTicker(ticker: string): string {
  return ticker.trim().toUpperCase().replace(/^(NSE:|BSE:)/, '');
}

export function computeCompositeScore(scorecard: z.infer<typeof businessScorecardSchema>): number {
  // Balanced weights: reward sustainable, risk-adjusted quality — not growth alone.
  const weightedTotal =
    scorecard.revenueGrowth +
    scorecard.profitGrowth * 2 +
    scorecard.operatingMargins * 2 +
    scorecard.balanceSheetQuality * 3 +
    scorecard.demandVisibility +
    scorecard.orderInflows +
    scorecard.expansionCapacityGrowth +
    scorecard.managementExecution * 2 +
    scorecard.cashFlowStrength * 2 +
    scorecard.industryTailwinds +
    scorecard.valuationComfort +
    scorecard.marketExpectations;
  const maxWeighted = 18 * 10;
  return Math.max(0, Math.min(100, Math.round((weightedTotal / maxWeighted) * 100)));
}

export function deriveDirection(input: {
  currentCategory: BusinessMomentumCategory;
  currentCompositeScore: number;
  previousCategory?: BusinessMomentumCategory | null;
  previousCompositeScore?: number | null;
}): BusinessDirection {
  const previousCategory = input.previousCategory ?? undefined;
  const previousCompositeScore =
    typeof input.previousCompositeScore === 'number' ? input.previousCompositeScore : undefined;

  if (!previousCategory || previousCompositeScore == null) return 'flat';

  const categoryDelta = CATEGORY_RANK[input.currentCategory] - CATEGORY_RANK[previousCategory];
  const scoreDelta = input.currentCompositeScore - previousCompositeScore;

  const categorySignal = categoryDelta > 0 ? 1 : categoryDelta < 0 ? -1 : 0;
  const scoreSignal = scoreDelta >= 4 ? 1 : scoreDelta <= -4 ? -1 : 0;

  if (categorySignal === scoreSignal) {
    return categorySignal > 0 ? 'up' : categorySignal < 0 ? 'down' : 'flat';
  }
  if (categorySignal === 0) return scoreSignal > 0 ? 'up' : scoreSignal < 0 ? 'down' : 'flat';
  if (scoreSignal === 0) return categorySignal > 0 ? 'up' : 'down';
  return 'flat';
}

function buildBusinessAnalysisOutputConstraints(): string[] {
  const L = BUSINESS_ANALYSIS_LLM_LIMITS;
  return [
    'HARD OUTPUT CONSTRAINTS (must satisfy before you finish; count characters including spaces):',
    `- category: exactly one of A+, A, B+, B, C+, C, D, F (no spaces, no words like "plus").`,
    `- scorecard: twelve integer fields, each 1-10 only (no decimals, no strings).`,
    `- ratingReasons: ${L.ratingReasons.minItems}-${L.ratingReasons.maxItems} items; EACH item ${L.ratingReasons.itemMinChars}-${L.ratingReasons.itemMaxChars} characters.`,
    '  Style: terse tag phrases (about 5-12 words), not full sentences. Never paste headlines or clauses with commas into one reason.',
    `  Good: "OEM order backlog visibility improving" (42 chars). Bad: a 150+ character sentence explaining multiple drivers.`,
    `- businessSegments: ${L.businessSegments.minItems}-${L.businessSegments.maxItems} specific product/vertical labels; EACH 1-3 words, ${L.businessSegments.itemMaxChars} char max.`,
    '  Name concrete revenue or growth verticals — what the company actually makes, sells, mines, or operates.',
    '  Good: "Industrial Gas", "Drone", "Ammunition", "Semiconductors", "BESS", "Optical Fibre", "Mining Explosives".',
    '  Bad (too vague): "Industrial Chemical", "Consumer Durables", "Electronics Manufacturing", "Capital Goods", "Diversified".',
    'Before returning JSON: loop ratingReasons and confirm every item length <= 120; if any exceed 120, rewrite shorter and recheck until all pass.',
  ];
}

function buildBalancedScoringPhilosophyLines(): string[] {
  return [
    'SCORING PHILOSOPHY:',
    'Evaluate risk-adjusted business quality — not excitement or speed of growth alone.',
    'Core question: "How healthy, durable, and sustainable is this business growth?"',
    'Reward high-quality sustainable growth; penalize risky, debt-fueled, or cyclical growth stories.',
    'Distinguish: sustainable growth | risky aggressive growth | cyclical temporary growth | debt-fueled expansion | structurally strong businesses.',
  ];
}

function buildRiskEvaluationDimensionLines(): string[] {
  return [
    'RISK & SUSTAINABILITY LENS (reflect in scorecard scores, category, and ratingReasons):',
    '- Balance sheet risk and debt sustainability',
    '- Interest coverage strength',
    '- Capital efficiency (ROE / ROCE quality and allocation discipline)',
    '- Cash flow durability vs reported earnings',
    '- Working capital quality and receivable/inventory cycles',
    '- Margin sustainability (structural vs temporary cycle uplift)',
    '- Expansion quality (capex discipline vs overreach)',
    '- Import dependency and raw material volatility exposure',
    '- Capex pressure and funding risk during expansion',
    '- Customer / supplier concentration risk when material',
  ];
}

function buildBalancedScoringRuleLines(): string[] {
  return [
    'SCORING RULES:',
    '- High revenue growth alone must NOT guarantee A+/A categories.',
    '- Aggressive expansion on a weak balance sheet should be penalized in balanceSheetQuality, cashFlowStrength, and category.',
    '- Weak interest coverage should reduce balanceSheetQuality and cap the category.',
    '- Poor working capital cycles should reduce balanceSheetQuality and cashFlowStrength.',
    '- Heavy import dependence or commodity sensitivity is structural business risk — penalize when material.',
    '- Margin expansion from temporary cycles should not inflate operatingMargins or category.',
    '- Capital-destructive growth (low ROE/ROCE, value-eroding capex) should not receive premium classifications.',
    '- Strong ROE/ROCE and efficient capital allocation should lift managementExecution and overall quality.',
    '- Sustainable execution should rank above speculative expansion in category assignment.',
    '- When growth is strong but durability is weak, prefer B+/B over A — reserve top tiers for balanced quality.',
  ];
}

/** Static reference body cached with the business-analysis system instruction (meets Gemini min token size). */
export function buildBusinessAnalysisCachedReferenceContent(): string {
  const L = BUSINESS_ANALYSIS_LLM_LIMITS;
  return [
    'INDIAN EQUITY BUSINESS QUALITY REFERENCE (apply on every ticker):',
    '',
    ...buildBalancedScoringPhilosophyLines(),
    '',
    ...buildRiskEvaluationDimensionLines(),
    '',
    ...buildBalancedScoringRuleLines(),
    '',
    'Category rubric (risk-adjusted business quality, not price action):',
    '- A+: Structurally strong business with durable growth, healthy balance sheet, sustainable margins, strong cash conversion, and credible execution — not just fast top-line growth.',
    '- A: Strong risk-adjusted profile; growth is real and largely sustainable with manageable leverage and efficient capital use.',
    '- B+: Good business quality with visible growth but one or two durability concerns (leverage, WC, cyclical margins, or capex strain).',
    '- B: Mixed profile — decent growth or niche strength offset by execution, balance sheet, or sustainability gaps.',
    '- C+: Early improvement or isolated strengths within a still-fragile overall business.',
    '- C: Neutral to soft; sluggish growth, margin pressure, weak visibility, or rising operational fragility.',
    '- D: Deteriorating fundamentals — rising leverage, weak coverage, margin erosion, or repeated execution misses.',
    '- F: Severe stress — unsustainable economics, broken model, or major governance / solvency red flags.',
    '',
    'Scorecard field guidance (each 1-10; fold risk dimensions into these existing fields):',
    '- revenueGrowth: YoY revenue trend — discount unsustainable or debt-fueled top-line acceleration.',
    '- profitGrowth: PAT/EBITDA growth quality; penalize one-offs and non-cash earnings inflation.',
    '- operatingMargins: Margin level and direction — distinguish structural improvement from cyclical spikes.',
    '- demandVisibility: Order book, pipeline, utilization, or recurring revenue for next 2-4 quarters.',
    '- orderInflows: New orders, L1/L2 wins, tender conversion — not just narrative excitement.',
    '- expansionCapacityGrowth: Capex/capacity ramp quality — penalize overreach and unfunded expansion.',
    '- managementExecution: Delivery vs guidance plus capital allocation, ROE/ROCE quality, and discipline.',
    '- balanceSheetQuality: Net debt, interest coverage, WC cycles, pledging — core risk score.',
    '- cashFlowStrength: OCF/FCF durability vs profit; capex funding quality and conversion.',
    '- industryTailwinds: Policy/cycle tailwinds minus import dependency and commodity headwinds when relevant.',
    '- valuationComfort: Whether expectations already embed aggressive or unsustainable growth.',
    '- marketExpectations: Street narrative vs your risk-adjusted fundamental view.',
    '',
    'Composite weighting reminder: balanceSheetQuality (3x), profitGrowth & operatingMargins (2x each), managementExecution & cashFlowStrength (2x each), revenueGrowth (1x — growth alone must not dominate).',
    '',
    'businessSegments rules:',
    `- Return ${L.businessSegments.minItems}-${L.businessSegments.maxItems} specific vertical/product labels (1-3 words each, max ${L.businessSegments.itemMaxChars} chars).`,
    '- Prefer revenue mix leaders and fastest-growing verticals.',
    '- Reject broad sector buckets like "Capital Goods", "FMCG", "IT Services", "Diversified".',
    '',
    'ratingReasons rules:',
    `- ${L.ratingReasons.minItems}-${L.ratingReasons.maxItems} terse tag phrases; each <= ${L.ratingReasons.itemMaxChars} characters.`,
    '- Include durability or risk tags when material (e.g. "Leverage rising with capex", "Strong FCF conversion").',
    '- No headlines pasted verbatim; no multi-clause sentences.',
    '',
    'Research process:',
    '1. Ground claims in recent filings, management commentary, industry data, and credible news.',
    '2. Classify growth type: sustainable | aggressive/risky | cyclical/temporary | debt-fueled.',
    '3. Penalize weak profitability, rising debt, poor coverage, and fragile WC during expansion.',
    '4. Do not overrate cyclical margin peaks or narrative-driven excitement.',
    '5. Return JSON only with keys: category, scorecard, businessSegments, ratingReasons.',
  ].join('\n');
}

/** Static reference body cached with the highlights system instruction (meets Gemini min token size). */
export function buildBusinessAnalysisHighlightsCachedReferenceContent(): string {
  const L = BUSINESS_ANALYSIS_LLM_LIMITS;
  return [
    'INDIAN EQUITY HIGHLIGHTS WRITING REFERENCE (apply on every ticker):',
    '',
    'Purpose: produce executiveSummary, keyPositives, and keyRisks after category/scorecard work.',
    'Tone: institutional equity research — concise, factual, no hype, no price targets.',
    'Frame around risk-adjusted business quality: durability and sustainability of growth, not excitement alone.',
    '',
    'executiveSummary:',
    `- ${L.executiveSummary.sentences} sentences on business model, risk-adjusted momentum, and what makes the category deserved.`,
    '- Lead with fundamentals and durability — not share price, technicals, or narrative hype.',
    '- Address whether growth looks sustainable, cyclical, or debt-fueled when evidence exists.',
    '- Mention balance sheet, cash flow, and margin sustainability when material.',
    '- Acknowledge uncertainty explicitly when evidence is thin.',
    '- Do not open with generic sector boilerplate; anchor on company-specific drivers.',
    '- If category/scorecard context is provided, reflect it without listing every score.',
    '',
    'keyPositives:',
    `- ${L.keyPositives.minItems}-${L.keyPositives.maxItems} crisp bullets on durable, structural strengths.`,
    '- Prefer evidence of sustainable advantage: cash conversion, ROE/ROCE, execution, moat — not one-quarter spikes.',
    '- Avoid repeating the executive summary verbatim.',
    '- Each bullet should be self-contained and under 220 characters.',
    '- Prioritize structural advantages over one-quarter noise.',
    '',
    'keyRisks:',
    `- ${L.keyRisks.minItems}-${L.keyRisks.maxItems} crisp bullets on fundamental risks.`,
    '- Prioritize sustainability risks: leverage, coverage, WC strain, import/commodity exposure, capex pressure, concentration.',
    '- Include valuation/over-expectation risk when relevant.',
    '- Do not invent risks without evidence; flag data gaps instead.',
    '- Separate business risks from market sentiment or technical trading risks.',
    '',
    'Category context (when provided) — narrative alignment:',
    '- A+/A: emphasize durable growth, balance sheet strength, cash conversion, and capital efficiency.',
    '- B+/B: balance strengths with specific durability gaps (leverage, WC, cyclicality, capex strain).',
    '- C+/C: focus on whether improvement is early-stage or still unproven and fragile.',
    '- D/F: lead with deterioration, balance sheet stress, unsustainable expansion, or broken execution.',
    '',
    'Scorecard-aware writing:',
    '- Strong revenueGrowth with weak balanceSheetQuality or cashFlowStrength → flag risky growth, do not cheerlead.',
    '- High expansionCapacityGrowth with weak cashFlowStrength → note capex/funding pressure.',
    '- Strong operatingMargins during a known cycle peak → note sustainability risk.',
    '',
    'Indian market specifics to consider when relevant:',
    '- PLI schemes, import substitution, and domestic manufacturing capex cycles.',
    '- Monsoon, rural demand, and commodity input costs for consumer/agri/industrial names.',
    '- Regulatory actions (RBI, SEBI, sector ministries), tariff changes, and export markets.',
    '- Promoter holding changes, pledging, and related-party transactions when disclosed.',
    '',
    'Anti-patterns (never do these):',
    '- Price targets, technical levels, or "stock looks attractive" language.',
    '- Copy-pasting ratingReasons or scorecard JSON into prose.',
    '- Generic positives like "strong brand" without a company-specific proof point.',
    '- Generic risks like "market volatility" without a business linkage.',
    '',
    'When scorecard or ratingReasons are supplied in the user message, align narrative with them without restating every field.',
    'Return JSON only with keys: executiveSummary, keyPositives, keyRisks.',
    '',
    'Example shape (illustrative only):',
    '{',
    '  "executiveSummary": "...",',
    '  "keyPositives": ["...", "..."],',
    '  "keyRisks": ["...", "..."]',
    '}',
    '',
    'Quality checklist before returning JSON:',
    '1. executiveSummary is 4-6 sentences and company-specific.',
    '2. keyPositives and keyRisks are distinct lists (no duplicate themes).',
    '3. Every bullet adds new information not already stated in the summary.',
    '4. Language stays neutral — no buy/sell/hold recommendations.',
    '5. Output is valid JSON with exactly three top-level keys.',
    '6. No markdown fences or commentary outside the JSON object.',
    '',
    'Scorecard field reference (when scorecard JSON is supplied):',
    '- revenueGrowth / profitGrowth: growth trajectory and quality of earnings.',
    '- operatingMargins: margin level, expansion or compression trend.',
    '- demandVisibility: near-term revenue visibility from orders, backlog, utilization.',
    '- orderInflows: new business wins and pipeline conversion.',
    '- expansionCapacityGrowth: capex execution and capacity ramp — note funding and overreach risk.',
    '- managementExecution: delivery vs guidance plus ROE/ROCE and capital allocation discipline.',
    '- balanceSheetQuality: leverage, interest coverage, WC quality, pledging — central risk field.',
    '- cashFlowStrength: OCF/FCF durability, conversion quality, capex funding.',
    '- industryTailwinds: policy, cycle, and structural demand for the sector.',
    '- valuationComfort: whether current expectations embed aggressive assumptions.',
    '- marketExpectations: gap between consensus narrative and fundamental reality.',
  ].join('\n');
}

export function buildBusinessAnalysisSystemInstruction(): string {
  const L = BUSINESS_ANALYSIS_LLM_LIMITS;
  return [
    'You are an elite equity research analyst specializing in Indian equities.',
    'Return strict JSON only. No markdown. No code fences.',
    'Classify business quality into exactly one category: A+, A, B+, B, C+, C, D, F.',
    'Categories reflect risk-adjusted business quality and sustainable growth — not stock price action or narrative excitement.',
    ...buildBalancedScoringPhilosophyLines(),
    ...buildBalancedScoringRuleLines(),
    'Keep statements concise, fact-based, and institutional in tone.',
    'If uncertain, acknowledge uncertainty; never invent facts.',
    ...buildBusinessAnalysisOutputConstraints(),
    'Output JSON schema:',
    '{',
    '  "category": "A+|A|B+|B|C+|C|D|F",',
    '  "scorecard": {',
    '    "revenueGrowth": 1-10,',
    '    "profitGrowth": 1-10,',
    '    "operatingMargins": 1-10,',
    '    "demandVisibility": 1-10,',
    '    "orderInflows": 1-10,',
    '    "expansionCapacityGrowth": 1-10,',
    '    "managementExecution": 1-10,',
    '    "balanceSheetQuality": 1-10,',
    '    "cashFlowStrength": 1-10,',
    '    "industryTailwinds": 1-10,',
    '    "valuationComfort": 1-10,',
    '    "marketExpectations": 1-10',
    '  },',
    `  "businessSegments": ["${L.businessSegments.minItems}-${L.businessSegments.maxItems} specific vertical chips, 1-3 words each"],`,
    `  "ratingReasons": ["${L.ratingReasons.minItems}-${L.ratingReasons.maxItems} tag phrases, ${L.ratingReasons.itemMaxChars} char max each"]`,
    '}',
    'Example businessSegments:',
    '["Industrial Gas", "Specialty Chemicals", "Agrochemicals", "Performance Materials"]',
    'Example ratingReasons (each under 120 characters):',
    '["Revenue growth re-accelerating", "Margin expansion with operating leverage", "Order book supports 2-3q visibility"]',
  ].join('\n');
}

export function buildBusinessAnalysisUserPrompt(input: {
  ticker: string;
  companyName: string;
  tradingViewHeadlines: string[];
  referenceDate?: Date;
}): string {
  const today = (input.referenceDate ?? new Date()).toISOString().slice(0, 10);
  const headlines = input.tradingViewHeadlines.slice(0, 20);
  return [
    `Reference date: ${today}.`,
    `Analyze ${input.ticker} (${input.companyName}) for risk-adjusted business quality category assignment.`,
    'Ask: how healthy, durable, and sustainable is this company\'s growth — not how fast or exciting it is.',
    'Fold balance sheet risk, cash flow durability, capital efficiency, and operational fragility into scorecard scores and category.',
    'Identify the company\'s top revenue or fastest-growing verticals as specific businessSegments chips (not broad sector labels).',
    'Use Google Search grounding for realtime data and combine it with TradingView headlines when provided.',
    headlines.length > 0 ? 'TradingView headlines:' : 'TradingView headlines: none available — rely on Google Search.',
    ...headlines.map((item, idx) => `${idx + 1}. ${item}`),
    'Return only these JSON keys: category, scorecard, businessSegments, ratingReasons.',
    'Do not include executiveSummary, keyPositives, keyRisks, strategicInterpretation, finalVerdict, or any other keys.',
    `Every ratingReasons entry must be <= ${BUSINESS_ANALYSIS_LLM_LIMITS.ratingReasons.itemMaxChars} characters (count before submit). Use short tag phrases, not long sentences.`,
    'Self-check: if any ratingReasons[i].length > 120, shorten it before output.',
  ].join('\n');
}

export function buildBusinessAnalysisHighlightsSystemInstruction(): string {
  const L = BUSINESS_ANALYSIS_LLM_LIMITS;
  return [
    'You are an elite equity research analyst specializing in Indian equities.',
    'Return strict JSON only. No markdown. No code fences.',
    'Write an executive summary and list the most important business positives and risks.',
    'Focus on risk-adjusted business quality — durability and sustainability of growth, not price action or hype.',
    'Keep content concise, fact-based, and institutional in tone.',
    'If uncertain, acknowledge uncertainty; never invent facts.',
    'Output JSON schema:',
    '{',
    `  "executiveSummary": "${L.executiveSummary.sentences} sentences",`,
    `  "keyPositives": ["${L.keyPositives.minItems}-${L.keyPositives.maxItems} crisp bullets"],`,
    `  "keyRisks": ["${L.keyRisks.minItems}-${L.keyRisks.maxItems} crisp bullets"]`,
    '}',
  ].join('\n');
}

export function buildBusinessAnalysisHighlightsUserPrompt(input: {
  ticker: string;
  companyName: string;
  category?: string;
  compositeScore?: number;
  ratingReasons?: string[];
  scorecard?: z.infer<typeof businessScorecardSchema>;
  referenceDate?: Date;
}): string {
  const today = (input.referenceDate ?? new Date()).toISOString().slice(0, 10);
  const contextLines = [
    input.category ? `Business momentum category: ${input.category}.` : null,
    typeof input.compositeScore === 'number'
      ? `Composite score from scorecard: ${input.compositeScore}/100.`
      : null,
    input.ratingReasons?.length
      ? `Rating reasons: ${input.ratingReasons.join('; ')}.`
      : null,
    input.scorecard ? `Scorecard JSON: ${JSON.stringify(input.scorecard)}.` : null,
  ].filter(Boolean);

  return [
    `Reference date: ${today}.`,
    `Write executive summary, key positives, and key risks for ${input.ticker} (${input.companyName}).`,
    'Emphasize sustainable vs risky growth, balance sheet durability, and capital efficiency where relevant.',
    ...contextLines,
    'Return only JSON with executiveSummary, keyPositives, and keyRisks.',
  ].join('\n');
}

export function extractGroundingSources(
  groundingMetadata: GroundingMetadataLike | undefined,
): Array<{ title: string; uri: string }> {
  const chunks = groundingMetadata?.groundingChunks ?? [];
  const seen = new Set<string>();
  const sources: Array<{ title: string; uri: string }> = [];

  for (const chunk of chunks) {
    const uri = chunk.web?.uri?.trim();
    if (!uri || seen.has(uri)) continue;
    seen.add(uri);
    sources.push({
      title: chunk.web?.title?.trim() || uri,
      uri,
    });
  }

  return sources;
}

export function sanitizeBusinessAnalysisSources(
  sources: Array<{ title: string; uri: string }>,
): Array<{ title: string; uri: string }> {
  const seen = new Set<string>();
  const out: Array<{ title: string; uri: string }> = [];
  for (const source of sources) {
    const uri = source.uri?.trim();
    if (!uri || seen.has(uri)) continue;
    try {
      const parsed = new URL(uri);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') continue;
    } catch {
      continue;
    }
    seen.add(uri);
    const title = source.title?.trim().slice(0, 240) || uri;
    out.push({ title, uri });
  }
  return out;
}

export function parseBusinessAnalysisLlmPayload(raw: unknown): BusinessAnalysisLlmPayload {
  return businessAnalysisLlmSchema.parse(raw);
}

export function parseBusinessAnalysisHighlightsPayload(
  raw: unknown,
): BusinessAnalysisHighlightsLlmPayload {
  return businessAnalysisHighlightsLlmSchema.parse(raw);
}

export function hasBusinessAnalysisHighlights(payload: {
  executiveSummary?: string;
  keyPositives?: string[];
  keyRisks?: string[];
}): boolean {
  const hasSummary = (payload.executiveSummary?.trim().length ?? 0) > 0;
  const hasLists =
    (payload.keyPositives?.length ?? 0) > 0 || (payload.keyRisks?.length ?? 0) > 0;
  return hasSummary && hasLists;
}

export function extractJsonObject(raw: string): unknown {
  const trimmed = raw.trim();
  if (!trimmed) throw new Error('Model returned empty text');
  const firstBrace = trimmed.indexOf('{');
  const lastBrace = trimmed.lastIndexOf('}');
  if (firstBrace < 0 || lastBrace <= firstBrace) {
    throw new Error('Model response did not contain a JSON object');
  }
  return JSON.parse(trimmed.slice(firstBrace, lastBrace + 1));
}
