import { z } from 'zod';

export const tradeDecisionSchema = z.union([
  z.object({
    decision: z.literal('DO_NOT_TRADE'),
    reason: z.string().min(1),
  }),
  z.object({
    decision: z.literal('TRADE'),
    allocation: z.number().gt(0).lte(1),
    positionSize: z.number().gt(0),
    maxLoss: z.number().gte(0),
    percentOfCapital: z.number().gte(0).lte(100),
    riskLevel: z.enum(['safe', 'moderate', 'aggressive']),
  }),
]);
