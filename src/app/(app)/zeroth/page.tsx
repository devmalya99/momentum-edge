'use client';

import { useQuery } from '@tanstack/react-query';

type GttOrder = {
  transaction_type?: string;
  quantity?: number;
  price?: number;
};

type GttCondition = {
  exchange?: string;
  tradingsymbol?: string;
  trigger_values?: number[];
  last_price?: number;
};

type GttTrigger = {
  id?: number;
  type?: string;
  status?: string;
  created_at?: string;
  condition?: GttCondition;
  orders?: GttOrder[];
};

type GttTriggersResponse = {
  triggers?: GttTrigger[];
  error?: string;
};

export default function ZerothPage() {
  const triggersQuery = useQuery({
    queryKey: ['zerodha-gtt-triggers', 'single'],
    queryFn: async () => {
      const response = await fetch('/api/zerodha/gtt-triggers?type=single', { cache: 'no-store' });
      const data = (await response.json()) as GttTriggersResponse;
      if (!response.ok) {
        throw new Error(data.error ?? 'Failed to fetch GTT triggers');
      }
      return data.triggers ?? [];
    },
  });

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight text-white">Zeroth</h1>
        <p className="mt-2 text-sm text-gray-400">
          Live Kite GTT trigger list (`type=single`) from your connected broker account.
        </p>
      </header>

      {triggersQuery.isLoading ? <p className="text-sm text-gray-400">Loading GTT triggers...</p> : null}
      {triggersQuery.error ? (
        <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-300">
          {triggersQuery.error instanceof Error
            ? triggersQuery.error.message
            : 'Failed to fetch GTT triggers.'}
        </div>
      ) : null}

      {!triggersQuery.isLoading && !triggersQuery.error && (triggersQuery.data?.length ?? 0) === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-gray-300">
          No `single` GTT triggers found in this Kite account.
        </div>
      ) : null}

      {(triggersQuery.data?.length ?? 0) > 0 ? (
        <div className="overflow-x-auto rounded-2xl border border-white/10 bg-[#0f1117]">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-white/5 text-xs uppercase tracking-wide text-gray-400">
              <tr>
                <th className="px-4 py-3">ID</th>
                <th className="px-4 py-3">Symbol</th>
                <th className="px-4 py-3">Exchange</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Trigger Values</th>
                <th className="px-4 py-3">Order</th>
                <th className="px-4 py-3">Created</th>
              </tr>
            </thead>
            <tbody>
              {triggersQuery.data?.map((trigger) => {
                const order = trigger.orders?.[0];
                return (
                  <tr key={trigger.id ?? `${trigger.condition?.tradingsymbol}-${trigger.created_at}`}>
                    <td className="border-t border-white/5 px-4 py-3 text-gray-200">{trigger.id ?? '-'}</td>
                    <td className="border-t border-white/5 px-4 py-3 text-white">
                      {trigger.condition?.tradingsymbol ?? '-'}
                    </td>
                    <td className="border-t border-white/5 px-4 py-3 text-gray-300">
                      {trigger.condition?.exchange ?? '-'}
                    </td>
                    <td className="border-t border-white/5 px-4 py-3 text-gray-300">
                      {trigger.status ?? '-'}
                    </td>
                    <td className="border-t border-white/5 px-4 py-3 text-gray-300">
                      {Array.isArray(trigger.condition?.trigger_values) &&
                      trigger.condition.trigger_values.length > 0
                        ? trigger.condition.trigger_values.join(', ')
                        : '-'}
                    </td>
                    <td className="border-t border-white/5 px-4 py-3 text-gray-300">
                      {order ? `${order.transaction_type ?? '-'} ${order.quantity ?? '-'} @ ${order.price ?? '-'}` : '-'}
                    </td>
                    <td className="border-t border-white/5 px-4 py-3 text-gray-400">
                      {trigger.created_at ?? '-'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
