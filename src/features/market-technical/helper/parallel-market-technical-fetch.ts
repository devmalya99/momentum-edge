import { fetchMarketTechnical, type FetchMarketTechnicalParams } from '@/features/market-technical/api/fetch-market-technical';
import type { MarketTechnicalApiResponse } from '@/features/market-technical/types';

/**
 * Fetches several market-technical payloads concurrently (main-thread `Promise.all`).
 * Heavy indicator math stays on `/api/nse/market-technical`; use this when you need
 * multiple symbols or ranges at once. For CPU-bound client work, offload post-processing
 * to a Web Worker instead of repeating NSE calls.
 */
export function fetchMarketTechnicalParallel(
  requests: FetchMarketTechnicalParams[],
): Promise<MarketTechnicalApiResponse[]> {
  return Promise.all(requests.map((p) => fetchMarketTechnical(p)));
}
