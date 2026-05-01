import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { useTradeStore } from '../store/useTradeStore';
import { getVerdictColor } from '../utils/calculations';
import { AlertTriangle, CheckCircle2, Info, ArrowRight, Search, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import {
  calculateDeliveryChargesAtStop,
  calculateFrictionCost,
  calculateRiskData,
  calculateRiskRewardPlan,
  calculateScoringData,
  calculateStopLossMoneyAtRisk,
  parseMtfInputs,
  roundToTick,
} from '@/features/entry/entry-calculations';

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

export default function Entry() {
  const { rules, settings, addTrade } = useTradeStore();
  const [step, setStep] = useState(1); // 1: Rule validation, 2: Details
  
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
  const [isMtfTrade, setIsMtfTrade] = useState(false);
  const [mtfLeverageStr, setMtfLeverageStr] = useState('2');
  const [mtfPlannedDaysStr, setMtfPlannedDaysStr] = useState('1');
  const [mtfInterestRateStr, setMtfInterestRateStr] = useState('16');

  // Scoring State
  const [ruleScores, setRuleScores] = useState<Record<string, number>>({});
  
  const enabledRules = useMemo(() => rules.filter(r => r.enabled), [rules]);
  
  const scoringData = useMemo(
    () => calculateScoringData(ruleScores, enabledRules.length),
    [ruleScores, enabledRules.length],
  );

  const riskData = useMemo(
    () => calculateRiskData(entryPrice, stopLoss, positionSize),
    [entryPrice, stopLoss, positionSize],
  );

  const stopLossMoneyAtRisk = useMemo(
    () => calculateStopLossMoneyAtRisk(entryPrice, stopLoss, positionSize),
    [entryPrice, stopLoss, positionSize],
  );

  const mtfInputs = useMemo(
    () =>
      parseMtfInputs({
        mtfLeverageStr,
        mtfPlannedDaysStr,
        mtfInterestRateStr,
        defaultAnnualRate: settings.mtfRate ?? 0.16,
      }),
    [mtfLeverageStr, mtfPlannedDaysStr, mtfInterestRateStr, settings.mtfRate],
  );

  const deliveryChargesAtStop = useMemo(
    () =>
      calculateDeliveryChargesAtStop({
        entryPrice,
        stopLoss,
        positionSize,
        isMtfTrade,
        mtfInputs,
      }),
    [entryPrice, stopLoss, positionSize, isMtfTrade, mtfInputs],
  );

  const frictionCost = useMemo(() => calculateFrictionCost(deliveryChargesAtStop), [deliveryChargesAtStop]);

  /** Long: target % above entry; R:R = reward per share ÷ risk per share. */
  const riskRewardPlan = useMemo(
    () =>
      calculateRiskRewardPlan({
        targetGainPercentStr,
        entryPrice,
        stopLoss,
        positionSize,
        quoteTickSize,
      }),
    [targetGainPercentStr, entryPrice, stopLoss, positionSize, quoteTickSize],
  );

  const canSubmit = symbol && type && entryPrice > 0 && stopLoss > 0 && positionSize > 0 && scoringData.percentage >= 60;

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
    const checklist = enabledRules.reduce<Record<string, boolean>>((acc, rule) => {
      acc[rule.name] = ruleScores[rule.id] === 1;
      return acc;
    }, {});
    
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
      mtf: {
        enabled: isMtfTrade,
        leverage: mtfInputs.leverage,
        plannedHoldDays: mtfInputs.plannedDays,
        annualInterestRate: mtfInputs.annualRate * 100,
        pledgeCharge: isMtfTrade ? 20 : 0,
        unpledgeCharge: isMtfTrade ? 20 : 0,
      },
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
          {[1, 2].map((s) => (
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

      {/* Step 1: Rule Validation */}
      {step === 1 && (
        <div className="space-y-6">
          <div className="p-8 rounded-3xl bg-[#161618] border border-white/5 shadow-2xl">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
              <div>
                <h2 className="text-xl font-semibold">Rule Check (Yes / No)</h2>
                <p className="text-sm text-gray-500">Mark each active rule as passed or not passed.</p>
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
              {enabledRules.length === 0 ? (
                <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4 text-sm text-amber-300">
                  No active rules found. Add your rules in the Rules page or Settings first.
                </div>
              ) : null}
              {enabledRules.map((rule) => (
                <div key={rule.id} className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-300 font-medium">{rule.name}</span>
                    <span className="text-gray-500">{ruleScores[rule.id] === 1 ? 'Yes' : 'No'}</span>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setRuleScores({ ...ruleScores, [rule.id]: 1 })}
                      className={`px-4 py-2 rounded-xl text-xs font-bold border transition-all ${
                        ruleScores[rule.id] === 1
                          ? 'bg-green-500/20 border-green-500/40 text-green-300'
                          : 'bg-[#0a0a0b] border-white/10 text-gray-400 hover:border-white/20'
                      }`}
                    >
                      Yes
                    </button>
                    <button
                      type="button"
                      onClick={() => setRuleScores({ ...ruleScores, [rule.id]: 0 })}
                      className={`px-4 py-2 rounded-xl text-xs font-bold border transition-all ${
                        ruleScores[rule.id] !== 1
                          ? 'bg-red-500/20 border-red-500/40 text-red-300'
                          : 'bg-[#0a0a0b] border-white/10 text-gray-400 hover:border-white/20'
                      }`}
                    >
                      No
                    </button>
                  </div>
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

              <div className="rounded-2xl border border-white/10 bg-[#0a0a0b] p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold uppercase tracking-wider text-gray-400">
                    Is this an MTF trade?
                  </label>
                  <button
                    type="button"
                    onClick={() => setIsMtfTrade((prev) => !prev)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                      isMtfTrade
                        ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
                        : 'bg-white/5 border-white/10 text-gray-400'
                    }`}
                  >
                    {isMtfTrade ? 'Yes' : 'No'}
                  </button>
                </div>
                {isMtfTrade ? (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1">
                        Leverage (1x - 5x)
                      </label>
                      <input
                        type="text"
                        value={mtfLeverageStr}
                        onChange={(e) => setMtfLeverageStr(e.target.value)}
                        placeholder="e.g. 2.5"
                        className="w-full bg-[#111114] border border-white/10 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1">
                        Planned hold days
                      </label>
                      <input
                        type="number"
                        min={1}
                        value={mtfPlannedDaysStr}
                        onChange={(e) => setMtfPlannedDaysStr(e.target.value)}
                        className="w-full bg-[#111114] border border-white/10 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1">
                        Interest rate (% p.a.)
                      </label>
                      <input
                        type="number"
                        min={0}
                        step={0.01}
                        value={mtfInterestRateStr}
                        onChange={(e) => setMtfInterestRateStr(e.target.value)}
                        className="w-full bg-[#111114] border border-white/10 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 transition-all"
                      />
                    </div>
                  </div>
                ) : null}
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
                      <span className="font-mono">{positionSize || '_'}</span>
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
                      <span className="text-gray-500">× {positionSize || '_'} = </span>
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
                  {isMtfTrade ? 'Total Buy Value (cash+ mtf)' : 'Total Buy Value (cash)'} ₹{(entryPrice * positionSize).toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                  })}
                </div>
                {deliveryChargesAtStop ? (
                  <div className="text-[10px] text-gray-500 mt-1">
                    Effective investment ({isMtfTrade ? 'MTF' : 'Cash'}) : ₹
                    {isMtfTrade ? Math.round(entryPrice * positionSize/parseFloat(mtfLeverageStr))  : entryPrice * positionSize}
                    {isMtfTrade ? ` (${deliveryChargesAtStop.leverage.toFixed(2)}x)` : ''}
                  </div>
                ) : null}
              </div>

              <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/25 space-y-2">
                <div className="text-[10px] font-bold text-amber-300/90 uppercase tracking-widest">
                  Estimated taxes & charges (delivery)
                </div>
                {deliveryChargesAtStop ? (
                  <>
                    <div className="grid grid-cols-[1.4fr_1fr_1fr] gap-2 text-[11px] text-gray-300">
                      <div className="text-gray-500 uppercase tracking-wide">Charge</div>
                      <div className="text-right text-gray-500 uppercase tracking-wide">Single sell</div>
                      <div className="text-right text-gray-500 uppercase tracking-wide">3-step sell</div>

                      <div>Buy STT</div>
                      <div className="text-right font-mono">₹{deliveryChargesAtStop.buyStt.toFixed(2)}</div>
                      <div className="text-right font-mono">₹{deliveryChargesAtStop.buyStt.toFixed(2)}</div>

                      <div>Sell STT</div>
                      <div className="text-right font-mono">₹{deliveryChargesAtStop.sellStt.toFixed(2)}</div>
                      <div className="text-right font-mono">₹{deliveryChargesAtStop.threeStepSell.stt.toFixed(2)}</div>

                      <div>Stamp Duty (Buy)</div>
                      <div className="text-right font-mono">₹{deliveryChargesAtStop.stampDuty.toFixed(2)}</div>
                      <div className="text-right font-mono">₹{deliveryChargesAtStop.threeStepSell.stampDuty.toFixed(2)}</div>

                      <div>Txn Charges</div>
                      <div className="text-right font-mono">₹{deliveryChargesAtStop.transactionCharge.toFixed(2)}</div>
                      <div className="text-right font-mono">₹{deliveryChargesAtStop.threeStepSell.transactionCharge.toFixed(2)}</div>

                      <div>SEBI Charges</div>
                      <div className="text-right font-mono">₹{deliveryChargesAtStop.sebiCharge.toFixed(2)}</div>
                      <div className="text-right font-mono">₹{deliveryChargesAtStop.threeStepSell.sebiCharge.toFixed(2)}</div>

                      <div>GST</div>
                      <div className="text-right font-mono">₹{deliveryChargesAtStop.gst.toFixed(2)}</div>
                      <div className="text-right font-mono">₹{deliveryChargesAtStop.threeStepSell.gst.toFixed(2)}</div>

                      <div>Brokerage</div>
                      <div className="text-right font-mono">₹{deliveryChargesAtStop.brokerage.toFixed(2)}</div>
                      <div className="text-right font-mono">₹{deliveryChargesAtStop.threeStepSell.sellBrokerage.toFixed(2)}</div>

                      <div>DP Charges</div>
                      <div className="text-right font-mono">₹{deliveryChargesAtStop.dpCharge.toFixed(2)}</div>
                      <div className="text-right font-mono">₹{deliveryChargesAtStop.threeStepSell.dpCharge.toFixed(2)}</div>

                      {isMtfTrade ? (
                        <>
                          <div>MTF Interest</div>
                          <div className="text-right font-mono">₹{deliveryChargesAtStop.mtfInterest.toFixed(2)}</div>
                          <div className="text-right font-mono">₹{deliveryChargesAtStop.threeStepSell.mtfInterest.toFixed(2)}</div>

                          <div>MTF Interest Rate</div>
                          <div className="text-right font-mono">{(mtfInputs.annualRate * 100).toFixed(2)}%</div>
                          <div className="text-right font-mono">{(mtfInputs.annualRate * 100).toFixed(2)}%</div>

                          <div>Pledge + Unpledge</div>
                          <div className="text-right font-mono">₹{deliveryChargesAtStop.mtfPledgeCharges.toFixed(2)}</div>
                          <div className="text-right font-mono">₹{deliveryChargesAtStop.threeStepSell.mtfPledgeCharges.toFixed(2)}</div>
                        </>
                      ) : null}
                    </div>
                    <div className="pt-2 border-t border-amber-500/20 grid grid-cols-[1.4fr_1fr_1fr] gap-2 items-center">
                      <span className="text-xs text-amber-200">Total charges</span>
                      <span className="font-mono font-bold text-amber-100 text-right">₹{deliveryChargesAtStop.totalCharges.toFixed(2)}</span>
                      <span className="font-mono font-bold text-amber-100 text-right">
                        ₹{deliveryChargesAtStop.totalChargesThreeStepSell.toFixed(2)}
                      </span>
                    </div>
                    <div className="pt-2 border-t border-amber-500/20 grid grid-cols-[1.4fr_1fr_1fr] gap-2 items-center">
                      <span className="text-xs text-amber-200">Final risk (leveraged loss + charges)</span>
                      <span className="font-mono font-bold text-red-300 text-right">₹{deliveryChargesAtStop.finalRisk.toFixed(2)}</span>
                      <span className="font-mono font-bold text-red-300 text-right">
                        ₹{deliveryChargesAtStop.finalRiskThreeStepSell.toFixed(2)}
                      </span>
                    </div>
                    <p className="text-[10px] text-amber-200/70">3-step sell values are shown as cumulative totals.</p>
                  </>
                ) : (
                  <p className="text-xs text-gray-500">
                    Enter valid entry, stop loss, and shares to estimate charges and final risk.
                  </p>
                )}
              </div>

              {frictionCost ? (
                <div
                  className={`p-4 rounded-2xl border space-y-2 ${
                    frictionCost.tone === 'high'
                      ? 'bg-red-500/10 border-red-500/30'
                      : frictionCost.tone === 'medium'
                        ? 'bg-amber-500/10 border-amber-500/30'
                        : 'bg-emerald-500/10 border-emerald-500/30'
                  }`}
                >
                  <div
                    className={`text-[10px] font-bold uppercase tracking-widest ${
                      frictionCost.tone === 'high'
                        ? 'text-red-300'
                        : frictionCost.tone === 'medium'
                          ? 'text-amber-300'
                          : 'text-emerald-300'
                    }`}
                  >
                    Friction Cost
                  </div>
                  <div
                    className={`text-2xl font-black ${
                      frictionCost.tone === 'high'
                        ? 'text-red-300'
                        : frictionCost.tone === 'medium'
                          ? 'text-amber-300'
                          : 'text-emerald-300'
                    }`}
                  >
                    {frictionCost.percent.toFixed(2)}%
                  </div>
                  {typeof frictionCost.threeStepPercent === 'number' ? (
                    <div className="text-sm text-gray-300">
                      <span className="text-gray-500">3-step sell friction: </span>
                      <span className="font-mono font-semibold text-amber-300">
                        {frictionCost.threeStepPercent.toFixed(2)}%
                      </span>
                      <span className="text-gray-500">
                        {' '}
                        (+
                        {(frictionCost.threeStepPercent - frictionCost.percent).toFixed(2)}
                        %)
                      </span>
                    </div>
                  ) : null}
                  <p className="text-xs text-gray-300">{frictionCost.message}</p>
                  <p className="text-[11px] text-gray-500">
                    Formula: total charges / capital deployed * 100
                  </p>
                </div>
              ) : null}
            </div>

            <div className="flex gap-4">
              <button
                onClick={() => setStep(1)}
                className="flex-1 px-6 py-4 bg-white/5 hover:bg-white/10 text-gray-300 rounded-2xl font-bold transition-all"
              >
                Back
              </button>
              <button
                onClick={handleSubmit}
                disabled={!canSubmit}
                className={`flex-2 px-6 py-4 rounded-2xl font-bold transition-all shadow-xl ${
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
      )}
    </div>
  );
}
