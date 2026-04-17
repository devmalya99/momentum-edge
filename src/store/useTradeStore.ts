import { create } from 'zustand';
import { Rule, Trade, Settings, WatchlistItem, initDB } from '../db';

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

interface TradeState {
  trades: Trade[];
  rules: Rule[];
  settings: Settings;
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
  addToWatchlist: (item: Omit<WatchlistItem, 'addedAt'>) => Promise<void>;
  removeFromWatchlist: (id: string) => Promise<void>;
  toggleWatchlist: (item: Omit<WatchlistItem, 'addedAt'>) => Promise<void>;
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
  watchlist: [],
  isLoading: true,

  fetchData: async () => {
    const db = await initDB();
    let trades = await db.getAll('trades');
    let rules = await db.getAll('rules');
    let settings = await db.get('settings', 'global');
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
          }>;
        };
        const serverRows = Array.isArray(payload.holdings) ? payload.holdings : [];
        const defaultType = settings.tradeTypes?.[0]?.name || 'Buy & Forget';
        const importedTrades: Trade[] = serverRows.map((row, idx) => ({
          id: generateId(),
          symbol: row.symbol,
          type: defaultType,
          entryPrice: Number(row.average_price) || 0,
          currentPrice: Number(row.previous_close_price) || Number(row.average_price) || 0,
          stopLoss: (Number(row.average_price) || 0) * 0.9,
          positionSize: Number(row.quantity) || 0,
          status: 'Active',
          entryDate: Date.now() + idx,
          ruleScores: {},
          totalScore: 0,
          maxPossibleScore: 0,
          scorePercentage: 0,
          verdict: 'B',
          checklist: {
            priorRally: false,
            tightBase: false,
            breakoutLevel: false,
            volumeConfirmation: false,
            emaAlignment: false,
            relativeStrength: false,
          },
          notes: IMPORTED_HOLDINGS_NOTE,
          mistakes: [],
        }));

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
          watchlist?: Array<{
            id: string;
            symbol: string;
            company_name: string;
            added_at: number;
          }>;
        };

        const serverRows = Array.isArray(payload.watchlist) ? payload.watchlist : [];
        watchlist = serverRows
          .map((row) => ({
            id: String(row.id ?? ''),
            symbol: String(row.symbol ?? ''),
            companyName: String(row.company_name ?? ''),
            addedAt: Number(row.added_at) || Date.now(),
          }))
          .filter((item) => item.id && item.symbol && item.companyName)
          .sort((a, b) => b.addedAt - a.addedAt);

        const tx = db.transaction('watchlist', 'readwrite');
        await tx.store.clear();
        for (const item of watchlist) {
          await tx.store.put(item);
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
    const db = await initDB();
    const trade = await db.get('trades', id);
    if (!trade) return;
    const updatedTrade = { ...trade, ...updates };
    await db.put('trades', updatedTrade);
    set((state) => ({
      trades: state.trades.map((t) => (t.id === id ? updatedTrade : t)),
    }));
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
    const existing = await db.get('watchlist', item.id);
    if (existing) return;

    const next: WatchlistItem = { ...item, addedAt: Date.now() };
    await db.put('watchlist', next);
    await syncWatchlistItemToServer(next);
    set((state) => ({
      watchlist: [next, ...state.watchlist].sort((a, b) => b.addedAt - a.addedAt),
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
    const existing = get().watchlist.some((w) => w.id === item.id);
    if (existing) {
      await get().removeFromWatchlist(item.id);
    } else {
      await get().addToWatchlist(item);
    }
  },
}));
