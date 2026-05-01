'use client';

export type StaticStockTag = { id: string; label: string; sortOrder: number };
type TagMap = Map<string, string[]>;

export function useStockTagsQuery(_tickers: string[]) {
  return {
    staticTags: [] as StaticStockTag[],
    isLoadingStaticTags: false,
    isFetchingStaticTags: false,
    stockTagsByTicker: new Map<string, string[]>() as TagMap,
    isLoadingStockTags: false,
    isFetchingStockTags: false,
    saveTags: async (_args: { ticker: string; tagId: string | null }) => {},
    isSavingTags: false,
  };
}
