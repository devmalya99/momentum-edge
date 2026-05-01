'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

type AllocatedTradingCapitalResponse = {
  allocatedTradingCapital: number;
};

export function useAllocatedTradingCapitalQuery() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['settings', 'allocated-trading-capital'],
    queryFn: async (): Promise<number | null> => {
      const res = await fetch('/api/settings/allocated-trading-capital', { cache: 'no-store' });
      if (res.status === 401) return null;
      if (!res.ok) throw new Error('Failed to load allocated trading capital');
      const body = (await res.json()) as AllocatedTradingCapitalResponse;
      const v = Number(body.allocatedTradingCapital);
      return Number.isFinite(v) && v > 0 ? v : 0;
    },
    retry: 1,
  });

  const saveMutation = useMutation({
    mutationFn: async (allocatedTradingCapital: number) => {
      const res = await fetch('/api/settings/allocated-trading-capital', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ allocatedTradingCapital }),
      });
      const body = (await res.json().catch(() => null)) as
        | { ok?: boolean; error?: string; allocatedTradingCapital?: number }
        | null;
      if (!res.ok || !body?.ok) {
        throw new Error(body?.error ?? 'Failed to save allocated trading capital');
      }
      const v = Number(body.allocatedTradingCapital);
      return Number.isFinite(v) && v > 0 ? v : 0;
    },
    onSuccess: (nextValue) => {
      queryClient.setQueryData(['settings', 'allocated-trading-capital'], nextValue);
    },
  });

  return { query, saveMutation };
}
