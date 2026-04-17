import { getNeonSql } from '@/lib/db/ad-ratio';
import { ensureUsersTable } from '@/lib/db/users';
import type { UserBalanceSheet } from '@/lib/balance-sheet/schemas';

type UserBalanceSheetRow = {
  actual_invested: number;
  current_holding_value: number;
  unrealised_pnl: number;
  unrealised_pnl_pct: number;
  bank_balance: number;
  ppf_amount: number;
  liquid_fund_investment: number;
  fixed_deposit: number;
  total_debt: number;
  networth: number;
  monthly_salary: number;
  margin_amount: number;
  total_credit_card_due: number;
};

let userBalanceSheetSchemaReady = false;

const DEFAULT_BALANCE_SHEET: UserBalanceSheet = {
  actualInvested: 0,
  currentHoldingValue: 0,
  unrealisedPnl: 0,
  unrealisedPnlPct: 0,
  bankBalance: 0,
  ppfAmount: 0,
  liquidFundInvestment: 0,
  fixedDeposit: 0,
  totalDebt: 0,
  networth: 0,
  monthlySalary: 0,
  marginAmount: 0,
  totalCreditCardDue: 0,
};

function mapUserBalanceSheet(row: UserBalanceSheetRow | undefined): UserBalanceSheet {
  if (!row) return DEFAULT_BALANCE_SHEET;
  return {
    actualInvested: Number(row.actual_invested) || 0,
    currentHoldingValue: Number(row.current_holding_value) || 0,
    unrealisedPnl: Number(row.unrealised_pnl) || 0,
    unrealisedPnlPct: Number(row.unrealised_pnl_pct) || 0,
    bankBalance: Number(row.bank_balance) || 0,
    ppfAmount: Number(row.ppf_amount) || 0,
    liquidFundInvestment: Number(row.liquid_fund_investment) || 0,
    fixedDeposit: Number(row.fixed_deposit) || 0,
    totalDebt: Number(row.total_debt) || 0,
    networth: Number(row.networth) || 0,
    monthlySalary: Number(row.monthly_salary) || 0,
    marginAmount: Number(row.margin_amount) || 0,
    totalCreditCardDue: Number(row.total_credit_card_due) || 0,
  };
}

export async function ensureUserBalanceSheetTable(): Promise<void> {
  if (userBalanceSheetSchemaReady) return;
  await ensureUsersTable();
  const sql = getNeonSql();
  await sql`
    CREATE TABLE IF NOT EXISTS user_balance_sheet (
      user_id text PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      actual_invested double precision NOT NULL DEFAULT 0,
      current_holding_value double precision NOT NULL DEFAULT 0,
      unrealised_pnl double precision NOT NULL DEFAULT 0,
      unrealised_pnl_pct double precision NOT NULL DEFAULT 0,
      bank_balance double precision NOT NULL DEFAULT 0,
      ppf_amount double precision NOT NULL DEFAULT 0,
      liquid_fund_investment double precision NOT NULL DEFAULT 0,
      fixed_deposit double precision NOT NULL DEFAULT 0,
      total_debt double precision NOT NULL DEFAULT 0,
      networth double precision NOT NULL DEFAULT 0,
      monthly_salary double precision NOT NULL DEFAULT 0,
      margin_amount double precision NOT NULL DEFAULT 0,
      total_credit_card_due double precision NOT NULL DEFAULT 0,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `;
  userBalanceSheetSchemaReady = true;
}

export async function ensureUserBalanceSheetRow(userId: string): Promise<void> {
  await ensureUserBalanceSheetTable();
  const sql = getNeonSql();
  await sql`
    INSERT INTO user_balance_sheet (user_id)
    VALUES (${userId})
    ON CONFLICT (user_id) DO NOTHING
  `;
}

export async function getUserBalanceSheet(userId: string): Promise<UserBalanceSheet> {
  await ensureUserBalanceSheetRow(userId);
  const sql = getNeonSql();
  const rows = await sql`
    SELECT
      actual_invested,
      current_holding_value,
      unrealised_pnl,
      unrealised_pnl_pct,
      bank_balance,
      ppf_amount,
      liquid_fund_investment,
      fixed_deposit,
      total_debt,
      networth,
      monthly_salary,
      margin_amount,
      total_credit_card_due
    FROM user_balance_sheet
    WHERE user_id = ${userId}
    LIMIT 1
  `;
  return mapUserBalanceSheet(rows[0] as UserBalanceSheetRow | undefined);
}
