/** Index score catalog: treat as fresh for 24h — avoids repeat Gemini calls on navigation/refresh. */
export const INDEX_SCORES_STALE_MS = 24 * 60 * 60 * 1000;

export const INDEX_SCORES_GC_MS = INDEX_SCORES_STALE_MS * 2;
