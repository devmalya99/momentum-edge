import type { IndexAnalyzerResult, TargetIndex } from '@/types/marketAnalyzer';

export type IndexScoreEntry = Pick<
  IndexAnalyzerResult,
  'positionSizingGuidance' | 'verdict'
> & {
  fetchedAt: string;
};

export type IndexScoresCatalog = {
  refreshedAt: string;
  scores: Partial<Record<TargetIndex, IndexScoreEntry>>;
};
