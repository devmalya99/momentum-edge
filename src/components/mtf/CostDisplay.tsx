import { formatInr } from '@/lib/format-inr';

interface CostDisplayProps {
  dailyCost: number;
  weeklyCost: number;
  monthlyCost: number;
  yearlyCost: number;
}

export default function CostDisplay({
  dailyCost,
  weeklyCost,
  monthlyCost,
  yearlyCost,
}: CostDisplayProps) {
  const rows = [
    { label: 'Per Day Cost', value: dailyCost },
    { label: 'Per Week Cost', value: weeklyCost },
    { label: 'Per Month Cost', value: monthlyCost },
    { label: 'Per Year Cost', value: yearlyCost },
  ];

  return (
    <div className="p-6 rounded-3xl bg-white/5 border border-white/10">
      <div className="flex items-center gap-2 mb-4">
        <h3 className="text-sm font-bold uppercase tracking-widest text-blue-300">Interest Cost</h3>
        <span
          className="text-xs text-gray-500 cursor-help"
          title="These costs are simple-interest expenses on borrowed margin and reduce your final return."
        >
          ⓘ
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {rows.map((row) => (
          <div key={row.label} className="p-4 rounded-2xl bg-[#0a0a0b] border border-white/5">
            <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-1">{row.label}</div>
            <div className="text-lg font-bold">{formatInr(row.value)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
