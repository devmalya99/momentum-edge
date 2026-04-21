'use client';

import { useEffect, useMemo, useState } from 'react';
import { Check, ChevronDown, Loader2 } from 'lucide-react';

type StockTag = { id: string; label: string; sortOrder: number };

export function stockTagBadgeClass(tagId: string): string {
  if (tagId === 'favourite') return 'border-emerald-400/35 bg-emerald-500/10 text-emerald-200';
  if (tagId === 'interesting') return 'border-blue-400/35 bg-blue-500/10 text-blue-200';
  if (tagId === 'investment-grade') return 'border-violet-400/35 bg-violet-500/10 text-violet-200';
  if (tagId === 'swing-trade') return 'border-cyan-400/35 bg-cyan-500/10 text-cyan-200';
  if (tagId === 'no-momentum') return 'border-amber-400/35 bg-amber-500/10 text-amber-200';
  if (tagId === 'no-trend') return 'border-orange-400/35 bg-orange-500/10 text-orange-200';
  if (tagId === 'too-big-to-move') return 'border-gray-400/35 bg-gray-500/10 text-gray-200';
  if (tagId === '1y-top') return 'border-indigo-400/35 bg-indigo-500/10 text-indigo-200';
  if (tagId === 'add-on-dip') return 'border-teal-400/35 bg-teal-500/10 text-teal-200';
  return 'border-white/10 bg-white/5 text-gray-300';
}

export function compactStockTagLabel(label: string): string {
  if (label === 'Investment Grade') return 'Invest Grade';
  if (label === 'Too big to move') return 'Big to move';
  return label;
}

export default function TechnicalChartScoreControl(props: {
  ticker: string;
  staticTags: StockTag[];
  selectedTagIds: string[];
  onSaveTags: (tagIds: string[]) => void | Promise<void>;
  isSaving?: boolean;
  isLoading?: boolean;
}) {
  const { ticker, staticTags, selectedTagIds, onSaveTags, isSaving = false, isLoading = false } = props;
  const [isOpen, setIsOpen] = useState(false);
  const [draftTagIds, setDraftTagIds] = useState<string[]>(selectedTagIds);

  useEffect(() => {
    setDraftTagIds(selectedTagIds);
  }, [selectedTagIds]);

  const selectedTagSet = useMemo(() => new Set(draftTagIds), [draftTagIds]);
  const selectedLabel = useMemo(() => {
    if (draftTagIds.length === 0) return 'No tags';
    if (draftTagIds.length === 1) {
      const one = staticTags.find((tag) => tag.id === draftTagIds[0]);
      return one?.label ?? '1 tag';
    }
    return `${draftTagIds.length} tags`;
  }, [draftTagIds, staticTags]);

  return (
    <div className="mb-2 flex flex-wrap items-center gap-2 rounded-xl border border-white/10 bg-[#0a0a0b] px-2.5 py-2">
      <span className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Stock tags</span>
      <span className="font-mono text-[10px] text-gray-500">{ticker}</span>

      <div className="relative">
        <button
          type="button"
          onClick={() => setIsOpen((prev) => !prev)}
          disabled={isLoading}
          className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-black/20 px-2 py-1 text-[11px] font-semibold text-gray-100 transition-colors hover:border-white/20 disabled:opacity-60"
        >
          {isLoading ? (
            <span className="inline-flex items-center gap-1 text-gray-400">
              <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
              Loading tags...
            </span>
          ) : (
            <span>{selectedLabel}</span>
          )}
          <ChevronDown className="h-3 w-3 text-gray-500" aria-hidden />
        </button>
        {isOpen && !isLoading ? (
          <div className="absolute left-0 top-full z-20 mt-1 w-56 rounded-xl border border-white/10 bg-[#121214] p-2 shadow-xl">
            <div className="max-h-56 space-y-1 overflow-auto pr-1">
              {staticTags.map((tag) => {
                const checked = selectedTagSet.has(tag.id);
                return (
                  <label
                    key={tag.id}
                    className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1 text-[11px] text-gray-200 hover:bg-white/5"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) => {
                        setDraftTagIds((prev) => {
                          if (e.target.checked) return [...prev, tag.id];
                          return prev.filter((id) => id !== tag.id);
                        });
                      }}
                      className="h-3.5 w-3.5 rounded border-white/20 bg-transparent"
                    />
                    <span>{tag.label}</span>
                  </label>
                );
              })}
            </div>
            <div className="mt-2 flex items-center justify-end border-t border-white/10 pt-2">
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="rounded-md px-2 py-1 text-[10px] font-semibold text-gray-400 hover:text-gray-200"
              >
                Close
              </button>
            </div>
          </div>
        ) : null}
      </div>

      <div className="flex items-center gap-1 rounded-lg border border-white/10 bg-black/20 px-1 py-1">
          <button
            type="button"
            disabled={isSaving || isLoading}
            onClick={() => {
              void onSaveTags(Array.from(new Set(draftTagIds)));
            }}
            className="inline-flex h-5 w-5 items-center justify-center rounded-md border border-emerald-400/35 bg-emerald-500/20 text-emerald-100 transition-colors hover:bg-emerald-500/30 disabled:cursor-not-allowed disabled:opacity-40"
            aria-label={`Save stock tags for ${ticker}`}
            title="Save tags"
          >
            {isSaving ? <Loader2 className="h-3 w-3 animate-spin" aria-hidden /> : <Check className="h-3 w-3" aria-hidden />}
          </button>
      </div>

      <span className="ml-auto text-[10px] text-gray-500">{draftTagIds.length} selected</span>
    </div>
  );
}
