import { formatInr } from '@/lib/format-inr';

interface SliderInputProps {
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
  /** Defaults to legacy copy for other screens */
  title?: string;
  hint?: string;
}

export default function SliderInput({
  value,
  min,
  max,
  step = 1000,
  onChange,
  title = 'Total Invested',
  hint = 'Range adjusts with your capital profile',
}: SliderInputProps) {
  return (
    <div className="p-6 rounded-3xl bg-white/5 border border-white/10 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold uppercase tracking-widest text-cyan-300">{title}</h2>
          <p className="text-xs text-gray-500 mt-1">{hint}</p>
        </div>
        <div className="text-xl font-black text-cyan-300">{formatInr(value, { min: 0, max: 0 })}</div>
      </div>

      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="w-full accent-cyan-500"
      />

      <div className="flex justify-between text-[11px] text-gray-500">
        <span>{formatInr(min, { min: 0, max: 0 })}</span>
        <span>{formatInr(max, { min: 0, max: 0 })}</span>
      </div>
    </div>
  );
}
