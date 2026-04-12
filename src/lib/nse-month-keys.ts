const NSE_MONTHS = [
  'JAN',
  'FEB',
  'MAR',
  'APR',
  'MAY',
  'JUN',
  'JUL',
  'AUG',
  'SEP',
  'OCT',
  'NOV',
  'DEC',
] as const;

/** NSE `year` query format, e.g. `FEB-2026`. */
export function formatNseMonthYear(date: Date): string {
  return `${NSE_MONTHS[date.getMonth()]}-${date.getFullYear()}`;
}

/** How many NSE monthly advance/decline series we fetch in parallel. */
export const NSE_MONTHLY_LOOKBACK = 12;

/**
 * Last `count` completed calendar months before `reference`, newest first.
 * Example: 2026-04-05, count 6 → MAR-2026, FEB-2026, JAN-2026, DEC-2025, NOV-2025, OCT-2025.
 */
export function getPriorNseMonthKeys(
  reference = new Date(),
  count = NSE_MONTHLY_LOOKBACK,
): string[] {
  const y = reference.getFullYear();
  const m = reference.getMonth();
  const keys: string[] = [];
  for (let i = 1; i <= count; i++) {
    keys.push(formatNseMonthYear(new Date(y, m - i, 1)));
  }
  return keys;
}

/**
 * Newest-first: last `count` months inside one calendar year (Dec → …).
 * Example: year 2023, count 6 → DEC-2023, NOV-2023, …, JUL-2023.
 */
export function getLastNMonthsOfCalendarYear(year: number, count: number): string[] {
  const out: string[] = [];
  for (let i = 0; i < count; i++) {
    const monthIdx = 11 - i;
    if (monthIdx < 0) break;
    out.push(`${NSE_MONTHS[monthIdx]}-${year}`);
  }
  return out;
}
