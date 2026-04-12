import type { MetricTone } from '@/analytics/types';
import { clsx } from 'clsx';

const toneClass: Record<MetricTone, string> = {
  strong: 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.45)]',
  acceptable: 'bg-sky-500 shadow-[0_0_10px_rgba(14,165,233,0.35)]',
  weak: 'bg-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.4)]',
};

export function ToneDot({ tone }: { tone: MetricTone }) {
  return <span className={clsx('inline-block w-2 h-2 rounded-full', toneClass[tone])} title={tone} />;
}

export function toneBorder(tone: MetricTone): string {
  if (tone === 'strong') return 'border-emerald-500/25';
  if (tone === 'acceptable') return 'border-sky-500/20';
  return 'border-rose-500/25';
}
