'use client';

type RelativeTurnoverFilterControlProps = {
  label?: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
};

export default function RelativeTurnoverFilterControl({
  label = 'Min 30D Turnover/MCap',
  value,
  onChange,
  min = 0,
  max = 10,
  step = 0.1,
}: RelativeTurnoverFilterControlProps) {
  return (
    <label className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-[#0a0a0b] px-2 py-1 text-[10px] font-semibold text-gray-300">
      <span className="uppercase tracking-wide text-gray-500">{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-1.5 w-24 accent-blue-400"
        aria-label={label}
      />
      <span className="font-mono tabular-nums text-cyan-300">{value.toFixed(1)}%</span>
    </label>
  );
}
