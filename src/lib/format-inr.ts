/** Consistent INR display (Indian digit grouping). */
export function formatInr(
  n: number,
  fractionDigits: { min?: number; max?: number } = { min: 2, max: 2 },
): string {
  const min = fractionDigits.min ?? 2;
  const max = fractionDigits.max ?? 2;
  return `₹${n.toLocaleString('en-IN', { minimumFractionDigits: min, maximumFractionDigits: max })}`;
}
