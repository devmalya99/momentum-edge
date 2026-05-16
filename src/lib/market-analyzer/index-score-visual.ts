import { POSITION_SIZE_SCALE } from '@/lib/market-analyzer/constants';
import type { MarketAnalyzerIndexEntry } from '@/lib/market-analyzer/index-catalog';
import { MARKET_ANALYZER_INDEXES } from '@/lib/market-analyzer/index-catalog';
import type { IndexScoreEntry } from '@/features/market-analyzer/types/index-scores';
import type { PositionSizeGuidance, TargetIndex } from '@/types/marketAnalyzer';

/** Highest momentum tiers first in the dropdown. */
export const POSITION_SIZE_TIER_ORDER: readonly PositionSizeGuidance[] = [
  ...POSITION_SIZE_SCALE,
].reverse() as PositionSizeGuidance[];

export type PositionSizeTierMeta = {
  dotClass: string;
  groupLabel: string;
  hint: string;
};

export const POSITION_SIZE_TIER_META: Record<PositionSizeGuidance, PositionSizeTierMeta> = {
  '25%': {
    dotClass: 'bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.55)]',
    groupLabel: '25% · Extreme momentum',
    hint: 'Full risk-on — strongest alignment',
  },
  '20%': {
    dotClass: 'bg-emerald-500/80',
    groupLabel: '20% · Strong momentum',
    hint: 'Favourable trend — size up',
  },
  '15%': {
    dotClass: 'bg-sky-400',
    groupLabel: '15% · Stage 2 / momentum',
    hint: 'Constructive — selective adds',
  },
  '12%': {
    dotClass: 'bg-amber-400',
    groupLabel: '12% · Early transition',
    hint: 'Improving — watch confirmation',
  },
  '8%': {
    dotClass: 'bg-orange-400',
    groupLabel: '8% · Weak / grinding',
    hint: 'Caution — reduce size',
  },
  '0%': {
    dotClass: 'bg-rose-500',
    groupLabel: '0% · Avoid / breakdown',
    hint: 'Stand aside',
  },
};

export const PENDING_TIER_META: PositionSizeTierMeta = {
  dotClass: 'bg-gray-600 animate-pulse',
  groupLabel: 'Scoring…',
  hint: 'Precalculating position size',
};

export type IndexScoreGroup = {
  tier: PositionSizeGuidance | 'pending';
  label: string;
  hint: string;
  dotClass: string;
  entries: readonly MarketAnalyzerIndexEntry[];
};

export function positionSizeRank(guidance: PositionSizeGuidance): number {
  return POSITION_SIZE_TIER_ORDER.indexOf(guidance);
}

export function groupIndexesByPositionSize(
  scores: Partial<Record<TargetIndex, IndexScoreEntry>>,
): IndexScoreGroup[] {
  const byTier = new Map<PositionSizeGuidance | 'pending', MarketAnalyzerIndexEntry[]>();

  for (const tier of POSITION_SIZE_TIER_ORDER) {
    byTier.set(tier, []);
  }
  byTier.set('pending', []);

  for (const entry of MARKET_ANALYZER_INDEXES) {
    const score = scores[entry.id];
    const tier = score?.positionSizingGuidance ?? 'pending';
    byTier.get(tier)?.push(entry);
  }

  const sortEntries = (list: MarketAnalyzerIndexEntry[]) =>
    [...list].sort((a, b) => a.nseSymbol.localeCompare(b.nseSymbol));

  const groups: IndexScoreGroup[] = [];

  for (const tier of POSITION_SIZE_TIER_ORDER) {
    const entries = sortEntries(byTier.get(tier) ?? []);
    if (entries.length === 0) continue;
    const meta = POSITION_SIZE_TIER_META[tier];
    groups.push({
      tier,
      label: meta.groupLabel,
      hint: meta.hint,
      dotClass: meta.dotClass,
      entries,
    });
  }

  const pending = sortEntries(byTier.get('pending') ?? []);
  if (pending.length > 0) {
    groups.push({
      tier: 'pending',
      label: PENDING_TIER_META.groupLabel,
      hint: PENDING_TIER_META.hint,
      dotClass: PENDING_TIER_META.dotClass,
      entries: pending,
    });
  }

  return groups;
}

export function dotClassForPositionSize(
  guidance: PositionSizeGuidance | undefined,
): string {
  if (!guidance) return PENDING_TIER_META.dotClass;
  return POSITION_SIZE_TIER_META[guidance].dotClass;
}
