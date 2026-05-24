'use client';

import type { StockNewsItem } from '@/lib/ai/analyse-scan';
import { formatPublishedLabel } from '@/lib/news/fetch-tradingview-symbol-news';

type TradingViewNewsListProps = {
  items: StockNewsItem[];
  sections?: { id: string; title: string }[];
};

export function TradingViewNewsList({ items, sections }: TradingViewNewsListProps) {
  return (
    <div className="space-y-3">
      {sections && sections.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {sections.map((section) => (
            <span
              key={section.id}
              className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-gray-400"
            >
              {section.title}
            </span>
          ))}
        </div>
      ) : null}

      {items.length === 0 ? (
        <p className="text-sm text-gray-500">No TradingView headlines for this symbol.</p>
      ) : (
        <ul className="space-y-2.5">
          {items.map((item) => (
            <li key={item.id} className="rounded-xl border border-white/10 bg-[#10141c] p-3">
              <div className="flex flex-wrap items-center gap-2 text-[10px] uppercase tracking-wide text-gray-500">
                <span>{formatPublishedLabel(item.published)}</span>
                {item.sourceHint ? (
                  <>
                    <span aria-hidden>·</span>
                    <span>{item.sourceHint}</span>
                  </>
                ) : null}
              </div>
              {item.link ? (
                <a
                  href={item.link}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-1 block text-[13px] font-semibold leading-snug text-blue-300 hover:underline"
                >
                  {item.title}
                </a>
              ) : (
                <p className="mt-1 text-[13px] font-semibold leading-snug text-gray-100">{item.title}</p>
              )}
            </li>
          ))}
        </ul>
      )}

      <p className="text-[10px] text-gray-600">
        Live feed via TradingView — {items.length} headline{items.length === 1 ? '' : 's'}.
      </p>
    </div>
  );
}
