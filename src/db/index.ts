import { openDB, DBSchema, IDBPDatabase } from 'idb';

export interface Rule {
  id: string;
  name: string;
  category: 'Structure' | 'Trend' | 'Confirmation' | 'Context';
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
  checklist: {
    priorRally: boolean;
    tightBase: boolean;
    breakoutLevel: boolean;
    volumeConfirmation: boolean;
    emaAlignment: boolean;
    relativeStrength: boolean;
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
  tradeTypes: TradeTypeConfig[];
  networthAssets: NetworthAsset[];
  /** Borrowed margin currently used for trading; subtracted in networth view. */
  brokerMarginUsed: number;
}

export interface WatchlistItem {
  /** TradingView symbol key, e.g. BSE:RELIANCE */
  id: string;
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
  watchlist: {
    key: string;
    value: WatchlistItem;
    indexes: { 'by-addedAt': number };
  };
}

const DB_NAME = 'momentum-edge-db';
const DB_VERSION = 2;

export async function initDB(): Promise<IDBPDatabase<MomentumDB>> {
  return openDB<MomentumDB>(DB_NAME, DB_VERSION, {
    upgrade(db) {
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
    },
  });
}
