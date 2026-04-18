import { getNeonSql } from '@/lib/db/ad-ratio';
import { listUserHoldings } from '@/lib/db/holdings';
import { ensureUsersTable } from '@/lib/db/users';

export type UserNetworthMaster = {
  /** Gross cost of holdings: Σ (qty × average price). Margin is stored separately. */
  totalInvested: number;
  currentHoldingValue: number;
  unrealisedPnl: number;
  unrealisedPnlPct: number;
  bankBalance: number;
  ppfAmount: number;
  liquidFundInvestment: number;
  fixedDeposit: number;
  totalDebt: number;
  networth: number;
  monthlySalary: number;
  marginAmount: number;
  /** Lifetime net cash moved from bank into the trading account (user-entered, for true market profit). */
  realInvestFromBank: number;
  totalCreditCardDue: number;
  /** Money others owe you (user-entered). */
  receivables: number;
};

type UserNetworthMasterRow = {
  total_invested: number;
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
  real_invest_from_bank: number;
  total_credit_card_due: number;
  receivables: number;
};

const DEFAULT_MASTER: UserNetworthMaster = {
  totalInvested: 0,
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
  realInvestFromBank: 0,
  totalCreditCardDue: 0,
  receivables: 0,
};

function mapRow(row: UserNetworthMasterRow | undefined): UserNetworthMaster {
  if (!row) return DEFAULT_MASTER;
  return {
    totalInvested: Number(row.total_invested) || 0,
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
    realInvestFromBank: Number(row.real_invest_from_bank) || 0,
    totalCreditCardDue: Number(row.total_credit_card_due) || 0,
    receivables: Number(row.receivables) || 0,
  };
}

/** Legacy DBs used `actual_invested` (net of margin). Rename and backfill to gross `total_invested`. */
async function migrateActualInvestedToTotalInvestedColumn(): Promise<void> {
  const sql = getNeonSql();
  await sql`
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'user_networth_master'
          AND column_name = 'actual_invested'
      ) THEN
        ALTER TABLE user_networth_master RENAME COLUMN actual_invested TO total_invested;
        UPDATE user_networth_master
        SET total_invested = total_invested + COALESCE(margin_amount, 0);
      END IF;
    END;
    $$;
  `;
}

/** Older deployments may have integer-typed numeric fields; normalize to doubles. */
async function migrateMasterNumericColumnsToDoublePrecision(): Promise<void> {
  const sql = getNeonSql();
  await sql`
    ALTER TABLE user_networth_master
    ALTER COLUMN total_invested TYPE double precision USING total_invested::double precision,
    ALTER COLUMN current_holding_value TYPE double precision USING current_holding_value::double precision,
    ALTER COLUMN unrealised_pnl TYPE double precision USING unrealised_pnl::double precision,
    ALTER COLUMN unrealised_pnl_pct TYPE double precision USING unrealised_pnl_pct::double precision,
    ALTER COLUMN bank_balance TYPE double precision USING bank_balance::double precision,
    ALTER COLUMN ppf_amount TYPE double precision USING ppf_amount::double precision,
    ALTER COLUMN liquid_fund_investment TYPE double precision USING liquid_fund_investment::double precision,
    ALTER COLUMN fixed_deposit TYPE double precision USING fixed_deposit::double precision,
    ALTER COLUMN total_debt TYPE double precision USING total_debt::double precision,
    ALTER COLUMN networth TYPE double precision USING networth::double precision,
    ALTER COLUMN monthly_salary TYPE double precision USING monthly_salary::double precision,
    ALTER COLUMN margin_amount TYPE double precision USING margin_amount::double precision,
    ALTER COLUMN total_credit_card_due TYPE double precision USING total_credit_card_due::double precision
  `;
}

async function migrateRealInvestFromBankColumn(): Promise<void> {
  const sql = getNeonSql();
  await sql`
    ALTER TABLE user_networth_master
    ADD COLUMN IF NOT EXISTS real_invest_from_bank double precision NOT NULL DEFAULT 0
  `;
}

async function migrateReceivablesColumn(): Promise<void> {
  const sql = getNeonSql();
  await sql`
    ALTER TABLE user_networth_master
    ADD COLUMN IF NOT EXISTS receivables double precision NOT NULL DEFAULT 0
  `;
}

export async function ensureUserNetworthMasterTable(): Promise<void> {
  await ensureUsersTable();
  const sql = getNeonSql();
  await sql`
    CREATE TABLE IF NOT EXISTS user_networth_master (
      user_id text PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      total_invested double precision NOT NULL DEFAULT 0,
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
      real_invest_from_bank double precision NOT NULL DEFAULT 0,
      total_credit_card_due double precision NOT NULL DEFAULT 0,
      receivables double precision NOT NULL DEFAULT 0,
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `;
  await migrateActualInvestedToTotalInvestedColumn();
  await migrateMasterNumericColumnsToDoublePrecision();
  await migrateRealInvestFromBankColumn();
  await migrateReceivablesColumn();
}

export async function ensureUserNetworthMasterRow(userId: string): Promise<void> {
  await ensureUserNetworthMasterTable();
  const sql = getNeonSql();
  await sql`
    INSERT INTO user_networth_master (user_id)
    VALUES (${userId})
    ON CONFLICT (user_id) DO NOTHING
  `;
}

export async function getUserNetworthMaster(userId: string): Promise<UserNetworthMaster> {
  await ensureUserNetworthMasterRow(userId);
  const sql = getNeonSql();
  const rows = await sql`
    SELECT
      total_invested,
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
      real_invest_from_bank,
      total_credit_card_due,
      receivables
    FROM user_networth_master
    WHERE user_id = ${userId}
    LIMIT 1
  `;
  return mapRow(rows[0] as UserNetworthMasterRow | undefined);
}

export async function updateRealInvestFromBank(
  userId: string,
  realInvestFromBank: number,
): Promise<UserNetworthMaster> {
  await ensureUserNetworthMasterRow(userId);
  const sql = getNeonSql();
  const v = Math.max(0, Number(realInvestFromBank) || 0);
  await sql`
    UPDATE user_networth_master
    SET
      real_invest_from_bank = ${v},
      updated_at = now()
    WHERE user_id = ${userId}
  `;
  return getUserNetworthMaster(userId);
}

export async function updateMasterFinancialField(
  userId: string,
  field: 'totalCreditCardDue' | 'ppfAmount' | 'liquidFundInvestment' | 'receivables',
  value: number,
): Promise<UserNetworthMaster> {
  await ensureUserNetworthMasterRow(userId);
  const sql = getNeonSql();
  const safeValue = Math.max(0, Number(value) || 0);

  if (field === 'totalCreditCardDue') {
    await sql`
      UPDATE user_networth_master
      SET
        total_credit_card_due = ${safeValue},
        updated_at = now()
      WHERE user_id = ${userId}
    `;
    return getUserNetworthMaster(userId);
  }

  if (field === 'ppfAmount') {
    await sql`
      UPDATE user_networth_master
      SET
        ppf_amount = ${safeValue},
        updated_at = now()
      WHERE user_id = ${userId}
    `;
    return getUserNetworthMaster(userId);
  }

  if (field === 'receivables') {
    await sql`
      UPDATE user_networth_master
      SET
        receivables = ${safeValue},
        updated_at = now()
      WHERE user_id = ${userId}
    `;
    return getUserNetworthMaster(userId);
  }

  await sql`
    UPDATE user_networth_master
    SET
      liquid_fund_investment = ${safeValue},
      updated_at = now()
    WHERE user_id = ${userId}
  `;
  return getUserNetworthMaster(userId);
}

export async function updateMarginAmount(userId: string, marginAmount: number): Promise<void> {
  await ensureUserNetworthMasterRow(userId);
  const sql = getNeonSql();
  await sql`
    UPDATE user_networth_master
    SET
      margin_amount = ${marginAmount},
      updated_at = now()
    WHERE user_id = ${userId}
  `;
}

/**
 * Persists margin, then recomputes total_invested / unrealised_* from user_holdings
 * so master stays correct after margin changes.
 */
export async function updateMarginAmountAndRecomputeFromHoldings(
  userId: string,
  marginAmount: number,
): Promise<UserNetworthMaster> {
  await updateMarginAmount(userId, marginAmount);
  const rows = await listUserHoldings(userId);
  const investedGross = rows.reduce(
    (sum, r) => sum + Number(r.quantity) * Number(r.average_price),
    0,
  );
  const currentHoldingValue = rows.reduce(
    (sum, r) => sum + Number(r.quantity) * Number(r.previous_close_price),
    0,
  );
  return updateComputedFromHoldings(userId, { investedGross, currentHoldingValue });
}

export async function updateComputedFromHoldings(
  userId: string,
  input: { investedGross: number; currentHoldingValue: number },
): Promise<UserNetworthMaster> {
  await ensureUserNetworthMasterRow(userId);
  const sql = getNeonSql();
  // Keep persisted master values integer-safe for legacy schemas that still use integer columns.
  const investedGross = Math.round(Math.max(0, Number(input.investedGross) || 0));
  const currentHoldingValue = Math.round(Number(input.currentHoldingValue) || 0);
  await sql`
    UPDATE user_networth_master
    SET
      total_invested = ${investedGross},
      current_holding_value = ${currentHoldingValue},
      unrealised_pnl = (${currentHoldingValue}::double precision - ${investedGross}::double precision),
      unrealised_pnl_pct = CASE
        WHEN ${investedGross}::double precision > 0
        THEN (
          (${currentHoldingValue}::double precision - ${investedGross}::double precision)
          / ${investedGross}::double precision
        ) * 100::double precision
        ELSE 0::double precision
      END,
      updated_at = now()
    WHERE user_id = ${userId}
  `;
  return getUserNetworthMaster(userId);
}
