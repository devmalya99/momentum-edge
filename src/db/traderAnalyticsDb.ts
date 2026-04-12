import { openDB, DBSchema, IDBPDatabase } from 'idb';
import type { BrokerSnapshot, ReconstructedTrade } from '@/analytics/types';
import type { PnlIndexedRecord } from '@/analytics/pnlIndexedDbSchema';

export interface BrokerUploadRecord {
  id: string;
  snapshotId: string;
  kind: 'pnl';
  fileName: string;
  uploadedAt: number;
}

interface TraderAnalyticsDB extends DBSchema {
  uploads: {
    key: string;
    value: BrokerUploadRecord;
    indexes: { 'by-snapshot': string };
  };
  trades: {
    key: string;
    value: ReconstructedTrade & { snapshotId: string };
    indexes: { 'by-snapshot': string };
  };
  metrics: {
    key: string;
    value: { id: string; snapshotId: string; createdAt: number; metricsJson: string };
    indexes: { 'by-snapshot': string };
  };
  history: {
    key: string;
    value: BrokerSnapshot;
    indexes: { 'by-date': number };
  };
  /** P&L payload: value is only `{ pnl_summary, trade_details }`; key is snapshot id (out-of-line). */
  pnl_records: {
    key: string;
    value: PnlIndexedRecord;
  };
}

const DB_NAME = 'momentum-edge-trader-analytics';
const DB_VERSION = 3;

/** Out-of-line key for the Analytics page upload — value is only `PnlIndexedRecord` (summary + trades). */
export const PNL_ANALYTICS_UPLOAD_KEY = 'analytics-pnl-upload';

export async function openTraderAnalyticsDB(): Promise<IDBPDatabase<TraderAnalyticsDB>> {
  return openDB<TraderAnalyticsDB>(DB_NAME, DB_VERSION, {
    upgrade(db, oldVersion) {
      if (oldVersion < 1) {
        const uploads = db.createObjectStore('uploads', { keyPath: 'id' });
        uploads.createIndex('by-snapshot', 'snapshotId');

        const trades = db.createObjectStore('trades', { keyPath: 'id' });
        trades.createIndex('by-snapshot', 'snapshotId');

        const metrics = db.createObjectStore('metrics', { keyPath: 'id' });
        metrics.createIndex('by-snapshot', 'snapshotId');

        const history = db.createObjectStore('history', { keyPath: 'id' });
        history.createIndex('by-date', 'createdAt');
      }
      if (oldVersion < 2 && !db.objectStoreNames.contains('pnl_records')) {
        db.createObjectStore('pnl_records', { keyPath: 'snapshotId' });
      }
      if (oldVersion < 3) {
        if (db.objectStoreNames.contains('pnl_records')) {
          db.deleteObjectStore('pnl_records');
        }
        db.createObjectStore('pnl_records');
      }
    },
  });
}

export async function getPnlIndexedRecord(snapshotId: string): Promise<PnlIndexedRecord | undefined> {
  const db = await openTraderAnalyticsDB();
  return db.get('pnl_records', snapshotId);
}

export async function saveAnalyticsPnlUpload(record: PnlIndexedRecord): Promise<void> {
  const db = await openTraderAnalyticsDB();
  await db.put('pnl_records', record, PNL_ANALYTICS_UPLOAD_KEY);
}

export async function loadAnalyticsPnlUpload(): Promise<PnlIndexedRecord | undefined> {
  const db = await openTraderAnalyticsDB();
  return db.get('pnl_records', PNL_ANALYTICS_UPLOAD_KEY);
}
