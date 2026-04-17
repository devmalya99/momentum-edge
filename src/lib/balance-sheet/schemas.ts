import { z } from 'zod';

/**
 * User-specific balance sheet payload persisted in Neon.
 * Computed fields are updated from holdings uploads.
 * Manual fields are entered/edited by users.
 */
export const userBalanceSheetSchema = z.object({
  actualInvested: z.number().finite().min(0),
  currentHoldingValue: z.number().finite().min(0),
  unrealisedPnl: z.number().finite(),
  unrealisedPnlPct: z.number().finite(),

  bankBalance: z.number().finite(),
  ppfAmount: z.number().finite(),
  liquidFundInvestment: z.number().finite(),
  fixedDeposit: z.number().finite(),
  totalDebt: z.number().finite(),
  networth: z.number().finite(),
  monthlySalary: z.number().finite(),
  marginAmount: z.number().finite().min(0),
  totalCreditCardDue: z.number().finite().min(0),
});

/** Manual fields only; computed values are server-derived. */
export const updateUserBalanceSheetManualSchema = z.object({
  bankBalance: z.number().finite().optional(),
  ppfAmount: z.number().finite().optional(),
  liquidFundInvestment: z.number().finite().optional(),
  fixedDeposit: z.number().finite().optional(),
  totalDebt: z.number().finite().optional(),
  networth: z.number().finite().optional(),
  monthlySalary: z.number().finite().optional(),
  marginAmount: z.number().finite().min(0).optional(),
  totalCreditCardDue: z.number().finite().min(0).optional(),
});

export type UserBalanceSheet = z.infer<typeof userBalanceSheetSchema>;
export type UpdateUserBalanceSheetManualInput = z.infer<typeof updateUserBalanceSheetManualSchema>;
