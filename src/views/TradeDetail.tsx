import React, { useState } from 'react';
import { Trade } from '../db';
import { useTradeStore } from '../store/useTradeStore';
import { X, TrendingUp, TrendingDown, Target, Shield, AlertCircle, Save, Trash2, ExternalLink } from 'lucide-react';
import { motion } from 'motion/react';
import { getVerdictColor, getTradeTypeColor, calculateProfitPercent, calculateRMultiple } from '../utils/calculations';

interface TradeDetailProps {
  trade: Trade;
  onClose: () => void;
}

export default function TradeDetail({ trade, onClose }: TradeDetailProps) {
  const { settings, updateTrade, deleteTrade } = useTradeStore();
  const [exitPrice, setExitPrice] = useState<number>(trade.exitPrice || 0);
  const [exitReason, setExitReason] = useState<Trade['exitReason']>(trade.exitReason || 'Manual');
  const [notes, setNotes] = useState(trade.notes);
  const [mistakes, setMistakes] = useState<string[]>(trade.mistakes);
  const [management, setManagement] = useState(trade.management || { above20EMA: true, structureIntact: true });
  
  // Editable fields
  const [type, setType] = useState(trade.type);
  const [entryPrice, setEntryPrice] = useState(trade.entryPrice);
  const [currentPrice, setCurrentPrice] = useState(trade.currentPrice || trade.entryPrice);
  const [stopLoss, setStopLoss] = useState(trade.stopLoss);
  const [positionSize, setPositionSize] = useState(trade.positionSize);

  const MISTAKE_OPTIONS = [
    'Early exit',
    'Late entry',
    'Overtrading',
    'No setup confirmation',
    'Emotional trade',
    'Ignored stop loss',
  ];

  const handleCloseTrade = async () => {
    if (exitPrice <= 0) return;
    await updateTrade(trade.id, {
      status: 'Closed',
      exitPrice,
      exitReason,
      exitDate: Date.now(),
      notes,
      mistakes,
    });
    onClose();
  };

  const handleUpdate = async () => {
    await updateTrade(trade.id, {
      type,
      entryPrice,
      currentPrice,
      stopLoss,
      positionSize,
      notes,
      mistakes,
      management,
    });
    alert('Changes saved!');
  };

  const handleDelete = async () => {
    if (confirm('Are you sure you want to delete this trade log?')) {
      await deleteTrade(trade.id);
      onClose();
    }
  };

  const toggleMistake = (mistake: string) => {
    setMistakes(prev => 
      prev.includes(mistake) ? prev.filter(m => m !== mistake) : [...prev, mistake]
    );
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0a0a0b]/80 backdrop-blur-sm"
    >
      <motion.div 
        initial={{ scale: 0.95, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        className="bg-[#161618] border border-white/10 w-full max-w-5xl max-h-[90vh] overflow-hidden rounded-3xl shadow-2xl flex flex-col"
      >
        {/* Header */}
        <div className="p-6 border-b border-white/5 flex items-center justify-between bg-[#1a1a1c]">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-blue-500/10 flex items-center justify-center text-blue-400 font-black text-xl">
              {trade.symbol[0]}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-2xl font-bold tracking-tight">{trade.symbol}</h2>
                {trade.status === 'Active' ? (
                  <select 
                    value={type} 
                    onChange={(e) => setType(e.target.value)}
                    className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full border bg-transparent outline-none ${getTradeTypeColor(type)}`}
                  >
                    {settings.tradeTypes?.map(t => (
                      <option key={t.id} value={t.name} className="bg-[#0a0a0b] text-white">{t.name}</option>
                    ))}
                  </select>
                ) : (
                  <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full border ${getTradeTypeColor(trade.type)}`}>
                    {trade.type}
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-500">Entered on {new Date(trade.entryDate).toLocaleDateString()}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button 
              onClick={handleDelete}
              className="p-2.5 rounded-xl text-red-400 hover:bg-red-400/10 transition-colors"
            >
              <Trash2 size={20} />
            </button>
            <button 
              onClick={onClose}
              className="p-2.5 rounded-xl text-gray-400 hover:bg-white/5 transition-colors"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Left Column: Stats & Scoring */}
            <div className="space-y-8">
              <section className="space-y-4">
                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest">Setup Quality</h3>
                <div className="p-6 rounded-2xl bg-[#0a0a0b] border border-white/5 space-y-4">
                  <div className="flex items-center justify-between">
                    <span className={`text-sm font-bold px-3 py-1 rounded-full border ${getVerdictColor(trade.verdict)}`}>
                      Verdict: {trade.verdict}
                    </span>
                    <span className="text-2xl font-black">{trade.scorePercentage.toFixed(0)}%</span>
                  </div>
                  <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.5)]" 
                      style={{ width: `${trade.scorePercentage}%` }} 
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2 pt-2">
                    {Object.entries(trade.checklist).map(([key, val]) => (
                      <div key={key} className="flex items-center gap-2 text-[10px] font-medium text-gray-400">
                        <div className={`w-3 h-3 rounded-full ${val ? 'bg-green-500' : 'bg-gray-700'}`} />
                        <span>{key}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </section>

              <section className="space-y-4">
                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest">Trade Parameters</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 rounded-2xl bg-[#0a0a0b] border border-white/5">
                    <div className="text-[10px] text-gray-500 font-bold uppercase mb-1">Entry</div>
                    {trade.status === 'Active' ? (
                       <div className="flex items-center gap-1 text-lg font-bold">
                         $ <input type="number" value={entryPrice} onChange={e => setEntryPrice(parseFloat(e.target.value))} className="w-full bg-transparent outline-none text-white" />
                       </div>
                    ) : (
                       <div className="text-lg font-bold">₹{trade.entryPrice.toFixed(2)}</div>
                    )}
                  </div>
                  <div className="p-4 rounded-2xl bg-[#0a0a0b] border border-white/5">
                    <div className="text-[10px] text-gray-500 font-bold uppercase mb-1">Stop Loss</div>
                    {trade.status === 'Active' ? (
                       <div className="flex items-center gap-1 text-lg font-bold text-red-400">
                         $ <input type="number" value={stopLoss} onChange={e => setStopLoss(parseFloat(e.target.value))} className="w-full bg-transparent outline-none text-red-400" />
                       </div>
                    ) : (
                       <div className="text-lg font-bold text-red-400">₹{trade.stopLoss.toFixed(2)}</div>
                    )}
                  </div>
                  <div className="p-4 rounded-2xl bg-[#0a0a0b] border border-white/5">
                    <div className="text-[10px] text-gray-500 font-bold uppercase mb-1">Size</div>
                    {trade.status === 'Active' ? (
                       <div className="flex items-center gap-1 text-lg font-bold">
                         <input type="number" value={positionSize || '_'} onChange={e => setPositionSize(parseFloat(e.target.value))} className="w-full bg-transparent outline-none text-white" /> 
                         <span className="text-xs font-normal">Shares</span>
                       </div>
                    ) : (
                       <div className="text-lg font-bold">{trade.positionSize} Shares</div>
                    )}
                  </div>
                  <div className="p-4 rounded-2xl bg-[#0a0a0b] border border-white/5">
                    <div className="text-[10px] text-gray-500 font-bold uppercase mb-1">Risk</div>
                    <div className="text-lg font-bold text-red-400">₹{((trade.entryPrice - trade.stopLoss) * trade.positionSize).toFixed(2)}</div>
                  </div>
                  <div className="p-4 rounded-2xl bg-[#0a0a0b] border border-white/5">
                    <div className="text-[10px] text-gray-500 font-bold uppercase mb-1">Current Price</div>
                    {trade.status === 'Active' ? (
                       <div className="flex items-center gap-1 text-lg font-bold text-amber-400">
                         $ <input type="number" value={currentPrice} onChange={e => setCurrentPrice(parseFloat(e.target.value))} className="w-full bg-transparent outline-none text-amber-400" />
                       </div>
                    ) : (
                       <div className="text-lg font-bold text-gray-500">N/A</div>
                    )}
                  </div>
                  <div className="p-4 rounded-2xl bg-[#0a0a0b] border border-white/5">
                    <div className="text-[10px] text-gray-500 font-bold uppercase mb-1">Unrealized P&L</div>
                    {trade.status === 'Active' ? (
                       <div className={`text-lg font-bold ${currentPrice >= entryPrice ? 'text-green-400' : 'text-red-400'}`}>
                         ${((currentPrice - entryPrice) * positionSize).toFixed(2)}
                         <span className="text-xs ml-1 opacity-80">
                           ({(((currentPrice - entryPrice) / entryPrice) * 100).toFixed(2)}%)
                         </span>
                       </div>
                    ) : (
                       <div className="text-lg font-bold text-gray-500">N/A</div>
                    )}
                  </div>
                </div>
              </section>
            </div>

            {/* Middle Column: Management & Exit */}
            <div className="lg:col-span-2 space-y-8">
              {/* Management Engine */}
              {trade.status === 'Active' && (
                <section className="p-8 rounded-3xl bg-blue-600/5 border border-blue-500/20 space-y-6">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xl font-bold flex items-center gap-2">
                      <Shield size={24} className="text-blue-400" />
                      Management Engine
                    </h3>
                    <div className="px-3 py-1 rounded-full bg-blue-500/10 text-blue-400 text-[10px] font-black uppercase tracking-widest">
                      Live Guidance
                    </div>
                  </div>

                  {trade.type === 'Exhaustion' && (
                    <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center gap-4">
                      <AlertCircle className="text-red-400" size={24} />
                      <div className="font-bold text-red-400">CLIMAX MOVE DETECTED. EXIT FULLY.</div>
                    </div>
                  )}

                  {trade.type === 'Momentum' && (
                    <div className="p-4 rounded-2xl bg-yellow-500/10 border border-yellow-500/20 flex items-center gap-4">
                      <TrendingUp className="text-yellow-400" size={24} />
                      <div className="font-bold text-yellow-400">BOOK PROFITS IN 20-40% RANGE. DO NOT HOLD.</div>
                    </div>
                  )}

                  {trade.type === 'Leader' && (
                    <div className="space-y-6">
                      <div className="grid grid-cols-2 gap-4">
                        <button 
                          onClick={() => setManagement({ ...management, above20EMA: !management.above20EMA })}
                          className={`p-4 rounded-2xl border transition-all flex items-center justify-between ${management.above20EMA ? 'bg-green-500/10 border-green-500/30 text-green-400' : 'bg-[#0a0a0b] border-white/10 text-gray-500'}`}
                        >
                          <span className="font-bold">Above 20 EMA?</span>
                          <div className={`w-5 h-5 rounded-full border-2 ${management.above20EMA ? 'bg-green-500 border-green-500' : 'border-white/10'}`} />
                        </button>
                        <button 
                          onClick={() => setManagement({ ...management, structureIntact: !management.structureIntact })}
                          className={`p-4 rounded-2xl border transition-all flex items-center justify-between ${management.structureIntact ? 'bg-green-500/10 border-green-500/30 text-green-400' : 'bg-[#0a0a0b] border-white/10 text-gray-500'}`}
                        >
                          <span className="font-bold">Structure Intact?</span>
                          <div className={`w-5 h-5 rounded-full border-2 ${management.structureIntact ? 'bg-green-500 border-green-500' : 'border-white/10'}`} />
                        </button>
                      </div>
                      
                      <div className={`p-6 rounded-2xl border font-black text-center text-lg tracking-tight ${management.above20EMA && management.structureIntact ? 'bg-green-500/10 border-green-500/20 text-green-400' : 'bg-red-500/10 border-red-500/20 text-red-400'}`}>
                        {management.above20EMA && management.structureIntact ? 'HOLD / TRAIL POSITION' : 'EXIT TRADE IMMEDIATELY'}
                      </div>
                    </div>
                  )}

                  {/* Exit Module */}
                  <div className="pt-6 border-t border-white/5 space-y-4">
                    <h4 className="text-xs font-bold text-gray-500 uppercase tracking-widest">Exit Execution</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">Exit Price</label>
                        <input
                          type="number"
                          value={exitPrice || ''}
                          onChange={(e) => setExitPrice(parseFloat(e.target.value))}
                          className="w-full bg-[#0a0a0b] border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all text-lg font-bold"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">Reason</label>
                        <select
                          value={exitReason}
                          onChange={(e) => setExitReason(e.target.value as any)}
                          className="w-full bg-[#0a0a0b] border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
                        >
                          <option value="Climax">Climax</option>
                          <option value="Structure break">Structure break</option>
                          <option value="Stop loss">Stop loss</option>
                          <option value="Manual">Manual</option>
                        </select>
                      </div>
                    </div>
                    <button
                      onClick={handleCloseTrade}
                      disabled={exitPrice <= 0}
                      className="w-full py-4 bg-white text-black rounded-2xl font-black uppercase tracking-widest hover:bg-gray-200 transition-all disabled:opacity-50"
                    >
                      Close Trade
                    </button>
                  </div>
                </section>
              )}

              {trade.status === 'Closed' && (
                <section className="p-8 rounded-3xl bg-white/5 border border-white/10 space-y-6">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xl font-bold">Trade Result</h3>
                    <div className={`px-4 py-1 rounded-full font-black text-xs uppercase tracking-widest ${trade.exitPrice! > trade.entryPrice ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>
                      {trade.exitPrice! > trade.entryPrice ? 'WIN' : 'LOSS'}
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="p-4 rounded-2xl bg-[#0a0a0b] border border-white/5">
                      <div className="text-[10px] text-gray-500 font-bold uppercase mb-1">Profit %</div>
                      <div className={`text-xl font-black ${trade.exitPrice! > trade.entryPrice ? 'text-green-400' : 'text-red-400'}`}>
                        {calculateProfitPercent(trade.entryPrice, trade.exitPrice!).toFixed(2)}%
                      </div>
                    </div>
                    <div className="p-4 rounded-2xl bg-[#0a0a0b] border border-white/5">
                      <div className="text-[10px] text-gray-500 font-bold uppercase mb-1">R Multiple</div>
                      <div className="text-xl font-black text-blue-400">
                        {calculateRMultiple(trade.entryPrice, trade.stopLoss, trade.exitPrice!).toFixed(2)}R
                      </div>
                    </div>
                    <div className="p-4 rounded-2xl bg-[#0a0a0b] border border-white/5">
                      <div className="text-[10px] text-gray-500 font-bold uppercase mb-1">Exit Price</div>
                      <div className="text-xl font-black">₹{trade.exitPrice!.toFixed(2)}</div>
                    </div>
                    <div className="p-4 rounded-2xl bg-[#0a0a0b] border border-white/5">
                      <div className="text-[10px] text-gray-500 font-bold uppercase mb-1">Reason</div>
                      <div className="text-lg font-bold">{trade.exitReason}</div>
                    </div>
                  </div>
                </section>
              )}

              {/* Journaling */}
              <section className="space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest">Journal & Feedback</h3>
                  <button 
                    onClick={handleUpdate}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600/10 text-blue-400 rounded-xl font-bold text-xs hover:bg-blue-600/20 transition-all"
                  >
                    <Save size={14} />
                    Save Changes
                  </button>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2">Mistakes / Behavioral Notes</label>
                    <div className="flex flex-wrap gap-2">
                      {MISTAKE_OPTIONS.map((m) => (
                        <button
                          key={m}
                          onClick={() => toggleMistake(m)}
                          className={`px-3 py-1.5 rounded-xl text-[10px] font-bold transition-all border ${
                            mistakes.includes(m) ? 'bg-red-500/10 border-red-500/30 text-red-400' : 'bg-[#0a0a0b] border-white/10 text-gray-500 hover:border-white/20'
                          }`}
                        >
                          {m}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2">Detailed Notes</label>
                    <textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      className="w-full bg-[#0a0a0b] border border-white/10 rounded-2xl px-4 py-4 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all min-h-[150px] text-sm leading-relaxed"
                      placeholder="What did you see? How did you feel? What did you learn?"
                    />
                  </div>
                </div>
              </section>
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
