import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { DEFAULT_WATCHLIST_LIST_ID } from '@/lib/watchlist-defaults';

export interface Rule {
  id: string;
  name: string;
  maxScore: number;
  enabled: boolean;
}

export interface Trade {
  id: string;
  symbol: string;
  type: string; // Refers to TradeTypeConfig.id or name
  entryPrice: number;
  currentPrice?: number;
  stopLoss: number;
  positionSize: number;
  status: 'Active' | 'Closed';
  entryDate: number;
  exitDate?: number;
  exitPrice?: number;
  exitReason?: 'Climax' | 'Structure break' | 'Stop loss' | 'Manual';
  
  // Scoring
  ruleScores: Record<string, number>;
  totalScore: number;
  maxPossibleScore: number;
  scorePercentage: number;
  verdict: 'A+' | 'A' | 'B' | 'Avoid';
  
  // Checklist
  checklist: Record<string, boolean>;
  mtf?: {
    enabled: boolean;
    leverage: number;
    plannedHoldDays: number;
    annualInterestRate: number;
    pledgeCharge: number;
    unpledgeCharge: number;
  };

  // Management State (for Leader trades)
  management?: {
    above20EMA: boolean;
    structureIntact: boolean;
  };

  notes: string;
  mistakes: string[];
  screenshotUrl?: string;
}

export interface TradeTypeConfig {
  id: string;
  name: string;
  description: string;
  minHoldingPeriod: string;
  expectedReturn: string;
}

export interface NetworthAsset {
  id: string;
  name: string;
  value: number;
}

export interface Settings {
  id: 'global';
  totalCapital: number;
  riskPerTradePercent: number;
  mtfRate?: number;
  tradeTypes: TradeTypeConfig[];
  checklistCriteria: string[];
  checklistPassingScore: number;
  networthAssets: NetworthAsset[];
  /** Borrowed margin currently used for trading; subtracted in networth view. */
  brokerMarginUsed: number;
}

export type WatchlistKind = 'equity' | 'index';

export interface WatchlistList {
  id: string;
  name: string;
  createdAt: number;
  sortOrder: number;
}

/** Row id is a UUID; `symbol` is NSE ticker or index name (e.g. NIFTY 50). */
export interface WatchlistItem {
  id: string;
  listId: string;
  kind: WatchlistKind;
  symbol: string;
  companyName: string;
  addedAt: number;
}

interface MomentumDB extends DBSchema {
  trades: {
    key: string;
    value: Trade;
    indexes: { 'by-date': number };
  };
  rules: {
    key: string;
    value: Rule;
  };
  settings: {
    key: string;
    value: Settings;
  };
  watchlistLists: {
    key: string;
    value: WatchlistList;
  };
  watchlist: {
    key: string;
    value: WatchlistItem;
    indexes: { 'by-addedAt': number; 'by-listId': string };
  };
}

const DB_NAME = 'momentum-edge-db';
const DB_VERSION = 3;

function newRowId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

/** Ensures default list exists and legacy watchlist rows gain listId/kind/uuid ids. */
export async function ensureWatchlistLocalShape(db: IDBPDatabase<MomentumDB>): Promise<void> {
  const lists = await db.getAll('watchlistLists');
  if (lists.length === 0) {
    await db.put('watchlistLists', {
      id: DEFAULT_WATCHLIST_LIST_ID,
      name: 'Main',
      createdAt: Date.now(),
      sortOrder: 0,
    });
  }

  const all = await db.getAll('watchlist');
  for (const item of all) {
    const row = item as WatchlistItem & { listId?: string; kind?: WatchlistKind };
    const needsShape = !row.listId || !row.kind;
    const looksLegacyTvId = row.id.includes(':') || !/^[0-9a-f-]{36}$/i.test(row.id);
    if (!needsShape && !looksLegacyTvId) continue;

    const next: WatchlistItem = {
      id: looksLegacyTvId ? newRowId() : row.id,
      listId: row.listId ?? DEFAULT_WATCHLIST_LIST_ID,
      kind: row.kind ?? 'equity',
      symbol: row.symbol.trim().toUpperCase(),
      companyName: row.companyName.trim(),
      addedAt: row.addedAt,
    };

    if (next.id !== item.id) {
      await db.delete('watchlist', item.id);
    }
    await db.put('watchlist', next);
  }
}

export async function initDB(): Promise<IDBPDatabase<MomentumDB>> {
  const db = await openDB<MomentumDB>(DB_NAME, DB_VERSION, {
    upgrade(db, oldVersion, _newVersion, transaction) {
      if (!db.objectStoreNames.contains('trades')) {
        const tradeStore = db.createObjectStore('trades', { keyPath: 'id' });
        tradeStore.createIndex('by-date', 'entryDate');
      }

      if (!db.objectStoreNames.contains('rules')) {
        db.createObjectStore('rules', { keyPath: 'id' });
      }

      if (!db.objectStoreNames.contains('settings')) {
        db.createObjectStore('settings', { keyPath: 'id' });
      }

      if (!db.objectStoreNames.contains('watchlist')) {
        const watchlistStore = db.createObjectStore('watchlist', { keyPath: 'id' });
        watchlistStore.createIndex('by-addedAt', 'addedAt');
      }

      if (oldVersion < 3) {
        if (!db.objectStoreNames.contains('watchlistLists')) {
          db.createObjectStore('watchlistLists', { keyPath: 'id' });
        }
        if (db.objectStoreNames.contains('watchlist')) {
          const wl = transaction.objectStore('watchlist');
          if (!wl.indexNames.contains('by-listId')) {
            (wl as unknown as IDBObjectStore).createIndex('by-listId', 'listId');
          }
        }
      }
    },
  });

  await ensureWatchlistLocalShape(db);
  return db;
}
