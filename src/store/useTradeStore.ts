import { create } from 'zustand';
import { Rule, Trade, Settings, WatchlistItem, WatchlistList, initDB } from '../db';
import { DEFAULT_WATCHLIST_LIST_ID } from '@/lib/watchlist-defaults';

// Use crypto.randomUUID for unique IDs
const generateId = () => crypto.randomUUID();

async function syncWatchlistItemToServer(item: WatchlistItem): Promise<void> {
  try {
    await fetch('/api/watchlist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ item }),
    });
  } catch {
    /* keep local write; sync later */
  }
}

async function deleteWatchlistItemFromServer(id: string): Promise<void> {
  try {
    await fetch('/api/watchlist', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
  } catch {
    /* keep local delete; sync later */
  }
}

async function syncHoldingsTradeTypeToServer(symbol: string, tradeType: string | null): Promise<void> {
  try {
    await fetch('/api/holdings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        symbol: symbol.trim().toUpperCase(),
        tradeType: tradeType ?? null,
      }),
    });
  } catch {
    /* offline; local trade row still updated */
  }
}

interface TradeState {
  trades: Trade[];
  rules: Rule[];
  settings: Settings;
  watchlistLists: WatchlistList[];
  watchlist: WatchlistItem[];
  isLoading: boolean;
  
  // Actions
  fetchData: () => Promise<void>;
  addTrade: (trade: Omit<Trade, 'id' | 'entryDate'>) => Promise<void>;
  addTrades: (tradesData: Omit<Trade, 'id' | 'entryDate'>[]) => Promise<void>;
  replaceImportedHoldings: (tradesData: Omit<Trade, 'id' | 'entryDate'>[]) => Promise<void>;
  updateTrade: (id: string, updates: Partial<Trade>) => Promise<void>;
  deleteTrade: (id: string) => Promise<void>;
  
  addRule: (rule: Omit<Rule, 'id'>) => Promise<void>;
  updateRule: (id: string, updates: Partial<Rule>) => Promise<void>;
  deleteRule: (id: string) => Promise<void>;
  
  updateSettings: (updates: Partial<Settings>) => Promise<void>;
  addToWatchlist: (item: Omit<WatchlistItem, 'addedAt' | 'id'> & { id?: string }) => Promise<void>;
  addManyToWatchlist: (items: Array<Omit<WatchlistItem, 'addedAt' | 'id'> & { id?: string }>) => Promise<void>;
  removeFromWatchlist: (id: string) => Promise<void>;
  toggleWatchlist: (item: Omit<WatchlistItem, 'addedAt' | 'id'> & { id?: string }) => Promise<void>;
  createWatchlistList: (name: string) => Promise<void>;
  renameWatchlistList: (listId: string, name: string) => Promise<void>;
  deleteWatchlistList: (listId: string) => Promise<void>;
}

const DEFAULT_RULES: Omit<Rule, 'id'>[] = [
  { name: 'Strong prior rally exists', category: 'Structure', maxScore: 10, enabled: true },
  { name: 'Clean consolidation (tight base)', category: 'Structure', maxScore: 10, enabled: true },
  { name: 'Breakout near resistance', category: 'Structure', maxScore: 10, enabled: true },
  { name: 'Price above 20 > 50 > 100 EMA', category: 'Trend', maxScore: 10, enabled: true },
  { name: 'Higher timeframe uptrend', category: 'Trend', maxScore: 10, enabled: true },
  { name: 'Volume contraction → expansion', category: 'Confirmation', maxScore: 10, enabled: true },
  { name: 'Strong breakout candle', category: 'Confirmation', maxScore: 10, enabled: true },
  { name: 'No major bearish divergence', category: 'Context', maxScore: 10, enabled: true },
  { name: 'Relative strength vs market', category: 'Context', maxScore: 10, enabled: true },
  { name: 'Market breadth strength (A/D)', category: 'Context', maxScore: 10, enabled: true },
];

export const IMPORTED_HOLDINGS_NOTE = 'Imported from broker holdings upload.';

export function isImportedHoldingTrade(trade: Trade): boolean {
  return trade.notes === IMPORTED_HOLDINGS_NOTE;
}

export const useTradeStore = create<TradeState>((set, get) => ({
  trades: [],
  rules: [],
  settings: { 
    id: 'global', 
    totalCapital: 100000, 
    riskPerTradePercent: 1,
    tradeTypes: [],
    networthAssets: [],
    brokerMarginUsed: 0,
  },
  watchlistLists: [],
  watchlist: [],
  isLoading: true,

  fetchData: async () => {
    const db = await initDB();
    let trades = await db.getAll('trades');
    let rules = await db.getAll('rules');
    let settings = await db.get('settings', 'global');
    let watchlistLists = (await db.getAll('watchlistLists')).sort(
      (a, b) => a.sortOrder - b.sortOrder || a.createdAt - b.createdAt,
    );
    let watchlist = (await db.getAll('watchlist')).sort((a, b) => b.addedAt - a.addedAt);

    if (rules.length === 0) {
      for (const r of DEFAULT_RULES) {
        const rule = { ...r, id: generateId() };
        await db.put('rules', rule);
      }
      rules = await db.getAll('rules');
    } else {
      // Check for missing default rules and add them (Migration)
      for (const dr of DEFAULT_RULES) {
        if (!rules.find(r => r.name === dr.name)) {
          const rule = { ...dr, id: generateId() };
          await db.put('rules', rule);
        }
      }
      rules = await db.getAll('rules');
    }

    const DEFAULT_TRADE_TYPES = [
      { id: generateId(), name: 'Buy & Forget', description: 'Long term hold', minHoldingPeriod: '3 months', expectedReturn: '50-100%' },
      { id: generateId(), name: 'Momentum', description: 'Trend following based on price action', minHoldingPeriod: '2-4 weeks', expectedReturn: '15-30%' },
      { id: generateId(), name: 'VCP', description: 'Volatility Contraction Pattern breakout', minHoldingPeriod: '1-3 weeks', expectedReturn: '10-25%' },
      { id: generateId(), name: '20 EMA pull back', description: 'Buying the dip in an uptrend', minHoldingPeriod: '1-2 weeks', expectedReturn: '5-15%' }
    ];

    if (!settings) {
      settings = { 
        id: 'global', 
        totalCapital: 100000, 
        riskPerTradePercent: 1,
        tradeTypes: DEFAULT_TRADE_TYPES,
        brokerMarginUsed: 0,
        networthAssets: [
          { id: generateId(), name: 'Bank Balance', value: 0 },
          { id: generateId(), name: 'Stocks', value: 0 },
        ]
      };
      await db.put('settings', settings);
    } else {
      // Migrate old settings
      let updated = false;
      if (!settings.tradeTypes) {
        settings.tradeTypes = DEFAULT_TRADE_TYPES;
        updated = true;
      }
      if (!settings.networthAssets) {
        settings.networthAssets = [
          { id: generateId(), name: 'Bank Balance', value: 0 },
          { id: generateId(), name: 'Stocks', value: 0 },
        ];
        updated = true;
      }
      if (typeof settings.brokerMarginUsed !== 'number' || !Number.isFinite(settings.brokerMarginUsed)) {
        settings.brokerMarginUsed = 0;
        updated = true;
      }
      if (updated) {
        await db.put('settings', settings);
      }
    }

    try {
      const masterRes = await fetch('/api/networth/master', { cache: 'no-store' });
      if (masterRes.ok) {
        const masterPayload = (await masterRes.json()) as {
          master?: { marginAmount?: number };
        };
        const serverMargin = Number(masterPayload.master?.marginAmount);
        settings.brokerMarginUsed = Number.isFinite(serverMargin) && serverMargin > 0 ? serverMargin : 0;
      }
    } catch {
      /* offline or unauthenticated */
    }

    try {
      const res = await fetch('/api/holdings', { cache: 'no-store' });
      if (res.ok) {
        const payload = (await res.json()) as {
          holdings?: Array<{
            symbol: string;
            quantity: number;
            average_price: number;
            previous_close_price: number;
            trade_type?: string | null;
          }>;
        };
        const serverRows = Array.isArray(payload.holdings) ? payload.holdings : [];
        const defaultType = settings.tradeTypes?.[0]?.name || 'Buy & Forget';
        
        const importedTrades: Trade[] = serverRows.map((row, idx) => {
          const id = `holding-${row.symbol.trim().toUpperCase()}`;
          const localTrade = trades.find(t => t.id === id);
          
          return {
            id,
            symbol: row.symbol,
            type:
              typeof row.trade_type === 'string' && row.trade_type.trim()
                ? row.trade_type.trim()
                : (localTrade?.type || defaultType),
            entryPrice: Number(row.average_price) || 0,
            currentPrice: Number(row.previous_close_price) || Number(row.average_price) || 0,
            stopLoss: (localTrade?.stopLoss) || (Number(row.average_price) || 0) * 0.9,
            positionSize: Number(row.quantity) || 0,
            status: 'Active',
            entryDate: localTrade?.entryDate || (Date.now() + idx),
            ruleScores: localTrade?.ruleScores || {},
            totalScore: localTrade?.totalScore || 0,
            maxPossibleScore: localTrade?.maxPossibleScore || 0,
            scorePercentage: localTrade?.scorePercentage || 0,
            verdict: localTrade?.verdict || 'B',
            checklist: localTrade?.checklist || {
              priorRally: false,
              tightBase: false,
              breakoutLevel: false,
              volumeConfirmation: false,
              emaAlignment: false,
              relativeStrength: false,
            },
            notes: IMPORTED_HOLDINGS_NOTE,
            mistakes: localTrade?.mistakes || [],
          };
        });

        const retainedTrades = trades.filter((trade) => !isImportedHoldingTrade(trade));
        trades = [...importedTrades, ...retainedTrades];
      }
    } catch {
      /* offline or unauthenticated */
    }

    try {
      const res = await fetch('/api/watchlist', { cache: 'no-store' });
      if (res.ok) {
        const payload = (await res.json()) as {
          lists?: Array<{
            id: string;
            name: string;
            sortOrder: number;
            createdAt: number;
          }>;
          watchlist?: Array<{
            id: string;
            listId: string;
            kind: 'equity' | 'index';
            symbol: string;
            companyName: string;
            addedAt: number;
          }>;
        };

        const serverRows = Array.isArray(payload.watchlist) ? payload.watchlist : [];
        let serverLists = Array.isArray(payload.lists) ? payload.lists : [];

        watchlist = serverRows
          .map((row) => ({
            id: String(row.id ?? ''),
            listId: String(row.listId ?? DEFAULT_WATCHLIST_LIST_ID),
            kind: row.kind === 'index' ? ('index' as const) : ('equity' as const),
            symbol: String(row.symbol ?? '').trim().toUpperCase(),
            companyName: String(row.companyName ?? '').trim(),
            addedAt: Number(row.addedAt) || Date.now(),
          }))
          .filter((item) => item.id && item.symbol && item.companyName)
          .sort((a, b) => b.addedAt - a.addedAt);

        if (serverLists.length === 0 && watchlist.length > 0) {
          serverLists = [
            {
              id: DEFAULT_WATCHLIST_LIST_ID,
              name: 'Main',
              sortOrder: 0,
              createdAt: Date.now(),
            },
          ];
          watchlist = watchlist.map((w) => ({ ...w, listId: DEFAULT_WATCHLIST_LIST_ID }));
        }

        watchlistLists = serverLists
          .map((row) => ({
            id: String(row.id ?? ''),
            name: String(row.name ?? '').trim() || 'Untitled',
            sortOrder: Number(row.sortOrder) || 0,
            createdAt: Number(row.createdAt) || Date.now(),
          }))
          .filter((l) => l.id && l.name)
          .sort((a, b) => a.sortOrder - b.sortOrder || a.createdAt - b.createdAt);

        const tx = db.transaction(['watchlist', 'watchlistLists'], 'readwrite');
        await tx.objectStore('watchlistLists').clear();
        await tx.objectStore('watchlist').clear();
        for (const list of watchlistLists) {
          await tx.objectStore('watchlistLists').put(list);
        }
        for (const item of watchlist) {
          await tx.objectStore('watchlist').put(item);
        }
        await tx.done;
      }
    } catch {
      /* offline or unauthenticated */
    }

    set({ 
      trades: trades.sort((a, b) => b.entryDate - a.entryDate), 
      rules, 
      settings, 
      watchlistLists,
      watchlist,
      isLoading: false 
    });
  },

  addTrade: async (tradeData) => {
    const db = await initDB();
    const trade: Trade = {
      ...tradeData,
      id: generateId(),
      entryDate: Date.now(),
    };
    await db.put('trades', trade);
    set((state) => ({ trades: [trade, ...state.trades] }));
  },

  addTrades: async (tradesData) => {
    const db = await initDB();
    const ts = Date.now();
    const newTrades: Trade[] = tradesData.map((data, idx) => ({
      ...data,
      id: generateId(),
      entryDate: ts + idx,
    }));
    
    const tx = db.transaction('trades', 'readwrite');
    for (const trade of newTrades) {
      await tx.store.put(trade);
    }
    await tx.done;
    
    set((state) => ({ 
      trades: [...newTrades, ...state.trades].sort((a, b) => b.entryDate - a.entryDate) 
    }));
  },

  replaceImportedHoldings: async (tradesData) => {
    const baseTimestamp = Date.now();
    const newTrades: Trade[] = tradesData.map((data, idx) => ({
      ...data,
      id: generateId(),
      entryDate: baseTimestamp + idx,
    }));

    set((state) => {
      const retained = state.trades.filter((trade) => !isImportedHoldingTrade(trade));
      return {
        trades: [...newTrades, ...retained].sort((a, b) => b.entryDate - a.entryDate),
      };
    });
  },

  updateTrade: async (id, updates) => {
    const currentState = get();
    const trade = currentState.trades.find((t) => t.id === id);
    
    if (!trade) {
      console.warn('[Store] Trade not found in memory:', id);
      return;
    }
    
    // Create the updated trade object
    const updatedTrade = { ...trade, ...updates };
    const isImported = isImportedHoldingTrade(updatedTrade);
    
    // 1. Optimistic UI Update - happens immediately
    set((state) => ({
      trades: state.trades.map((t) => (t.id === id ? updatedTrade : t)),
    }));

    // 2. Background Saving (Silent)
    if (!isImported) {
      const db = await initDB();
      await db.put('trades', updatedTrade);
    } else {
      if (updates.type !== undefined) {
        console.log(`[Store] 3. Syncing imported holding trade type to server. Symbol: ${updatedTrade.symbol}`);
        const t =
          typeof updates.type === 'string' ? (updates.type.trim() ? updates.type.trim() : null) : null;
        void syncHoldingsTradeTypeToServer(updatedTrade.symbol, t);
      } else {
        console.log('[Store] 3. Imported holding updated locally, but no server sync required for this field.');
      }
    }
    console.log('[Store] 4. updateTrade completed.');
  },

  deleteTrade: async (id) => {
    const db = await initDB();
    await db.delete('trades', id);
    set((state) => ({
      trades: state.trades.filter((t) => t.id !== id),
    }));
  },

  addRule: async (ruleData) => {
    const db = await initDB();
    const rule: Rule = { ...ruleData, id: generateId() };
    await db.put('rules', rule);
    set((state) => ({ rules: [...state.rules, rule] }));
  },

  updateRule: async (id, updates) => {
    const db = await initDB();
    const rule = await db.get('rules', id);
    if (!rule) return;
    const updatedRule = { ...rule, ...updates };
    await db.put('rules', updatedRule);
    set((state) => ({
      rules: state.rules.map((r) => (r.id === id ? updatedRule : r)),
    }));
  },

  deleteRule: async (id) => {
    const db = await initDB();
    await db.delete('rules', id);
    set((state) => ({
      rules: state.rules.filter((r) => r.id !== id),
    }));
  },

  updateSettings: async (updates) => {
    const db = await initDB();
    const settings = get().settings;
    const updatedSettings = { ...settings, ...updates };
    await db.put('settings', updatedSettings);
    set({ settings: updatedSettings });

    if (updates.brokerMarginUsed !== undefined) {
      const brokerMarginUsed =
        Number.isFinite(updates.brokerMarginUsed) && updates.brokerMarginUsed > 0
          ? updates.brokerMarginUsed
          : 0;
      try {
        await fetch('/api/settings/margin-used', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ brokerMarginUsed }),
        });
      } catch {
        /* keep local write; sync later */
      }
    }
  },

  addToWatchlist: async (item) => {
    const db = await initDB();
    const listId = item.listId?.trim() || DEFAULT_WATCHLIST_LIST_ID;
    const kind = item.kind ?? 'equity';
    const id = item.id?.trim() || generateId();
    const sym = item.symbol.trim().toUpperCase();

    const existingById = await db.get('watchlist', id);
    if (existingById) return;

    const all = await db.getAll('watchlist');
    const dup = all.some(
      (w) =>
        w.listId === listId &&
        w.kind === kind &&
        w.symbol.trim().toUpperCase() === sym,
    );
    if (dup) return;

    const next: WatchlistItem = {
      id,
      listId,
      kind,
      symbol: sym,
      companyName: item.companyName.trim(),
      addedAt: Date.now(),
    };
    await db.put('watchlist', next);
    await syncWatchlistItemToServer(next);
    set((state) => ({
      watchlist: [next, ...state.watchlist].sort((a, b) => b.addedAt - a.addedAt),
    }));
  },

  addManyToWatchlist: async (items) => {
    if (items.length === 0) return;
    const db = await initDB();
    const base = Date.now();
    const newItems: WatchlistItem[] = [];
    const all = await db.getAll('watchlist');

    for (let i = 0; i < items.length; i++) {
      const raw = items[i];
      const listId = raw.listId?.trim() || DEFAULT_WATCHLIST_LIST_ID;
      const kind = raw.kind ?? 'equity';
      const id = raw.id?.trim() || generateId();
      const sym = raw.symbol.trim().toUpperCase();

      if (await db.get('watchlist', id)) continue;
      const dupLocal = newItems.some(
        (w) => w.listId === listId && w.kind === kind && w.symbol === sym,
      );
      const dupDb = all.some(
        (w) => w.listId === listId && w.kind === kind && w.symbol.trim().toUpperCase() === sym,
      );
      if (dupLocal || dupDb) continue;

      const next: WatchlistItem = {
        id,
        listId,
        kind,
        symbol: sym,
        companyName: raw.companyName.trim(),
        addedAt: base + i,
      };
      await db.put('watchlist', next);
      await syncWatchlistItemToServer(next);
      newItems.push(next);
    }

    if (newItems.length === 0) return;
    set((state) => ({
      watchlist: [...newItems, ...state.watchlist].sort((a, b) => b.addedAt - a.addedAt),
    }));
  },

  removeFromWatchlist: async (id) => {
    const db = await initDB();
    await db.delete('watchlist', id);
    await deleteWatchlistItemFromServer(id);
    set((state) => ({
      watchlist: state.watchlist.filter((w) => w.id !== id),
    }));
  },

  toggleWatchlist: async (item) => {
    const listId = item.listId?.trim() || DEFAULT_WATCHLIST_LIST_ID;
    const kind = item.kind ?? 'equity';
    const sym = item.symbol.trim().toUpperCase();
    const existing = get().watchlist.find(
      (w) => w.listId === listId && w.kind === kind && w.symbol.trim().toUpperCase() === sym,
    );
    if (existing) {
      await get().removeFromWatchlist(existing.id);
    } else {
      await get().addToWatchlist({ ...item, listId, kind, id: item.id?.trim() || generateId() });
    }
  },

  createWatchlistList: async (name) => {
    const db = await initDB();
    const sortOrder = get().watchlistLists.length;
    let list: WatchlistList = {
      id: generateId(),
      name: name.trim() || 'Untitled',
      createdAt: Date.now(),
      sortOrder,
    };
    try {
      const res = await fetch('/api/watchlist/lists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: list.name }),
      });
      if (res.ok) {
        const body = (await res.json()) as {
          list?: { id: string; name: string; createdAt: number; sortOrder: number };
        };
        if (body.list) {
          list = {
            id: body.list.id,
            name: body.list.name,
            createdAt: body.list.createdAt,
            sortOrder: body.list.sortOrder,
          };
        }
      }
    } catch {
      /* offline */
    }
    await db.put('watchlistLists', list);
    set((state) => ({
      watchlistLists: [...state.watchlistLists.filter((x) => x.id !== list.id), list].sort(
        (a, b) => a.sortOrder - b.sortOrder || a.createdAt - b.createdAt,
      ),
    }));
  },

  renameWatchlistList: async (listId, name) => {
    const trimmed = name.trim() || 'Untitled';
    const db = await initDB();
    const prev = await db.get('watchlistLists', listId);
    if (!prev) return;
    const next: WatchlistList = { ...prev, name: trimmed };
    try {
      await fetch('/api/watchlist/lists', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: listId, name: trimmed }),
      });
    } catch {
      /* offline */
    }
    await db.put('watchlistLists', next);
    set((state) => ({
      watchlistLists: state.watchlistLists.map((l) => (l.id === listId ? next : l)),
    }));
  },

  deleteWatchlistList: async (listId) => {
    if (listId === DEFAULT_WATCHLIST_LIST_ID) return;
    const db = await initDB();
    try {
      await fetch('/api/watchlist/lists', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: listId }),
      });
    } catch {
      /* offline */
    }
    const all = await db.getAll('watchlist');
    for (const w of all) {
      if (w.listId === listId) await db.delete('watchlist', w.id);
    }
    await db.delete('watchlistLists', listId);
    set((state) => ({
      watchlist: state.watchlist.filter((w) => w.listId !== listId),
      watchlistLists: state.watchlistLists.filter((l) => l.id !== listId),
    }));
  },
}));
