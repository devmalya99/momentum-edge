import { z } from 'zod';

export const analyseScanStockSchema = z.object({
  symbol: z.string().trim().min(1).max(40),
  name: z.string().trim().min(1).max(180),
});

export const analyseScanRequestSchema = z.object({
  scannerName: z.string().trim().min(1).max(80),
  stocks: z.array(analyseScanStockSchema).min(1).max(150),
});

export const analysedScanItemSchema = z.object({
  name: z.string().trim().min(1).max(180),
  symbol: z.string().trim().min(1).max(40),
  sector: z.string().trim().min(1).max(80),
  industry: z.string().trim().min(1).max(100),
  segment: z.string().trim().min(1).max(100),
  anyRecentNewsTrigger: z.string().trim().min(1).max(220).nullable(),
});

export const analysedScanItemsSchema = z.array(analysedScanItemSchema).min(1).max(150);

export const analyseScanApiResponseSchema = z.object({
  items: analysedScanItemsSchema,
  meta: z.object({
    model: z.string().trim().min(1),
    scannerName: z.string().trim().min(1),
    analysedCount: z.number().int().min(0),
    generatedAt: z.string().trim().min(1),
  }),
});

export const stockNewsItemSchema = z.object({
  id: z.string().trim().min(1),
  title: z.string().trim().min(1),
  link: z.string().trim().url(),
});

export const stockNewsApiResponseSchema = z.object({
  items: z.array(stockNewsItemSchema).max(5),
});

export const stockTriggerRequestSchema = z.object({
  symbol: z.string().trim().min(1).max(40),
  name: z.string().trim().min(1).max(180),
  segment: z.string().trim().min(1).max(100),
});

export const stockTriggerApiResponseSchema = z.object({
  bullets: z.array(z.string().trim().min(1).max(280)).length(2),
  meta: z.object({
    model: z.string().trim().min(1),
    generatedAt: z.string().trim().min(1),
  }),
});

export type AnalyseScanRequest = z.infer<typeof analyseScanRequestSchema>;
export type AnalysedScanItem = z.infer<typeof analysedScanItemSchema>;
export type AnalyseScanApiResponse = z.infer<typeof analyseScanApiResponseSchema>;
export type StockNewsItem = z.infer<typeof stockNewsItemSchema>;

export function extractJsonArray(text: string): unknown {
  const trimmed = text.trim();
  if (!trimmed) throw new Error('Model returned empty text');
  const first = trimmed.indexOf('[');
  const last = trimmed.lastIndexOf(']');
  if (first < 0 || last <= first) {
    throw new Error('Model response did not contain a JSON array');
  }
  return JSON.parse(trimmed.slice(first, last + 1));
}
