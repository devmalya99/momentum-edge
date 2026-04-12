'use client';

import { create } from 'zustand';
import {
  parseZerodhaPnLXlsx,
  computeBasicPnLMetrics,
  computeChargesAnalysis,
  buildPnLInterpretations,
  buildInsights,
  computeHealthScore,
  computeProgressDeltas,
} from '@/analytics';
import type { BrokerSnapshot, BrokerSnapshotMetrics, ParsedPnL } from '@/analytics/types';
import { openTraderAnalyticsDB } from '@/db/traderAnalyticsDb';
import { buildPnlIndexedRecord } from '@/db/pnlIndexedRecord';

/** Optional server sync when `/api/trader-analytics/import` exists; otherwise no-op. */
async function pushSnapshotToNeon(
  snapshot: BrokerSnapshot,
  raw: { pnl?: { fileName: string; parsed: ParsedPnL } },
): Promise<void> {
  try {
    const res = await fetch('/api/trader-analytics/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ snapshot, trades: [], raw }),
    });
    if (!res.ok) return;
  } catch {
    return;
  }
}

interface TraderAnalyticsState {
  snapshots: BrokerSnapshot[];
  activeSnapshotId: string | null;
  isBusy: boolean;
  lastError: string | null;

  hydrate: () => Promise<void>;
  setActiveSnapshot: (id: string | null) => void;
  runImport: (pnl: File) => Promise<void>;
  deleteSnapshot: (id: string) => Promise<void>;
}

function buildMetrics(parsedPnL: ParsedPnL): BrokerSnapshotMetrics | null {
  const basic = computeBasicPnLMetrics(parsedPnL);
  if (!basic) return null;
  const charges = computeChargesAnalysis(parsedPnL, basic);
  const pnlInterpretations = buildPnLInterpretations(basic, charges);

  const base: BrokerSnapshotMetrics = {
    basicPnL: basic,
    charges,
    pnlInterpretations,
    tradebook: null,
    insights: buildInsights(basic, charges, null),
    health: { score: 0, category: 'Beginner', breakdown: [] },
    progress: [],
  };

  base.health = computeHealthScore(base);
  return base;
}

export const useTraderAnalyticsStore = create<TraderAnalyticsState>((set, get) => ({
  snapshots: [],
  activeSnapshotId: null,
  isBusy: false,
  lastError: null,

  hydrate: async () => {
    const db = await openTraderAnalyticsDB();
    const idbAll = await db.getAll('history');
    idbAll.sort((a, b) => b.createdAt - a.createdAt);

    let merged: BrokerSnapshot[] = idbAll;
    try {
      const res = await fetch('/api/trader-analytics/snapshots', { cache: 'no-store' });
      if (res.ok) {
        const data = (await res.json()) as { ok?: boolean; snapshots?: BrokerSnapshot[] };
        if (data.ok && Array.isArray(data.snapshots)) {
          const byId = new Map<string, BrokerSnapshot>();
          for (const s of idbAll) byId.set(s.id, s);
          for (const s of data.snapshots) byId.set(s.id, s);
          merged = [...byId.values()].sort((a, b) => b.createdAt - a.createdAt);
        }
      }
    } catch {
      /* offline or API unavailable — IndexedDB only */
    }

    set({
      snapshots: merged,
      activeSnapshotId: merged[0]?.id ?? null,
    });
  },

  setActiveSnapshot: (id) => set({ activeSnapshotId: id }),

  deleteSnapshot: async (id) => {
    try {
      await fetch(`/api/trader-analytics/snapshots/${encodeURIComponent(id)}`, { method: 'DELETE' });
    } catch {
      /* Neon optional */
    }
    const db = await openTraderAnalyticsDB();
    const [uploads, trades, metrics, hist] = await Promise.all([
      db.getAll('uploads'),
      db.getAll('trades'),
      db.get('metrics', id),
      db.get('history', id),
    ]);
    const tx = db.transaction(['history', 'trades', 'uploads', 'metrics', 'pnl_records'], 'readwrite');
    for (const u of uploads.filter((x) => x.snapshotId === id)) {
      await tx.objectStore('uploads').delete(u.id);
    }
    for (const t of trades.filter((x) => x.snapshotId === id)) {
      await tx.objectStore('trades').delete(t.id);
    }
    if (metrics) await tx.objectStore('metrics').delete(id);
    if (hist) await tx.objectStore('history').delete(id);
    await tx.objectStore('pnl_records').delete(id);
    await tx.done;
    await get().hydrate();
  },

  runImport: async (pnl) => {
    set({ isBusy: true, lastError: null });
    try {
      if (!pnl) {
        set({ lastError: 'Choose a P&L file (.xlsx).' });
        return;
      }

      const buf = await pnl.arrayBuffer();
      const parsedPnL = parseZerodhaPnLXlsx(buf);
      if (parsedPnL.errors.length) {
        set({ lastError: parsedPnL.errors.join(' ') });
        return;
      }

      const metrics = buildMetrics(parsedPnL);
      if (!metrics) {
        set({ lastError: 'P&L file has no usable symbol rows.' });
        return;
      }
      const prev = get().snapshots[0] ?? null;

      const id = crypto.randomUUID();
      const createdAt = Date.now();
      const importWarnings = [...(parsedPnL.warnings ?? [])];
      const snapshot: BrokerSnapshot = {
        id,
        createdAt,
        periodFrom: parsedPnL.summary.periodFrom,
        periodTo: parsedPnL.summary.periodTo,
        pnlFileName: pnl.name,
        metrics: { ...metrics, progress: [] },
        symbolRowCount: parsedPnL.symbolRows.length,
        pnlSymbolRows: parsedPnL.symbolRows.length
          ? parsedPnL.symbolRows.map((r) => ({ symbol: r.symbol, realizedPnL: r.realizedPnL }))
          : undefined,
        importWarnings: importWarnings.length ? importWarnings : undefined,
      };

      snapshot.metrics.progress = computeProgressDeltas(prev, snapshot);
      snapshot.metrics.health = computeHealthScore(snapshot.metrics);

      const pnlIndexed = buildPnlIndexedRecord(parsedPnL);

      const db = await openTraderAnalyticsDB();
      const tx = db.transaction(['history', 'trades', 'uploads', 'metrics', 'pnl_records'], 'readwrite');

      await tx.objectStore('pnl_records').put(pnlIndexed, id);

      await tx.objectStore('metrics').put({
        id,
        snapshotId: id,
        createdAt,
        metricsJson: JSON.stringify(snapshot.metrics),
      });

      await tx.objectStore('history').put(snapshot);
      await tx.done;

      await pushSnapshotToNeon(snapshot, {
        pnl: { fileName: pnl.name, parsed: parsedPnL },
      });

      await get().hydrate();
      set({ activeSnapshotId: id });
    } finally {
      set({ isBusy: false });
    }
  },
}));
