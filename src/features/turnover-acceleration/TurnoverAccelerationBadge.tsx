'use client';

type TurnoverAccelerationBadgeProps = {
  value: number | null | undefined;
};

export default function TurnoverAccelerationBadge({ value }: TurnoverAccelerationBadgeProps) {
  if (value == null || !Number.isFinite(value)) {
    return <span className="text-[10px] font-semibold text-gray-500">Vol Surge: —</span>;
  }
  const positive = value >= 0;
  return (
    <span className={`text-[10px] font-semibold ${positive ? 'text-emerald-400' : 'text-rose-400'}`}>
      Vol Surge: {positive ? '+' : ''}
      {value.toFixed(1)}%
    </span>
  );
}
