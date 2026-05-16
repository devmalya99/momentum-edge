'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { ChevronDown, Loader2 } from 'lucide-react';
import { getIndexEntry } from '@/lib/market-analyzer/index-catalog';
import {
  dotClassForPositionSize,
  type IndexScoreGroup,
} from '@/lib/market-analyzer/index-score-visual';
import type { IndexScoreEntry } from '@/features/market-analyzer/types/index-scores';
import type { TargetIndex } from '@/types/marketAnalyzer';

export type IndexScoreSelectProps = {
  selectedIndex: TargetIndex;
  onSelect: (index: TargetIndex) => void;
  disabled?: boolean;
  groups: IndexScoreGroup[];
  scores: Partial<Record<TargetIndex, IndexScoreEntry>>;
  warming: boolean;
  scoredCount: number;
  totalIndexes: number;
};

export function IndexScoreSelect({
  selectedIndex,
  onSelect,
  disabled,
  groups,
  scores,
  warming,
  scoredCount,
  totalIndexes,
}: IndexScoreSelectProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  const selectedEntry = getIndexEntry(selectedIndex);
  const selectedLabel = selectedEntry?.nseSymbol ?? selectedIndex.replace(/_/g, ' ');
  const selectedScore = scores[selectedIndex];

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative min-w-52 max-w-xs">
      <button
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 rounded-xl border border-white/10 bg-[#0a0a0b] px-3 py-2.5 text-sm font-semibold text-gray-200 outline-none transition-colors hover:border-white/20 focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/30 disabled:opacity-50"
      >
        <span
          className={`h-2 w-2 shrink-0 rounded-full ${dotClassForPositionSize(selectedScore?.positionSizingGuidance)}`}
          aria-hidden
        />
        <span className="min-w-0 flex-1 truncate text-left">{selectedLabel}</span>
        {warming ? (
          <Loader2 size={14} className="shrink-0 animate-spin text-violet-400" aria-hidden />
        ) : (
          <ChevronDown
            size={16}
            className={`shrink-0 text-gray-500 transition-transform ${open ? 'rotate-180' : ''}`}
            aria-hidden
          />
        )}
      </button>

      {open ? (
        <div
          id={listId}
          role="listbox"
          aria-label="Index by position size score"
          className="absolute left-0 right-0 z-50 mt-1 max-h-80 overflow-y-auto rounded-xl border border-white/10 bg-[#121214] py-1 shadow-xl shadow-black/40"
        >
          {groups.map((group) => (
            <div key={group.tier} role="group" aria-label={group.label}>
              <div className="sticky top-0 z-10 border-b border-white/5 bg-[#121214]/95 px-3 py-2 backdrop-blur-sm">
                <div className="flex items-center gap-2">
                  <span className={`h-2 w-2 rounded-full ${group.dotClass}`} aria-hidden />
                  <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400">
                    {group.label}
                  </p>
                </div>
                <p className="mt-0.5 pl-4 text-[10px] text-gray-600">{group.hint}</p>
              </div>
              {group.entries.map((entry) => {
                const score = scores[entry.id];
                const isSelected = entry.id === selectedIndex;
                return (
                  <button
                    key={entry.id}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => {
                      onSelect(entry.id);
                      setOpen(false);
                    }}
                    className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors ${
                      isSelected
                        ? 'bg-violet-500/15 text-violet-100'
                        : 'text-gray-200 hover:bg-white/5'
                    }`}
                  >
                    <span
                      className={`h-2 w-2 shrink-0 rounded-full ${dotClassForPositionSize(score?.positionSizingGuidance)}`}
                      aria-hidden
                    />
                    <span className="min-w-0 flex-1 truncate font-medium">{entry.nseSymbol}</span>
                    {score ? (
                      <span className="shrink-0 text-[10px] font-bold tabular-nums text-gray-500">
                        {score.positionSizingGuidance}
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          ))}
          <div className="border-t border-white/5 px-3 py-2 text-[10px] text-gray-600">
            {warming ? (
              <span className="inline-flex items-center gap-1.5">
                <Loader2 size={10} className="animate-spin" aria-hidden />
                Scoring {scoredCount}/{totalIndexes} · cached 24h
              </span>
            ) : (
              <span>
                {scoredCount}/{totalIndexes} scored · AI catalog cached 24h
              </span>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
