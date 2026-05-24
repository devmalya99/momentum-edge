'use client';

import React from 'react';
import { ExternalLink } from 'lucide-react';
import type { StockNewsSearchResult } from '@/lib/ai/stock-news-search';

function renderInlineMarkdown(text: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  const pattern = /(\*\*[^*]+\*\*|\[[^\]]+\]\([^)]+\))/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index));
    }
    const token = match[0];
    if (token.startsWith('**')) {
      nodes.push(
        <strong key={`${match.index}-bold`} className="font-semibold text-gray-100">
          {token.slice(2, -2)}
        </strong>,
      );
    } else {
      const linkMatch = token.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
      if (linkMatch) {
        nodes.push(
          <a
            key={`${match.index}-link`}
            href={linkMatch[2]}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-400 underline-offset-2 hover:underline"
          >
            {linkMatch[1]}
          </a>,
        );
      } else {
        nodes.push(token);
      }
    }
    lastIndex = match.index + token.length;
  }

  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }

  return nodes.length > 0 ? nodes : [text];
}

function MarkdownSection({ body }: { body: string }) {
  const lines = body
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  return (
    <ul className="space-y-2.5">
      {lines.map((line, index) => {
        const bullet = line.replace(/^[-*]\s+/, '').trim();
        if (!bullet) return null;
        return (
          <li
            key={`${index}-${bullet.slice(0, 24)}`}
            className="flex gap-2.5 text-[13px] leading-relaxed text-gray-300"
          >
            <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-blue-400/80" />
            <span>{renderInlineMarkdown(bullet)}</span>
          </li>
        );
      })}
    </ul>
  );
}

export function StockNewsSearchSections({ result }: { result: StockNewsSearchResult }) {
  return (
    <div className="space-y-5">
      <section className="rounded-xl border border-white/10 bg-[#10141c] p-3.5">
        <h3 className="mb-3 text-[11px] font-bold uppercase tracking-widest text-blue-300">
          Latest News & Updates
        </h3>
        <MarkdownSection body={result.sections.latestNews} />
      </section>

      <section className="rounded-xl border border-white/10 bg-[#10141c] p-3.5">
        <h3 className="mb-3 text-[11px] font-bold uppercase tracking-widest text-cyan-300">
          Upcoming Events
        </h3>
        <MarkdownSection body={result.sections.upcomingEvents} />
      </section>

      {(result.sources.length > 0 || result.meta.webSearchQueries.length > 0) && (
        <section className="rounded-xl border border-white/10 bg-white/[0.02] p-3.5">
          <h3 className="mb-3 text-[10px] font-bold uppercase tracking-widest text-gray-500">
            Sources
          </h3>
          {result.meta.webSearchQueries.length > 0 ? (
            <p className="mb-3 text-[10px] text-gray-500">
              Searches: {result.meta.webSearchQueries.join(' · ')}
            </p>
          ) : null}
          {result.sources.length > 0 ? (
            <ul className="space-y-1.5">
              {result.sources.map((source) => (
                <li key={source.uri}>
                  <a
                    href={source.uri}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-[11px] text-blue-400 hover:text-blue-300"
                  >
                    <ExternalLink size={12} />
                    <span className="truncate">{source.title}</span>
                  </a>
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      )}

      <p className="text-[10px] text-gray-600">
        Generated {new Date(result.meta.generatedAt).toLocaleString()} · cached until{' '}
        {new Date(result.meta.cacheExpiresAt).toLocaleString()} · Gemini + Google Search · Not
        investment advice.
      </p>
    </div>
  );
}
