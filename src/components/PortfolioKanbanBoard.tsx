'use client';

import React, { useCallback, useMemo, useRef, useState } from 'react';
import type { Trade, TradeTypeConfig } from '@/db';
import TradeCard from '@/components/TradeCard';
import { GripVertical, Loader2, Plus, LayoutGrid } from 'lucide-react';

const DND_TRADE_MIME = 'application/x-momentum-trade-id';

type ColumnModel = { name: string; config?: TradeTypeConfig };

function getTradeValue(trade: Trade, livePriceBySymbol: Record<string, number | undefined>) {
  if (trade.status === 'Closed') return trade.positionSize * (trade.exitPrice ?? trade.entryPrice);
  const price = livePriceBySymbol[trade.symbol.trim().toUpperCase()] ?? trade.currentPrice ?? trade.entryPrice;
  return trade.positionSize * price;
}

function KanbanTradeRow(props: {
  trade: Trade;
  columnName: string;
  livePrice?: number;
  stockTags?: Array<{ id: string; label: string }>;
  onCardClick: () => void;
  onSymbolClick: () => void;
  disabled: boolean;
  isDragging: boolean;
  onDragStartRow: (tradeId: string) => void;
  onDragEndRow: () => void;
  onDragOverRow: (e: React.DragEvent) => void;
  onDropOnRow: (e: React.DragEvent, targetColumnName: string) => void;
}) {
  const {
    trade,
    columnName,
    livePrice,
    stockTags,
    onCardClick,
    onSymbolClick,
    disabled,
    isDragging,
    onDragStartRow,
    onDragEndRow,
    onDragOverRow,
    onDropOnRow,
  } = props;

  const handleDragStart = (e: React.DragEvent) => {
    if (disabled) {
      e.preventDefault();
      return;
    }
    e.dataTransfer.setData(DND_TRADE_MIME, trade.id);
    e.dataTransfer.setData('text/plain', trade.id);
    e.dataTransfer.effectAllowed = 'move';
    onDragStartRow(trade.id);
  };

  return (
    <div
      role="presentation"
      draggable={!disabled}
      onDragStart={handleDragStart}
      onDragEnd={onDragEndRow}
      onDragEnter={(e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
      }}
      onDragOverCapture={(e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
      }}
      onDragOver={onDragOverRow}
      onDrop={(e) => onDropOnRow(e, columnName)}
      className={`relative flex gap-2 rounded-xl border border-transparent transition-all duration-300 ${
        isDragging ? 'opacity-40 scale-[0.98]' : 'opacity-100 hover:-translate-y-0.5'
      } ${disabled ? 'pointer-events-none' : 'cursor-grab active:cursor-grabbing'}`}
    >
      <div
        className="pointer-events-none mt-0.5 flex min-h-[4.5rem] w-6 shrink-0 flex-col items-center justify-center self-stretch rounded-lg border border-white/5 bg-linear-to-b from-[#1c1c21] to-[#121215] text-gray-500 shadow-inner shadow-black/40 transition-colors group-hover:border-white/10"
        aria-hidden
      >
        <GripVertical size={12} strokeWidth={2.5} className="opacity-60" />
      </div>
      <div
        className="min-w-0 flex-1"
        onDragEnter={(e) => {
          e.preventDefault();
          e.dataTransfer.dropEffect = 'move';
        }}
        onDragOverCapture={(e) => {
          e.preventDefault();
          e.dataTransfer.dropEffect = 'move';
        }}
        onDragOver={(e) => {
          e.preventDefault();
          e.dataTransfer.dropEffect = 'move';
        }}
        onDrop={(e) => onDropOnRow(e, columnName)}
      >
        <TradeCard
          variant="kanban"
          trade={trade}
          stockTags={stockTags}
          onClick={onCardClick}
          onSymbolClick={onSymbolClick}
          livePrice={trade.status === 'Active' ? livePrice : undefined}
        />
      </div>
    </div>
  );
}

function KanbanColumn(props: {
  column: ColumnModel;
  trades: Trade[];
  livePriceBySymbol: Record<string, number | undefined>;
  totalBoardAllocation: number;
  stockTagsBySymbol?: Map<string, Array<{ id: string; label: string }>>;
  onCardClick: (trade: Trade) => void;
  onSymbolClick: (trade: Trade) => void;
  isMoving: boolean;
  draggingTradeId: string | null;
  dragOverColumn: string | null;
  onDragStartRow: (tradeId: string) => void;
  onDragEndRow: () => void;
  onDragOverColumn: (e: React.DragEvent, columnName: string) => void;
  onDragLeaveColumn: (e: React.DragEvent, columnName: string) => void;
  onDropOnColumn: (e: React.DragEvent, columnName: string) => void;
}) {
  const {
    column,
    trades,
    livePriceBySymbol,
    totalBoardAllocation,
    stockTagsBySymbol,
    onCardClick,
    onSymbolClick,
    isMoving,
    draggingTradeId,
    dragOverColumn,
    onDragStartRow,
    onDragEndRow,
    onDragOverColumn,
    onDragLeaveColumn,
    onDropOnColumn,
  } = props;

  const isOver = dragOverColumn === column.name;

  const allowDrop = (e: React.DragEvent, colName?: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (colName) onDragOverColumn(e, colName);
  };

  const allowDropCapture = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const columnAllocation = useMemo(() => {
    return trades.reduce((sum, t) => sum + getTradeValue(t, livePriceBySymbol), 0);
  }, [trades, livePriceBySymbol]);

  const allocationPct = totalBoardAllocation > 0 ? (columnAllocation / totalBoardAllocation) * 100 : 0;

  return (
    <div
      className={`flex w-[min(100%,280px)] min-w-[240px] max-w-[280px] shrink-0 snap-start flex-col rounded-2xl border border-white/5 bg-linear-to-b from-[#141417] to-[#0a0a0c] shadow-xl shadow-black/60 ring-1 ring-inset ring-white/5 transition-all duration-300 ${
        isOver ? 'border-sky-500/50 bg-linear-to-b from-[#0c1622] to-[#0a0a0c] ring-sky-500/20 scale-[1.01]' : 'hover:border-white/10'
      }`}
      onDragEnter={(e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
      }}
      onDragOverCapture={allowDropCapture}
      onDragOver={(e) => onDragOverColumn(e, column.name)}
      onDragLeave={(e) => onDragLeaveColumn(e, column.name)}
      onDrop={(e) => onDropOnColumn(e, column.name)}
    >
      <div
        className="rounded-t-2xl border-b border-white/5 bg-[#1a1a1e]/40 px-3 py-2.5 backdrop-blur-sm"
        onDragEnter={(e) => {
          e.preventDefault();
          e.dataTransfer.dropEffect = 'move';
        }}
        onDragOverCapture={allowDropCapture}
        onDragOver={(e) => onDragOverColumn(e, column.name)}
        onDrop={(e) => onDropOnColumn(e, column.name)}
      >
        <div className="flex items-center justify-between">
          <h3 className="truncate text-xs font-bold uppercase tracking-widest text-gray-300" title={column.name}>
            {column.name}
          </h3>
          {allocationPct > 0 && (
            <span className="text-[10px] font-black text-cyan-400 tracking-wider bg-cyan-500/10 px-2 py-0.5 rounded-lg border border-cyan-500/20 shadow-[0_0_10px_rgba(34,211,238,0.1)]">
              {allocationPct.toFixed(1)}%
            </span>
          )}
        </div>
        <div className="mt-1 flex items-center justify-between text-[10px] font-bold text-gray-500">
          <span>{trades.length} position{trades.length === 1 ? '' : 's'}</span>
          {columnAllocation > 0 && (
            <span className="text-gray-400">₹{columnAllocation.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
          )}
        </div>
      </div>
      <div
        className={`flex min-h-[160px] flex-1 flex-col gap-2 rounded-b-2xl p-2.5 transition-colors ${
          isOver ? 'bg-sky-500/5' : 'bg-transparent'
        }`}
        onDragEnter={(e) => {
          e.preventDefault();
          e.dataTransfer.dropEffect = 'move';
        }}
        onDragOverCapture={allowDropCapture}
        onDragOver={(e) => allowDrop(e, column.name)}
        onDrop={(e) => onDropOnColumn(e, column.name)}
      >
        {isMoving && trades.length === 0 ? (
          <div className="flex flex-1 items-center justify-center py-8 text-gray-600">
            <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
          </div>
        ) : null}
        {trades.map((trade) => (
          <KanbanTradeRow
            key={trade.id}
            trade={trade}
            columnName={column.name}
            livePrice={livePriceBySymbol[trade.symbol.trim().toUpperCase()]}
            stockTags={stockTagsBySymbol?.get(trade.symbol.trim().toUpperCase()) ?? []}
            onCardClick={() => onCardClick(trade)}
            onSymbolClick={() => onSymbolClick(trade)}
            disabled={isMoving}
            isDragging={draggingTradeId === trade.id}
            onDragStartRow={onDragStartRow}
            onDragEndRow={onDragEndRow}
            onDragOverRow={(e) => allowDrop(e, column.name)}
            onDropOnRow={onDropOnColumn}
          />
        ))}
      </div>
    </div>
  );
}

export type PortfolioKanbanBoardProps = {
  trades: Trade[];
  tradeTypes: TradeTypeConfig[];
  livePriceBySymbol: Record<string, number | undefined>;
  stockTagsBySymbol?: Map<string, Array<{ id: string; label: string }>>;
  onUpdateTradeType: (tradeId: string, typeName: string) => Promise<void>;
  onAddTradeType: (config: TradeTypeConfig) => Promise<void>;
  onCardClick: (trade: Trade) => void;
  onSymbolClick: (trade: Trade) => void;
};

export default function PortfolioKanbanBoard({
  trades,
  tradeTypes,
  livePriceBySymbol,
  stockTagsBySymbol,
  onUpdateTradeType,
  onAddTradeType,
  onCardClick,
  onSymbolClick,
}: PortfolioKanbanBoardProps) {
  const [movingId, setMovingId] = useState<string | null>(null);
  const [newColOpen, setNewColOpen] = useState(false);
  const [newColName, setNewColName] = useState('');
  const [draggingTradeId, setDraggingTradeId] = useState<string | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);
  /** getData() is empty on drop in some environments; mirror id from dragstart. */
  const dragSourceIdRef = useRef<string | null>(null);

  const columns: ColumnModel[] = useMemo(() => {
    const fromSettings = (tradeTypes ?? []).map((t) => ({ name: t.name, config: t }));
    const seen = new Set(fromSettings.map((c) => c.name));
    const extras: ColumnModel[] = [];
    for (const t of trades) {
      const n = t.type || 'Uncategorized';
      if (!seen.has(n)) {
        seen.add(n);
        extras.push({ name: n });
      }
    }
    extras.sort((a, b) => a.name.localeCompare(b.name));
    return [...fromSettings, ...extras];
  }, [tradeTypes, trades]);

  const totalBoardAllocation = useMemo(() => {
    return trades.reduce((sum, t) => sum + getTradeValue(t, livePriceBySymbol), 0);
  }, [trades, livePriceBySymbol]);

  const tradesByColumn = useMemo(() => {
    const map = new Map<string, Trade[]>();
    for (const c of columns) {
      map.set(c.name, []);
    }
    for (const t of trades) {
      const key = t.type || 'Uncategorized';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(t);
    }
    for (const list of map.values()) {
      list.sort((a, b) => b.entryDate - a.entryDate);
    }
    return map;
  }, [trades, columns]);

  const readTradeIdFromTransfer = (e: React.DragEvent): string | null => {
    const dt = e.dataTransfer ?? (e.nativeEvent as globalThis.DragEvent).dataTransfer;
    if (!dt) return dragSourceIdRef.current;
    
    const fromMime = dt.getData(DND_TRADE_MIME);
    if (fromMime) return fromMime;
    
    const plain = dt.getData('text/plain');
    if (plain) return plain;
    
    return dragSourceIdRef.current;
  };

  const applyDrop = useCallback(
    async (tradeId: string, targetColumnName: string) => {
      console.log('[Kanban] 1. applyDrop initiated for ID:', tradeId, 'target:', targetColumnName);
      const trade = trades.find((x) => x.id === tradeId);
      if (!trade) {
        console.warn('[Kanban] Trade not found in current trades list:', tradeId);
        return;
      }
      
      const current = trade.type || 'Uncategorized';
      if (current === targetColumnName) {
        console.log('[Kanban] Trade already in target column. Ignoring.');
        return;
      }
      
      console.log(`[Kanban] 2. Set moving state. Changing type from ${current} to ${targetColumnName}`);
      setMovingId(tradeId);
      try {
        console.log('[Kanban] 3. Calling store to update state/db silently...');
        await onUpdateTradeType(tradeId, targetColumnName);
        console.log('[Kanban] 4. Store update resolved. Local state updated.');
      } catch(err) {
        console.error('[Kanban] Error during update:', err);
      } finally {
        setMovingId(null);
        console.log('[Kanban] 5. Moving state cleared.');
      }
    },
    [trades, onUpdateTradeType],
  );

  const onDropOnColumn = useCallback(
    (e: React.DragEvent, columnName: string) => {
      e.preventDefault();
      e.stopPropagation();
      
      const tradeId = readTradeIdFromTransfer(e);
      
      setDragOverColumn(null);
      setDraggingTradeId(null);
      dragSourceIdRef.current = null;
      
      if (!tradeId) return;
      void applyDrop(tradeId, columnName);
    },
    [applyDrop],
  );

  const onDragOverColumn = useCallback((e: React.DragEvent, columnName: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverColumn(columnName);
  }, []);

  const onDragLeaveColumn = useCallback((e: React.DragEvent, columnName: string) => {
    const next = e.relatedTarget as Node | null;
    if (next && e.currentTarget.contains(next)) return;
    setDragOverColumn((prev) => (prev === columnName ? null : prev));
  }, []);

  const submitNewColumn = async () => {
    const name = newColName.trim();
    if (!name) return;
    if (columns.some((c) => c.name.toLowerCase() === name.toLowerCase())) {
      setNewColOpen(false);
      setNewColName('');
      return;
    }
    await onAddTradeType({
      id: crypto.randomUUID(),
      name,
      description: '',
      minHoldingPeriod: '',
      expectedReturn: '',
    });
    setNewColName('');
    setNewColOpen(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-blue-500/20 bg-blue-500/10 text-blue-400 shadow-inner shadow-blue-500/10">
            <LayoutGrid size={18} strokeWidth={2.5} />
          </div>
          <div>
            <h2 className="text-base font-black uppercase tracking-widest text-white drop-shadow-md">Portfolio Board</h2>
            <p className="mt-0.5 text-[9px] font-bold uppercase tracking-wider text-gray-500">Drag & drop by column</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {!newColOpen ? (
            <button
              type="button"
              onClick={() => setNewColOpen(true)}
              className="flex items-center gap-2 rounded-[14px] border border-white/10 bg-[#1a1a1e] px-4 py-2.5 text-[11px] font-black uppercase tracking-wider text-gray-300 hover:border-blue-500/40 hover:text-white hover:shadow-[0_0_15px_rgba(59,130,246,0.3)] transition-all duration-300"
            >
              <Plus size={14} strokeWidth={3} /> Add Matrix Column
            </button>
          ) : (
            <div className="flex items-center gap-2 rounded-[14px] border border-blue-500/40 bg-[#121215] p-1.5 pl-4 shadow-[0_0_20px_rgba(59,130,246,0.15)] ring-1 ring-blue-500/20 transition-all">
              <input
                value={newColName}
                onChange={(ev) => setNewColName(ev.target.value)}
                onKeyDown={(ev) => {
                  if (ev.key === 'Enter') void submitNewColumn();
                  if (ev.key === 'Escape') {
                    setNewColOpen(false);
                    setNewColName('');
                  }
                }}
                placeholder="Trade type name…"
                className="w-40 bg-transparent text-xs text-white placeholder:text-gray-600 focus:outline-none"
                autoFocus
              />
              <button
                type="button"
                onClick={() => void submitNewColumn()}
                className="rounded-[10px] bg-blue-600 px-4 py-2 text-[10px] font-black uppercase tracking-wider text-white hover:bg-blue-500 shadow-lg shadow-blue-900/50 transition-all"
              >
                Add
              </button>
              <button
                type="button"
                onClick={() => {
                  setNewColOpen(false);
                  setNewColName('');
                }}
                className="px-3 py-2 text-[10px] font-black uppercase tracking-wider text-gray-500 hover:text-white transition-colors"
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      </div>

      <div
        className="flex gap-3 overflow-x-auto px-0.5 pb-3 pt-1 scroll-smooth snap-x snap-mandatory"
        onDragOver={(e) => e.preventDefault()}
      >
        {columns.map((col) => (
          <KanbanColumn
            key={col.name}
            column={col}
            trades={tradesByColumn.get(col.name) ?? []}
            livePriceBySymbol={livePriceBySymbol}
            totalBoardAllocation={totalBoardAllocation}
            stockTagsBySymbol={stockTagsBySymbol}
            onCardClick={onCardClick}
            onSymbolClick={onSymbolClick}
            isMoving={movingId != null}
            draggingTradeId={draggingTradeId}
            dragOverColumn={dragOverColumn}
            onDragStartRow={(id) => {
              dragSourceIdRef.current = id;
              setDraggingTradeId(id);
            }}
            onDragEndRow={() => {
              dragSourceIdRef.current = null;
              setDraggingTradeId(null);
              setDragOverColumn(null);
            }}
            onDragOverColumn={onDragOverColumn}
            onDragLeaveColumn={onDragLeaveColumn}
            onDropOnColumn={onDropOnColumn}
          />
        ))}
      </div>
    </div>
  );
}
