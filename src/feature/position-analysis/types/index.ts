import type { z } from 'zod';

import { inputSchema } from '@/position-analysis/schema/inputSchema';
import { tradeDecisionSchema } from '@/position-analysis/schema/outputSchema';

export type PositionParameters = z.infer<typeof inputSchema>;

export type StopLossModel = PositionParameters['stopLossModel'];

export type TradeDecision = z.infer<typeof tradeDecisionSchema>;
