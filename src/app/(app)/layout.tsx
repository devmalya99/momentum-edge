'use client';

import { useEffect } from 'react';
import Layout from '@/components/Layout';
import { QueryProvider } from '@/components/QueryProvider';
import { useTradeStore } from '@/store/useTradeStore';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { fetchData, isLoading } = useTradeStore();

  useEffect(() => {
    const controller = new AbortController();
    void fetch('/api/ad-ratio/sync-on-load', {
      method: 'POST',
      cache: 'no-store',
      signal: controller.signal,
    }).catch(() => {
      // Ignore startup sync errors: app should remain usable.
    });

    return () => controller.abort();
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0a0a0b] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin" />
          <span className="text-sm font-bold text-gray-500 uppercase tracking-widest">
            Initializing Edge...
          </span>
        </div>
      </div>
    );
  }

  return (
    <QueryProvider>
      <Layout>{children}</Layout>
    </QueryProvider>
  );
}
