'use client';

import { Loader2 } from 'lucide-react';

type StockTag = { id: string; label: string; sortOrder: number };

export function stockTagBadgeClass(tagId: string): string {
  if (tagId === 'no-trend') return 'border-rose-400/35 bg-rose-500/10 text-rose-200';
  if (tagId === 'short-trend') return 'border-amber-400/35 bg-amber-500/10 text-amber-200';
  if (tagId === 'long-trend') return 'border-emerald-400/35 bg-emerald-500/10 text-emerald-200';
  if (tagId === 'base-building') return 'border-cyan-400/35 bg-cyan-500/10 text-cyan-200';
  if (tagId === 'story-play') return 'border-emerald-400/35 bg-emerald-500/10 text-emerald-200';
  if (tagId === 'cleanest-chart') return 'border-cyan-400/35 bg-cyan-500/10 text-cyan-200';
  if (tagId === 'interesting') return 'border-blue-400/35 bg-blue-500/10 text-blue-200';
  if (tagId === 'mamoth') return 'border-fuchsia-400/35 bg-fuchsia-500/10 text-fuchsia-200';
  if (tagId === 'messy') return 'border-orange-400/35 bg-orange-500/10 text-orange-200';
  if (tagId === 'unsure') return 'border-yellow-400/35 bg-yellow-500/10 text-yellow-200';
  if (tagId === 'wait-for-dip') return 'border-teal-400/35 bg-teal-500/10 text-teal-200';
  if (tagId === 'investment-grade') return 'border-violet-400/35 bg-violet-500/10 text-violet-200';
  if (tagId === 'new-born') return 'border-indigo-400/35 bg-indigo-500/10 text-indigo-200';
  if (tagId === 'dead-sector') return 'border-gray-400/35 bg-gray-500/10 text-gray-200';
  return 'border-white/10 bg-white/5 text-gray-300';
}

export function compactStockTagLabel(label: string): string {
  if (label === 'Base Building') return 'Base Build';
  if (label === 'Short trend') return 'Short';
  if (label === 'Long trend') return 'Long';
  if (label === 'Investment Grade') return 'Invest Grade';
  if (label === 'Too big to move') return 'Big to move';
  return label;
}

export default function TechnicalChartScoreControl(props: {
  ticker: string;
  staticTags: StockTag[];
  selectedTagIds: string[];
  canEdit: boolean;
  onSaveTag: (tagId: string) => void | Promise<void>;
  isSaving?: boolean;
  isLoading?: boolean;
}) {
  const { ticker, staticTags, selectedTagIds, canEdit, onSaveTag, isSaving = false, isLoading = false } = props;
  const activeTagId = selectedTagIds[0] ?? null;

  return (
    <div className="flex shrink-0 flex-wrap items-center gap-2 rounded-xl border border-white/7 bg-[#0d0d10] px-3 py-2">
      <span className="text-[9px] font-bold uppercase tracking-[0.12em] text-gray-600">Stock tags</span>
      <span className="font-mono text-[10px] text-gray-600">{ticker}</span>
      {isLoading ? (
        <span className="inline-flex items-center gap-1 rounded-md border border-white/10 bg-white/5 px-2 py-1 text-[11px] text-gray-500">
          <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
          Loading tags...
        </span>
      ) : (
        <div className="flex flex-wrap items-center gap-1.5">
          {staticTags.map((tag) => {
            const isActive = activeTagId === tag.id;
            return (
              <button
                key={tag.id}
                type="button"
                disabled={!canEdit || isSaving}
                onClick={() => {
                  void onSaveTag(tag.id);
                }}
                className={`rounded-md border px-2 py-1 text-[11px] font-semibold transition-colors ${
                  isActive
                    ? 'border-emerald-400/45 bg-emerald-500/15 text-emerald-200'
                    : 'border-white/10 bg-white/5 text-gray-300'
                } ${canEdit ? 'hover:border-white/20 hover:text-white' : 'cursor-default opacity-95'}`}
                aria-label={`${isActive ? 'Active' : 'Set'} tag ${tag.label} for ${ticker}`}
                title={canEdit ? `Set ${tag.label}` : `${tag.label}${isActive ? ' (active)' : ''}`}
              >
                {tag.label}
              </button>
            );
          })}
        </div>
      )}
      {isSaving ? (
        <span className="inline-flex items-center gap-1 text-[10px] text-emerald-300">
          <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
          Saving...
        </span>
      ) : null}
      {!canEdit ? (
        <span className="ml-auto text-[10px] text-gray-600">View only</span>
      ) : null}
      {!activeTagId && !isLoading ? (
        <span className="text-[10px] text-gray-500">No tag selected</span>
      ) : null}
      <div className="ml-auto" />
      <div className="hidden">
        {/* Keeps component layout stable in dense toolbars. */}
      </div>
    </div>
  );
}
