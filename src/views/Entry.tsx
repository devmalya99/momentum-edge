import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { useTradeStore } from '../store/useTradeStore';
import { getVerdict, getVerdictColor, calculateRisk } from '../utils/calculations';
import { AlertTriangle, CheckCircle2, Info, ArrowRight, Search, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

type NseEquitySearchHit = {
  symbol: string;
  series: string;
  companyName: string;
  segment: string;
};

type NseEquityQuotePayload = {
  quote?: {
    metaData?: {
      companyName?: string;
      closePrice?: number;
    };
    orderBook?: { lastPrice?: number };
    tradeInfo?: { lastPrice?: number; tickSize?: number };
    priceInfo?: { tickSize?: number };
    lastUpdateTime?: string;
  };
  error?: string;
};

function roundToTick(price: number, tick: number | null): number {
  if (tick != null && tick > 0) {
    const steps = Math.round(price / tick);
    return steps * tick;
  }
  return Math.round(price * 100) / 100;
}

export default function Entry() {
  const { rules, settings, addTrade } = useTradeStore();
  const [step, setStep] = useState(1); // 1: Scoring, 2: Details, 3: Checklist
  
  // Form State
  const [symbol, setSymbol] = useState('');
  const [type, setType] = useState<string>('');
  const [entryPrice, setEntryPrice] = useState<number>(0);
  const [stopLoss, setStopLoss] = useState<number>(0);
  const [positionSize, setPositionSize] = useState<number>(0);
  const [notes, setNotes] = useState('');

  const [symbolSearchOpen, setSymbolSearchOpen] = useState(false);
  const [symbolSearchResults, setSymbolSearchResults] = useState<NseEquitySearchHit[]>([]);
  const [symbolSearchLoading, setSymbolSearchLoading] = useState(false);
  const [symbolSearchError, setSymbolSearchError] = useState<string | null>(null);
  const symbolSearchWrapRef = useRef<HTMLDivElement>(null);

  const [selectedSeries, setSelectedSeries] = useState<string>('EQ');
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [quoteForSymbol, setQuoteForSymbol] = useState<string | null>(null);
  const [quoteSummary, setQuoteSummary] = useState<{
    companyName: string;
    lastUpdate: string;
    usedFallbackPrice: boolean;
  } | null>(null);
  const [quoteTickSize, setQuoteTickSize] = useState<number | null>(null);
  const [stopLossPercentStr, setStopLossPercentStr] = useState('');
  const [targetGainPercentStr, setTargetGainPercentStr] = useState('');

  // Scoring State
  const [ruleScores, setRuleScores] = useState<Record<string, number>>({});
  
  // Checklist State
  const [checklist, setChecklist] = useState({
    priorRally: false,
    tightBase: false,
    breakoutLevel: false,
    volumeConfirmation: false,
    emaAlignment: false,
    relativeStrength: false,
  });

  const enabledRules = useMemo(() => rules.filter(r => r.enabled), [rules]);
  
  const scoringData = useMemo(() => {
    const totalScore = (Object.values(ruleScores) as number[]).reduce((a, b) => a + b, 0);
    const maxPossibleScore = enabledRules.reduce((a, b) => a + b.maxScore, 0);
    const percentage = maxPossibleScore > 0 ? (totalScore / maxPossibleScore) * 100 : 0;
    const verdict = getVerdict(percentage);
    return { totalScore, maxPossibleScore, percentage, verdict };
  }, [ruleScores, enabledRules]);

  const riskData = useMemo(() => {
    if (entryPrice > 0 && stopLoss > 0 && positionSize > 0) {
      return calculateRisk(entryPrice, stopLoss, positionSize);
    }
    return { totalRisk: 0, riskPercent: 0 };
  }, [entryPrice, stopLoss, positionSize]);

  const stopLossMoneyAtRisk = useMemo(() => {
    if (entryPrice <= 0 || stopLoss <= 0 || positionSize <= 0) return null;
    const perShare = entryPrice - stopLoss;
    if (perShare <= 0) return null;
    return { perShare, total: perShare * positionSize };
  }, [entryPrice, stopLoss, positionSize]);

  /** Long: target % above entry; R:R = reward per share ÷ risk per share. */
  const riskRewardPlan = useMemo(() => {
    const gainPct = parseFloat(targetGainPercentStr);
    if (!Number.isFinite(gainPct) || gainPct <= 0 || entryPrice <= 0) return null;
    if (stopLoss <= 0 || positionSize <= 0) return null;
    const riskPerShare = entryPrice - stopLoss;
    if (riskPerShare <= 0) return null;
    const rewardPerShare = entryPrice * (gainPct / 100);
    const targetPrice = roundToTick(entryPrice + rewardPerShare, quoteTickSize);
    const totalReward = rewardPerShare * positionSize;
    const ratio = rewardPerShare / riskPerShare;
    return { targetPrice, rewardPerShare, totalReward, ratio };
  }, [targetGainPercentStr, entryPrice, stopLoss, positionSize, quoteTickSize]);

  const isChecklistComplete = Object.values(checklist).every(v => v === true);
  const maxRiskAllowed = settings.totalCapital * (settings.riskPerTradePercent / 100);
  const isRiskExceeded = riskData.totalRisk > maxRiskAllowed;
  const canSubmit = symbol && type && entryPrice > 0 && stopLoss > 0 && positionSize > 0 && isChecklistComplete && scoringData.percentage >= 60 && !isRiskExceeded;

  // Set default type if not set and types exist
  React.useEffect(() => {
    if (!type && settings.tradeTypes?.length > 0) {
      setType(settings.tradeTypes[0].name);
    }
  }, [settings.tradeTypes, type]);

  useEffect(() => {
    if (step !== 2) {
      setSymbolSearchResults([]);
      setSymbolSearchLoading(false);
      setSymbolSearchError(null);
      return;
    }

    const q = symbol.trim();
    if (q.length < 2) {
      setSymbolSearchResults([]);
      setSymbolSearchLoading(false);
      setSymbolSearchError(null);
      return;
    }

    const ac = new AbortController();
    const timer = window.setTimeout(async () => {
      setSymbolSearchLoading(true);
      setSymbolSearchError(null);
      try {
        const res = await fetch(
          `/api/nse/equity-search?symbol=${encodeURIComponent(q)}`,
          { signal: ac.signal, cache: 'no-store' },
        );
        const payload = await res.json();
        if (!res.ok) {
          setSymbolSearchResults([]);
          setSymbolSearchError(
            typeof payload?.error === 'string' ? payload.error : 'Search failed',
          );
          return;
        }
        setSymbolSearchResults(Array.isArray(payload.data) ? payload.data : []);
      } catch (e) {
        if ((e as Error).name === 'AbortError') return;
        setSymbolSearchResults([]);
        setSymbolSearchError('Search failed');
      } finally {
        if (!ac.signal.aborted) setSymbolSearchLoading(false);
      }
    }, 350);

    return () => {
      window.clearTimeout(timer);
      ac.abort();
    };
  }, [symbol, step]);

  useEffect(() => {
    if (step !== 2) return;
    const onDocMouseDown = (e: MouseEvent) => {
      const el = symbolSearchWrapRef.current;
      if (el && !el.contains(e.target as Node)) setSymbolSearchOpen(false);
    };
    document.addEventListener('mousedown', onDocMouseDown);
    return () => document.removeEventListener('mousedown', onDocMouseDown);
  }, [step]);

  useEffect(() => {
    const p = parseFloat(stopLossPercentStr);
    if (!Number.isFinite(p) || p <= 0 || p >= 100 || entryPrice <= 0) return;
    const sl = entryPrice * (1 - p / 100);
    setStopLoss(roundToTick(sl, quoteTickSize));
  }, [stopLossPercentStr, entryPrice, quoteTickSize]);

  const pickSymbol = useCallback(async (hit: NseEquitySearchHit) => {
    const sym = hit.symbol.toUpperCase();
    const ser = (hit.series || 'EQ').toUpperCase();
    setSymbol(sym);
    setSelectedSeries(ser);
    setSymbolSearchOpen(false);
    setSymbolSearchResults([]);
    setSymbolSearchError(null);
    setQuoteError(null);
    setQuoteLoading(true);
    try {
      const res = await fetch(
        `/api/nse/equity-quote?symbol=${encodeURIComponent(hit.symbol)}`,
        { cache: 'no-store' },
      );
      const payload = (await res.json()) as NseEquityQuotePayload;
      if (!res.ok) {
        setQuoteError(typeof payload?.error === 'string' ? payload.error : 'Quote failed');
        setQuoteSummary(null);
        setQuoteForSymbol(null);
        return;
      }
      const q = payload.quote;
      const md = q?.metaData;
      const tickRaw = q?.priceInfo?.tickSize ?? q?.tradeInfo?.tickSize;
      const tick = typeof tickRaw === 'number' && tickRaw > 0 ? tickRaw : null;
      setQuoteTickSize(tick);

      const fromClose = typeof md?.closePrice === 'number' ? md.closePrice : NaN;
      const fromBook =
        typeof q?.orderBook?.lastPrice === 'number' && q.orderBook.lastPrice > 0
          ? q.orderBook.lastPrice
          : NaN;
      const fromTrade =
        typeof q?.tradeInfo?.lastPrice === 'number' ? q.tradeInfo.lastPrice : NaN;
      const raw = Number.isFinite(fromClose)
        ? fromClose
        : Number.isFinite(fromBook)
          ? fromBook
          : fromTrade;
      if (Number.isFinite(raw) && raw > 0) {
        setEntryPrice(roundToTick(raw, tick));
      }
      setQuoteForSymbol(sym);
      setQuoteSummary({
        companyName: md?.companyName ?? hit.companyName,
        lastUpdate: q?.lastUpdateTime ?? '—',
        usedFallbackPrice: !Number.isFinite(fromClose),
      });
    } catch {
      setQuoteError('Quote failed');
      setQuoteSummary(null);
      setQuoteForSymbol(null);
    } finally {
      setQuoteLoading(false);
    }
  }, []);

  const handleSubmit = async () => {
    if (!canSubmit) return;
    
    await addTrade({
      symbol,
      type,
      entryPrice,
      stopLoss,
      positionSize,
      status: 'Active',
      ruleScores,
      totalScore: scoringData.totalScore,
      maxPossibleScore: scoringData.maxPossibleScore,
      scorePercentage: scoringData.percentage,
      verdict: scoringData.verdict,
      checklist,
      notes,
      mistakes: [],
    });
    
    // Reset or redirect
    alert('Trade added successfully!');
    window.location.reload(); // Simple reset for now
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">New Trade Entry</h1>
          <p className="text-gray-400 mt-1">Follow the process to ensure a high-quality setup.</p>
          <p className="text-xs text-gray-500 mt-2">
            Step 2 includes a debounced NSE equity search for the symbol field.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {[1, 2, 3].map((s) => (
            <div 
              key={s}
              className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                step === s ? 'bg-blue-600 text-white scale-110' : step > s ? 'bg-green-500/20 text-green-400' : 'bg-white/5 text-gray-500'
              }`}
            >
              {step > s ? <CheckCircle2 size={16} /> : s}
            </div>
          ))}
        </div>
      </div>

      {/* Step 1: Scoring Engine */}
      {step === 1 && (
        <div className="space-y-6">
          <div className="p-8 rounded-3xl bg-[#161618] border border-white/5 shadow-2xl">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
              <div>
                <h2 className="text-xl font-semibold">Setup Scoring</h2>
                <p className="text-sm text-gray-500">Quantify the quality of this setup based on your rules.</p>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <div className="text-xs font-medium text-gray-500 uppercase tracking-wider">Verdict</div>
                  <div className={`text-2xl font-black ${getVerdictColor(scoringData.verdict).split(' ')[0]}`}>
                    {scoringData.verdict}
                  </div>
                </div>
                <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center border border-white/5">
                  <span className="text-xl font-bold">{Math.round(scoringData.percentage)}%</span>
                </div>
              </div>
            </div>

            <div className="space-y-6">
              {enabledRules.map((rule) => (
                <div key={rule.id} className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-300 font-medium">{rule.name}</span>
                    <span className="text-gray-500">{ruleScores[rule.id] || 0} / {rule.maxScore}</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max={rule.maxScore}
                    value={ruleScores[rule.id] || 0}
                    onChange={(e) => setRuleScores({ ...ruleScores, [rule.id]: parseInt(e.target.value) })}
                    className="w-full h-1.5 bg-[#0a0a0b] rounded-lg appearance-none cursor-pointer accent-blue-500"
                  />
                </div>
              ))}
            </div>

            <div className="mt-10 flex justify-end">
              <button
                onClick={() => setStep(2)}
                className="flex items-center gap-2 px-8 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl font-bold transition-all shadow-xl shadow-blue-600/20"
              >
                Next: Trade Details
                <ArrowRight size={18} />
              </button>
            </div>
          </div>
          
          {scoringData.percentage < 60 && (
            <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-start gap-4">
              <AlertTriangle className="text-red-400 shrink-0" size={20} />
              <div>
                <h4 className="text-sm font-bold text-red-400 uppercase tracking-wider">Low Quality Setup</h4>
                <p className="text-sm text-red-400/80">This setup scores below the 60% threshold. It is highly recommended to avoid this trade.</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Step 2: Trade Details */}
      {step === 2 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="p-8 rounded-3xl bg-[#161618] border border-white/5 space-y-6">
            <h2 className="text-xl font-semibold mb-2">Parameters</h2>
            
            <div className="space-y-4">
              <div ref={symbolSearchWrapRef} className="relative">
                <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1.5">
                  Stock symbol (NSE)
                </label>
                <div className="relative">
                  <Search
                    className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500"
                    aria-hidden
                  />
                  <input
                    type="text"
                    autoComplete="off"
                    autoCorrect="off"
                    spellCheck={false}
                    value={symbol}
                    onChange={(e) => {
                      const next = e.target.value.toUpperCase();
                      setSymbol(next);
                      setSymbolSearchOpen(true);
                      if (quoteForSymbol !== null && next !== quoteForSymbol) {
                        setQuoteSummary(null);
                        setQuoteForSymbol(null);
                        setQuoteError(null);
                      }
                    }}
                    onFocus={() => setSymbolSearchOpen(true)}
                    placeholder="Type to search NSE (e.g. RELIANCE)"
                    className="w-full bg-[#0a0a0b] border border-white/10 rounded-xl py-3 pl-10 pr-4 text-lg font-bold focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
                  />
                  {symbolSearchLoading ? (
                    <Loader2
                      className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-blue-400"
                      aria-hidden
                    />
                  ) : null}
                </div>
                <p className="mt-1.5 text-[10px] text-gray-500">
                  Debounced search against NSE; pick a row or keep typing your symbol.
                </p>
                {quoteLoading ? (
                  <div className="mt-2 flex items-center gap-2 text-xs text-blue-400/90">
                    <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" aria-hidden />
                    Loading NSE quote…
                  </div>
                ) : null}
                {quoteError ? (
                  <div className="mt-2 text-xs text-amber-400/90">{quoteError}</div>
                ) : null}
                {quoteSummary && !quoteLoading && symbol === quoteForSymbol ? (
                  <div className="mt-2 rounded-xl border border-white/10 bg-[#0a0a0b] px-3 py-2 text-xs text-gray-400">
                    <div className="font-semibold text-gray-200">{quoteSummary.companyName}</div>
                    <div className="mt-0.5 font-mono text-[11px] text-gray-500">
                      {quoteForSymbol} · {selectedSeries}
                      {quoteSummary.usedFallbackPrice ? (
                        <span className="ml-1 text-amber-500/90">(entry from last price)</span>
                      ) : null}
                    </div>
                    <div className="mt-1 text-[10px] text-gray-600">
                      NSE as of {quoteSummary.lastUpdate}
                    </div>
                  </div>
                ) : null}
                {symbolSearchOpen && step === 2 && symbol.trim().length >= 2 && (
                  <div className="absolute z-50 mt-1 max-h-64 w-full overflow-auto rounded-xl border border-white/10 bg-[#0f0f11] py-1 shadow-2xl shadow-black/40">
                    {symbolSearchError ? (
                      <div className="px-3 py-2 text-xs text-amber-400/90">{symbolSearchError}</div>
                    ) : null}
                    {symbolSearchLoading && symbolSearchResults.length === 0 && !symbolSearchError ? (
                      <div className="px-3 py-2 text-xs text-gray-500">Searching…</div>
                    ) : null}
                    {!symbolSearchLoading &&
                    !symbolSearchError &&
                    symbolSearchResults.length === 0 ? (
                      <div className="px-3 py-2 text-xs text-gray-500">No matches</div>
                    ) : null}
                    {symbolSearchResults.map((hit) => (
                      <button
                        key={`${hit.symbol}-${hit.series}`}
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => pickSymbol(hit)}
                        className="flex w-full flex-col items-start gap-0.5 border-b border-white/5 px-3 py-2.5 text-left last:border-0 hover:bg-white/5"
                      >
                        <span className="font-mono text-sm font-bold text-blue-300">{hit.symbol}</span>
                        <span className="text-xs text-gray-400 line-clamp-2">{hit.companyName}</span>
                        <span className="text-[10px] uppercase tracking-wide text-gray-600">
                          {hit.series} · {hit.segment}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1.5">Trade Type</label>
                <div className="grid grid-cols-3 gap-2">
                  {settings.tradeTypes?.map((t) => (
                    <div key={t.id} className="relative group">
                      <button
                        type="button"
                        onClick={() => setType(t.name)}
                        className={`w-full py-3 pr-8 pl-3 rounded-xl text-xs font-bold transition-all border text-left truncate ${
                          type === t.name ? 'bg-blue-600 border-blue-500 text-white' : 'bg-[#0a0a0b] border-white/10 text-gray-500 hover:border-white/20'
                        }`}
                      >
                        {t.name}
                      </button>
                      <div className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 group-hover:text-blue-400 cursor-help transition-colors pointer-events-none">
                        <Info size={14} />
                      </div>
                      
                      {/* Tooltip Popup */}
                      <div className="absolute z-50 left-1/2 -translate-x-1/2 bottom-full mb-3 opacity-0 group-hover:opacity-100 pointer-events-none transition-all duration-200 w-56 p-4 rounded-2xl bg-[#0f0f11] border border-white/10 shadow-2xl shadow-black/50">
                        <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-[#0f0f11] border-b border-r border-white/10 rotate-45" />
                        <div className="relative z-10">
                          <p className="text-xs font-bold text-gray-200 mb-1">{t.name}</p>
                          <p className="text-[10px] text-gray-400 mb-3 leading-relaxed">{t.description || 'No expectations defined.'}</p>
                          <div className="grid grid-cols-2 gap-2 text-[10px]">
                            <div>
                              <div className="text-gray-500 uppercase tracking-wider mb-0.5 font-bold">Min Hold</div>
                              <div className="font-bold text-blue-400">{t.minHoldingPeriod || 'N/A'}</div>
                            </div>
                            <div>
                              <div className="text-gray-500 uppercase tracking-wider mb-0.5 font-bold">Target</div>
                              <div className="font-bold text-green-400">{t.expectedReturn || 'N/A'}</div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1.5">Entry Price</label>
                  <input
                    type="number"
                    value={entryPrice || ''}
                    onChange={(e) => {
                      const v = parseFloat(e.target.value);
                      setEntryPrice(Number.isFinite(v) ? v : 0);
                    }}
                    className="w-full bg-[#0a0a0b] border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1.5">
                    Stop loss price
                  </label>
                  <input
                    type="number"
                    value={stopLoss || ''}
                    onChange={(e) => {
                      setStopLossPercentStr('');
                      const v = parseFloat(e.target.value);
                      setStopLoss(Number.isFinite(v) ? v : 0);
                    }}
                    className="w-full bg-[#0a0a0b] border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1.5">
                    Stoploss percentage
                  </label>
                  <input
                    type="number"
                    min={0.01}
                    max={99}
                    step={0.01}
                    placeholder="e.g. 2"
                    value={stopLossPercentStr}
                    onChange={(e) => setStopLossPercentStr(e.target.value)}
                    className="w-full bg-[#0a0a0b] border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
                  />
                  <p className="mt-1 text-[10px] text-gray-500">
                    % below entry (long). Sets stop loss price. Editing stop loss price clears this.
                  </p>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1.5">
                    Target gain %
                  </label>
                  <input
                    type="number"
                    min={0.01}
                    step={0.01}
                    placeholder="e.g. 3"
                    value={targetGainPercentStr}
                    onChange={(e) => setTargetGainPercentStr(e.target.value)}
                    className="w-full bg-[#0a0a0b] border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
                  />
                  <p className="mt-1 text-[10px] text-gray-500">
                    % above entry for planned target; used for risk / reward on the right.
                  </p>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1.5">Position Size (Shares)</label>
                <input
                  type="number"
                  value={positionSize || ''}
                  onChange={(e) => setPositionSize(parseFloat(e.target.value))}
                  className="w-full bg-[#0a0a0b] border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
                />
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="p-8 rounded-3xl bg-blue-600/5 border border-blue-500/20 space-y-6">
              <h2 className="text-xl font-semibold flex items-center gap-2">
                <Info size={20} className="text-blue-400" />
                Risk Analysis
              </h2>
              
              <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/25 space-y-2">
                <div className="text-[10px] font-bold text-red-400/90 uppercase tracking-widest">
                  Money at risk if stop hits
                </div>
                {stopLossMoneyAtRisk ? (
                  <>
                    <div className="text-sm text-gray-300">
                      <span className="text-gray-500">Per share: </span>
                      <span className="font-mono font-semibold text-gray-100">
                        ₹{stopLossMoneyAtRisk.perShare.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
                      </span>
                      <span className="text-gray-500"> × </span>
                      <span className="font-mono">{positionSize}</span>
                      <span className="text-gray-500"> shares</span>
                    </div>
                    <div className="text-2xl font-black text-red-400">
                      ₹{stopLossMoneyAtRisk.total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                  </>
                ) : (
                  <p className="text-xs text-gray-500">
                    Set entry above stop, shares, and stop loss to see total rupees at risk.
                  </p>
                )}
              </div>

              <div className="p-4 rounded-2xl bg-green-500/10 border border-green-500/25 space-y-2">
                <div className="text-[10px] font-bold text-green-400/90 uppercase tracking-widest">
                  Risk / reward (plan)
                </div>
                {riskRewardPlan ? (
                  <>
                    <div className="text-sm text-gray-300">
                      <span className="text-gray-500">Target price: </span>
                      <span className="font-mono font-semibold text-gray-100">
                        ₹
                        {riskRewardPlan.targetPrice.toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 4,
                        })}
                      </span>
                    </div>
                    <div className="text-sm text-gray-300">
                      <span className="text-gray-500">Potential reward: </span>
                      <span className="font-mono text-green-300">
                        ₹{riskRewardPlan.rewardPerShare.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}{' '}
                      </span>
                      <span className="text-gray-500">× {positionSize} = </span>
                      <span className="font-mono font-semibold text-green-400">
                        ₹
                        {riskRewardPlan.totalReward.toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-baseline gap-2 pt-1">
                      <span className="text-xs text-gray-500">Risk : reward</span>
                      <span className="text-2xl font-black text-green-400">
                        1 : {riskRewardPlan.ratio.toFixed(2)}
                      </span>
                    </div>
                  </>
                ) : (
                  <p className="text-xs text-gray-500">
                    Enter target gain % with entry, stop loss price, and shares to see planned target and R:R.
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 rounded-2xl bg-[#0a0a0b] border border-white/5">
                  <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">Total Risk</div>
                  <div className="text-xl font-bold text-red-400">₹{riskData.totalRisk.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
                </div>
                <div className="p-4 rounded-2xl bg-[#0a0a0b] border border-white/5">
                  <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">Risk %</div>
                  <div className="text-xl font-bold text-red-400">{riskData.riskPercent.toFixed(2)}%</div>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-[#0a0a0b] border border-white/5">
                <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">Capital Usage</div>
                <div className="text-xl font-bold text-blue-400">
                  ${(entryPrice * positionSize).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </div>
                <div className="text-[10px] text-gray-500 mt-1">
                  {((entryPrice * positionSize / settings.totalCapital) * 100).toFixed(1)}% of total capital
                </div>
              </div>
            </div>

            {isRiskExceeded && (
              <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-start gap-4">
                <AlertTriangle className="text-red-400 shrink-0" size={20} />
                <div>
                  <h4 className="text-sm font-bold text-red-400 uppercase tracking-wider">Risk Limit Exceeded</h4>
                  <p className="text-sm text-red-400/80">
                    Your risk of ${riskData.totalRisk.toLocaleString(undefined, { minimumFractionDigits: 2 })} exceeds your maximum allowed risk of ${maxRiskAllowed.toLocaleString(undefined, { minimumFractionDigits: 2 })} ({settings.riskPerTradePercent}% of ${settings.totalCapital.toLocaleString()}).
                    Reduce your position size or tighten stop loss.
                  </p>
                </div>
              </div>
            )}

            <div className="flex gap-4">
              <button
                onClick={() => setStep(1)}
                className="flex-1 px-6 py-4 bg-white/5 hover:bg-white/10 text-gray-300 rounded-2xl font-bold transition-all"
              >
                Back
              </button>
              <button
                onClick={() => setStep(3)}
                className="flex-[2] px-6 py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl font-bold transition-all shadow-xl shadow-blue-600/20"
              >
                Next: Checklist
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Step 3: Checklist */}
      {step === 3 && (
        <div className="max-w-2xl mx-auto space-y-8">
          <div className="p-8 rounded-3xl bg-[#161618] border border-white/5 space-y-8">
            <div>
              <h2 className="text-xl font-semibold">Final Entry Checklist</h2>
              <p className="text-sm text-gray-500">Confirm all technical requirements are met before execution.</p>
            </div>

            <div className="space-y-4">
              {Object.entries(checklist).map(([key, value]) => (
                <button
                  key={key}
                  onClick={() => setChecklist({ ...checklist, [key]: !value })}
                  className={`w-full flex items-center justify-between p-4 rounded-2xl border transition-all ${
                    value ? 'bg-green-500/10 border-green-500/30 text-green-400' : 'bg-[#0a0a0b] border-white/10 text-gray-400 hover:border-white/20'
                  }`}
                >
                  <span className="font-medium capitalize">{key.replace(/([A-Z])/g, ' ₹1')}</span>
                  {value ? <CheckCircle2 size={20} /> : <div className="w-5 h-5 rounded-full border-2 border-white/10" />}
                </button>
              ))}
            </div>

            <div className="pt-4 space-y-4">
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Entry notes, psychological state, etc."
                className="w-full bg-[#0a0a0b] border border-white/10 rounded-2xl px-4 py-4 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all min-h-[120px]"
              />

              <div className="flex gap-4">
                <button
                  onClick={() => setStep(2)}
                  className="flex-1 px-6 py-4 bg-white/5 hover:bg-white/10 text-gray-300 rounded-2xl font-bold transition-all"
                >
                  Back
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={!canSubmit}
                  className={`flex-[2] px-6 py-4 rounded-2xl font-bold transition-all shadow-xl ${
                    canSubmit 
                      ? 'bg-green-600 hover:bg-green-500 text-white shadow-green-600/20' 
                      : 'bg-gray-800 text-gray-500 cursor-not-allowed'
                  }`}
                >
                  Execute Trade
                </button>
              </div>
            </div>
          </div>
          
          {!isChecklistComplete && (
            <p className="text-center text-sm text-gray-500">Complete all checklist items to enable execution.</p>
          )}
          {scoringData.percentage < 60 && (
            <p className="text-center text-sm text-red-400 font-bold">Setup quality too low to execute.</p>
          )}
        </div>
      )}
    </div>
  );
}
