import { z } from 'zod';

const noFractionBetweenZeroAndOne = (v: number) => v <= 0 || v >= 1;

/** Win rate as a percentage 0–100 (e.g. 55 for 55%). Rejects 0–1 decimals (old fraction form like 0.55). */
export const inputSchema = z.object({
  winRate: z
    .number()
    .min(0, 'Win rate must be at least 0')
    .max(100, 'Win rate cannot exceed 100')
    .refine(noFractionBetweenZeroAndOne, {
      message: 'Use percentage form (e.g. 55 for 55%), not a decimal fraction like 0.55',
    }),
  averageWin: z.number().nonnegative('Average win must be zero or positive'),
  averageLoss: z.number().nonnegative('Average loss must be zero or positive'),
  totalCapital: z.number().nonnegative('Total capital must be zero or positive'),
  stopLossModel: z.enum(['percent', 'absolute']),
  /** Stop width as % of position, 0–100 (e.g. 3 for 3%). Used when stopLossModel is percent. */
  stopLossPercent: z
    .number()
    .min(0, 'Stop loss % must be at least 0')
    .max(100, 'Stop loss % cannot exceed 100'),
  /** Rupee amount when stopLossModel is absolute. */
  stopLossAbsolute: z.number().nonnegative('Stop loss amount must be zero or positive'),
  feesPerTrade: z.number().nonnegative('Fees per trade must be zero or positive'),
  /** Tax as % of gains: 0–100, whole or decimal (e.g. 2 = 2%, 0.02 = 0.02%). */
  taxRate: z
    .number()
    .min(0, 'Tax rate must be at least 0')
    .max(100, 'Tax rate cannot exceed 100'),
});

export const defaultPositionParameters: z.infer<typeof inputSchema> = {
  winRate: 55,
  averageWin: 0,
  averageLoss: 0,
  totalCapital: 0,
  stopLossModel: 'percent',
  stopLossPercent: 3,
  stopLossAbsolute: 0,
  feesPerTrade: 0,
  taxRate: 20,
};
