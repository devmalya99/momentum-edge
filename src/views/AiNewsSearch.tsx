'use client';

import React, { useCallback, useState } from 'react';
import { AlertCircle, Loader2, Search, Sparkles } from 'lucide-react';
import { motion } from 'motion/react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { StockNewsSearchSections } from '@/components/ai/StockNewsSearchSections';
import {
  useRefreshStockNewsSearch,
  useStockNewsSearchQuery,
} from '@/features/ai/useStockNewsSearchQuery';

export default function AiNewsSearch() {
  const [query, setQuery] = useState('');
  const [submittedQuery, setSubmittedQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const refreshStockNewsSearch = useRefreshStockNewsSearch();

  const q = useStockNewsSearchQuery(submittedQuery, {
    enabled: submittedQuery.length > 0,
  });

  const handleSearch = useCallback(() => {
    const trimmed = query.trim();
    if (!trimmed) return;
    setSubmittedQuery(trimmed);
  }, [query]);

  const handleRefresh = async () => {
    if (!submittedQuery) return;
    setRefreshing(true);
    try {
      await refreshStockNewsSearch(submittedQuery);
    } finally {
      setRefreshing(false);
    }
  };

  const loading = q.isFetching || refreshing;

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
      <header className="space-y-2">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/10 text-blue-400">
            <Sparkles size={20} />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-gray-100">AI News Search</h1>
            <p className="text-sm text-gray-400">
              Grounded market news and upcoming corporate events via Gemini + Google Search.
            </p>
          </div>
        </div>
      </header>

      <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
        <form
          className="flex flex-col gap-3 sm:flex-row"
          onSubmit={(event) => {
            event.preventDefault();
            handleSearch();
          }}
        >
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Enter stock ticker or company name (e.g. RELIANCE, TCS, HDFCBANK)"
            className="h-11 border-white/10 bg-black/20 text-gray-100 placeholder:text-gray-500"
            disabled={loading}
            aria-label="Stock name or ticker"
          />
          <Button
            type="submit"
            disabled={loading || !query.trim()}
            className="h-11 shrink-0 gap-2 bg-blue-500 px-5 text-white hover:bg-blue-500/90"
          >
            {loading ? <Loader2 className="animate-spin" size={16} /> : <Search size={16} />}
            {loading ? 'Searching…' : 'Search News'}
          </Button>
        </form>
      </section>

      {q.isError ? (
        <motion.div className="flex items-start gap-3 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          <AlertCircle size={18} className="mt-0.5 shrink-0" />
          <p>{q.error instanceof Error ? q.error.message : 'Failed to fetch news'}</p>
        </motion.div>
      ) : null}

      {submittedQuery && q.isLoading ? (
        <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.02] px-4 py-6 text-sm text-gray-400">
          <Loader2 className="animate-spin text-blue-400" size={18} />
          Searching live web sources and synthesizing structured updates…
        </div>
      ) : null}

      {q.data ? (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
          <div className="flex justify-end">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={loading}
              onClick={() => void handleRefresh()}
              className="border-white/10 text-gray-300"
            >
              {loading ? <Loader2 className="animate-spin" size={14} /> : null}
              Refresh
            </Button>
          </div>
          <StockNewsSearchSections result={q.data} />
        </motion.div>
      ) : null}
    </motion.div>
  );
}
