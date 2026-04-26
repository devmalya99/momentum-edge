'use client';

type RelativeTurnoverFilterControlProps = {
  value: number;
  onChange: (value: number) => void;
  max?: number;
};

export default function RelativeTurnoverFilterControl({
  value,
  onChange,
  max = 10,
}: RelativeTurnoverFilterControlProps) {
  return (
    <label className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-[#0a0a0b] px-2 py-1 text-[10px] font-semibold text-gray-300">
      <span className="uppercase tracking-wide text-gray-500">Min Vol/MCap</span>
      <input
        type="range"
        min={0}
        max={max}
        step={0.1}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-1.5 w-24 accent-blue-400"
        aria-label="Minimum relative turnover percent"
      />
      <span className="font-mono tabular-nums text-cyan-300">{value.toFixed(1)}%</span>
    </label>
  );
}
