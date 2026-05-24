'use client';

type CustomCandlePeriod = '1h' | '1d' | '2d' | '3d' | '5d' | '1w' | '3w' | '1m';

type Props = {
  /** NSE equity symbol or index name (e.g. `NIFTY 50`) */
  symbol: string;
  /** Equity uses EOD history; index uses NSE graph chart (close-only → synthetic OHLC). */
  seriesKind?: 'equity' | 'index';
  className?: string;
  /** Optional YYYY-MM-DD window; defaults to the last ~3 years */
  historyFrom?: string;
  historyTo?: string;
  /** Initial timeframe (scanner defaults to 1H). */
  defaultPeriod?: CustomCandlePeriod;
};

export default function NseEquityCandleChartWidget({
  symbol,
  seriesKind = 'equity',
  className,
  historyFrom,
  historyTo,
  defaultPeriod = '3d',
}: Props) {
  const displaySymbol = symbol.trim().toUpperCase();
  const displayKind = seriesKind === 'index' ? 'Index' : 'Equity';
  void historyFrom;
  void historyTo;
  void defaultPeriod;
  return (
    <div className={['flex h-full min-h-0 w-full min-w-0 flex-col gap-2', className].filter(Boolean).join(' ')}>
      <div className="relative min-h-0 flex-1 w-full overflow-hidden rounded-xl border border-white/10 bg-[#0a0a0b]">
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 px-4 text-center">
          <p className="text-sm font-semibold text-gray-200">Feature in progress</p>
          <p className="text-xs text-gray-500">
            K-line chart is temporarily disabled for {displayKind} {displaySymbol || 'symbol'}.
          </p>
        </div>
      </div>
    </div>
  );
}
