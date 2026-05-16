/**
 * Market Analyzer index catalog — NSE `getGraphChart` symbol strings by category.
 * Add or adjust entries here; IDs are stable slugs for API payloads and Zod validation.
 */

export type IndexCategory = 'broad' | 'sectoral' | 'thematic' | 'strategy';

export type MarketAnalyzerIndexEntry = {
  readonly id: string;
  /** Display name; also the primary `getGraphChart` type candidate. */
  readonly nseSymbol: string;
  readonly category: IndexCategory;
  /** Optional NSE short key when the long name returns 404. */
  readonly chartType?: string;
};

export const INDEX_CATEGORY_LABELS: Record<IndexCategory, string> = {
  broad: 'Broad market',
  sectoral: 'Sectoral',
  thematic: 'Thematic',
  strategy: 'Strategy & factor',
};

function entry(
  id: string,
  nseSymbol: string,
  category: IndexCategory,
  chartType?: string,
): MarketAnalyzerIndexEntry {
  return chartType ? { id, nseSymbol, category, chartType } : { id, nseSymbol, category };
}

/** Curated NSE indices for Market Analyzer (broad, sectoral, thematic, strategy). */
export const MARKET_ANALYZER_INDEXES = [
  // —— Broad market ——
  entry('NIFTY_50', 'NIFTY 50', 'broad'),
  entry('NIFTY_NEXT_50', 'NIFTY NEXT 50', 'broad'),
  entry('NIFTY_100', 'NIFTY 100', 'broad'),
  entry('NIFTY_200', 'NIFTY 200', 'broad'),
  entry('NIFTY_500', 'NIFTY 500', 'broad'),
  entry('NIFTY_MIDCAP_50', 'NIFTY MIDCAP 50', 'broad'),
  entry('NIFTY_MIDCAP_100', 'NIFTY MIDCAP 100', 'broad'),
  entry('NIFTY_MIDCAP_150', 'NIFTY MIDCAP 150', 'broad'),
  entry('NIFTY_SMALLCAP_50', 'NIFTY SMALLCAP 50', 'broad'),
  entry('NIFTY_SMALLCAP_100', 'NIFTY SMALLCAP 100', 'broad'),
  entry('NIFTY_SMALLCAP_250', 'NIFTY SMALLCAP 250', 'broad'),
  entry('NIFTY_LARGEMIDCAP_250', 'NIFTY LARGEMIDCAP 250', 'broad'),
  entry('NIFTY_MICROCAP_250', 'NIFTY MICROCAP 250', 'broad'),
  entry('NIFTY_MIDSMALLCAP_400', 'NIFTY MIDSMALLCAP 400', 'broad'),
  entry('NIFTY_TOTAL_MARKET', 'NIFTY TOTAL MARKET', 'broad'),
  entry('NIFTY500_MULTICAP_50_25_25', 'NIFTY500 MULTICAP 50:25:25', 'broad'),
  entry('NIFTY500_LARGEMIDSMALL_EQUAL_CAP', 'NIFTY500 LARGEMIDSMALL EQUAL-CAP WEIGHTED', 'broad'),
  entry('NIFTY50_EQUAL_WEIGHT', 'NIFTY50 EQUAL WEIGHT', 'broad'),
  entry('NIFTY100_EQUAL_WEIGHT', 'NIFTY100 EQUAL WEIGHT', 'broad'),
  entry('NIFTY100_LOW_VOLATILITY_30', 'NIFTY100 LOW VOLATILITY 30', 'broad'),

  // —— Sectoral ——
  entry('NIFTY_AUTO', 'NIFTY AUTO', 'sectoral'),
  entry('NIFTY_BANK', 'NIFTY BANK', 'sectoral'),
  entry('NIFTY_CHEMICALS', 'NIFTY CHEMICALS', 'sectoral'),
  entry('NIFTY_FINANCIAL_SERVICES', 'NIFTY FINANCIAL SERVICES', 'sectoral'),
  entry('NIFTY_FINANCIAL_SERVICES_25_50', 'NIFTY FINANCIAL SERVICES 25/50', 'sectoral'),
  entry('NIFTY_FINSERV_EXBANK', 'NIFTY FINSERV EXBANK', 'sectoral'),
  entry('NIFTY_FMCG', 'NIFTY FMCG', 'sectoral'),
  entry('NIFTY_HEALTHCARE', 'NIFTY HEALTHCARE', 'sectoral'),
  entry('NIFTY_IT', 'NIFTY IT', 'sectoral'),
  entry('NIFTY_MEDIA', 'NIFTY MEDIA', 'sectoral'),
  entry('NIFTY_METAL', 'NIFTY METAL', 'sectoral'),
  entry('NIFTY_PHARMA', 'NIFTY PHARMA', 'sectoral'),
  entry('NIFTY_PRIVATE_BANK', 'NIFTY PRIVATE BANK', 'sectoral'),
  entry('NIFTY_PSU_BANK', 'NIFTY PSU BANK', 'sectoral'),
  entry('NIFTY_REALTY', 'NIFTY REALTY', 'sectoral'),
  entry('NIFTY_CONSUMER_DURABLES', 'NIFTY CONSUMER DURABLES', 'sectoral'),
  entry('NIFTY_OIL_GAS', 'NIFTY OIL & GAS', 'sectoral'),
  entry('NIFTY_COMMODITIES', 'NIFTY COMMODITIES', 'sectoral'),
  entry('NIFTY_INFRASTRUCTURE', 'NIFTY INFRASTRUCTURE', 'sectoral'),
  entry('NIFTY_INDIA_MANUFACTURING', 'NIFTY INDIA MANUFACTURING', 'sectoral'),
  entry('NIFTY_SERVICES_SECTOR', 'NIFTY SERVICES SECTOR', 'sectoral'),
  entry('NIFTY_IND_DIGITAL', 'NIFTY IND DIGITAL', 'sectoral'),

  // —— Thematic ——
  entry('NIFTY_CAPITAL_MARKETS', 'NIFTY CAPITAL MARKETS', 'thematic'),
  entry('NIFTY_INDIA_DEFENCE', 'NIFTY INDIA DEFENCE', 'thematic'),
  entry('NIFTY_ENERGY', 'NIFTY ENERGY', 'thematic'),
  entry('NIFTY_EV_NEW_AGE_AUTOMOTIVE', 'NIFTY EV & NEW AGE AUTOMOTIVE', 'thematic'),
  entry('NIFTY_CPSE', 'NIFTY CPSE', 'thematic'),
  entry('NIFTY_PSE', 'NIFTY PSE', 'thematic'),
  entry('NIFTY_INDIA_CONSUMPTION', 'NIFTY INDIA CONSUMPTION', 'thematic'),
  entry('NIFTY_INDIA_INTERNET', 'NIFTY INDIA INTERNET', 'thematic'),
  entry('NIFTY_INDIA_NEW_AGE_CONSUMPTION', 'NIFTY INDIA NEW AGE CONSUMPTION', 'thematic'),
  entry('NIFTY_INDIA_TOURISM', 'NIFTY INDIA TOURISM', 'thematic'),
  entry('NIFTY_CORE_HOUSING', 'NIFTY CORE HOUSING', 'thematic'),
  entry('NIFTY_HOUSING', 'NIFTY HOUSING', 'thematic'),
  entry('NIFTY_INDIA_RAILWAY_PSU', 'NIFTY INDIA RAILWAY PSU', 'thematic'),
  entry('NIFTY_MOBILITY', 'NIFTY MOBILITY', 'thematic'),
  entry('NIFTY_NON_CYCLICAL_CONSUMER', 'NIFTY NON-CYCLICAL CONSUMER', 'thematic'),
  entry('NIFTY_RURAL', 'NIFTY RURAL', 'thematic'),
  entry('NIFTY_INDIA_SELECT_5_CORPORATE_GROUPS', 'NIFTY INDIA SELECT 5 CORPORATE GROUPS', 'thematic'),
  entry('NIFTY_CORPORATE_GROUP_TATA', 'NIFTY INDIA CORPORATE GROUP INDEX - TATA GROUP', 'thematic'),
  entry('NIFTY_CORPORATE_GROUP_ADITYA_BIRLA', 'NIFTY INDIA CORPORATE GROUP INDEX - ADITYA BIRLA GROUP', 'thematic'),
  entry('NIFTY_CORPORATE_GROUP_MAHINDRA', 'NIFTY INDIA CORPORATE GROUP INDEX - MAHINDRA GROUP', 'thematic'),
  entry('NIFTY_CORPORATE_GROUP_TATA_25_CAP', 'NIFTY INDIA CORPORATE GROUP INDEX - TATA GROUP 25% CAP', 'thematic'),
  entry('NIFTY_INDIA_INFRASTRUCTURE_LOGISTICS', 'NIFTY INDIA INFRASTRUCTURE & LOGISTICS', 'thematic'),
  entry('NIFTY_INDIA_FPI_150', 'NIFTY INDIA FPI 150', 'thematic'),
  entry('NIFTY_MIDSML_HEALTHCARE', 'NIFTY MIDSMALL HEALTHCARE', 'thematic', 'NIFTY MIDSML HLTH'),
  entry('NIFTY_SHARIAH_25', 'NIFTY SHARIAH 25', 'thematic'),
  entry('NIFTY100_LIQUID_15', 'NIFTY100 LIQUID 15', 'thematic'),

  // —— Strategy & factor ——
  entry('NIFTY_ALPHA_50', 'NIFTY ALPHA 50', 'strategy'),
  entry(
    'NIFTY_MIDCAP150_MOMENTUM_50',
    'NIFTY MIDCAP150 MOMENTUM 50',
    'strategy',
    'NIFTYM150MOMNTM50',
  ),
  entry(
    'NIFTY_MIDSMLCAP400_MOMENTUM_QUALITY_100',
    'NIFTY MIDSMALLCAP400 MOMENTUM QUALITY 100',
    'strategy',
    'NIFTYMS400 MQ 100',
  ),
  entry(
    'NIFTY_SMLCAP250_MOMENTUM_QUALITY_100',
    'NIFTY SMALLCAP250 MOMENTUM QUALITY 100',
    'strategy',
    'NIFTYSML250MQ 100',
  ),
  entry(
    'NIFTY_TOTAL_MARKET_MOMENTUM_QUALITY_50',
    'NIFTY TOTAL MARKET MOMENTUM QUALITY 50',
    'strategy',
    'NIFTY TMMQ 50',
  ),
  entry(
    'NIFTY500_MULTICAP_MOMENTUM_QUALITY_50',
    'NIFTY500 MULTICAP MOMENTUM QUALITY 50',
    'strategy',
    'NIFTY MULTI MQ 50',
  ),
] as const satisfies readonly MarketAnalyzerIndexEntry[];

export type TargetIndexId = (typeof MARKET_ANALYZER_INDEXES)[number]['id'];

const ids = MARKET_ANALYZER_INDEXES.map((e) => e.id);
if (ids.length < 1) {
  throw new Error('MARKET_ANALYZER_INDEXES must contain at least one index');
}

/** Tuple for Zod `z.enum` — all valid analyzer index IDs. */
export const TARGET_INDEX_IDS = ids as [TargetIndexId, ...TargetIndexId[]];

const byId = new Map<string, MarketAnalyzerIndexEntry>(
  MARKET_ANALYZER_INDEXES.map((e) => [e.id, e]),
);

export function getIndexEntry(id: string): MarketAnalyzerIndexEntry | undefined {
  return byId.get(id);
}

export function isTargetIndexId(id: string): id is TargetIndexId {
  return byId.has(id);
}

export const INDEX_CATEGORIES: readonly IndexCategory[] = [
  'broad',
  'sectoral',
  'thematic',
  'strategy',
] as const;

export function indexesByCategory(category: IndexCategory): readonly MarketAnalyzerIndexEntry[] {
  return MARKET_ANALYZER_INDEXES.filter((e) => e.category === category);
}
