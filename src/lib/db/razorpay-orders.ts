import { getNeonSql } from '@/lib/db/ad-ratio';
import { ensureUsersTable } from '@/lib/db/users';
import { setUserMembershipPremium } from '@/lib/membership/server';

export type RazorpayOrderStatus = 'created' | 'paid' | 'failed';

export type RazorpayOrderRow = {
  id: string;
  user_id: string;
  amount_paise: number;
  currency: string;
  status: RazorpayOrderStatus;
  razorpay_payment_id: string | null;
  created_at: string;
  paid_at: string | null;
};

let schemaReady = false;

async function ensureRazorpayOrdersTable(): Promise<void> {
  if (schemaReady) return;
  await ensureUsersTable();
  const sql = getNeonSql();
  await sql`
    CREATE TABLE IF NOT EXISTS razorpay_orders (
      id text PRIMARY KEY,
      user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      amount_paise integer NOT NULL,
      currency text NOT NULL DEFAULT 'INR',
      status text NOT NULL DEFAULT 'created',
      razorpay_payment_id text,
      created_at timestamptz NOT NULL DEFAULT now(),
      paid_at timestamptz
    )
  `;
  schemaReady = true;
}

export async function insertRazorpayOrder(input: {
  orderId: string;
  userId: string;
  amountPaise: number;
  currency?: string;
}): Promise<void> {
  await ensureRazorpayOrdersTable();
  const sql = getNeonSql();
  await sql`
    INSERT INTO razorpay_orders (id, user_id, amount_paise, currency, status)
    VALUES (
      ${input.orderId},
      ${input.userId},
      ${input.amountPaise},
      ${input.currency ?? 'INR'},
      'created'
    )
  `;
}

export async function markRazorpayOrderPaid(input: {
  orderId: string;
  paymentId: string;
  userId?: string;
}): Promise<boolean> {
  await ensureRazorpayOrdersTable();
  const sql = getNeonSql();

  const rows = input.userId
    ? await sql`
        UPDATE razorpay_orders
        SET
          status = 'paid',
          razorpay_payment_id = ${input.paymentId},
          paid_at = now()
        WHERE id = ${input.orderId}
          AND user_id = ${input.userId}
          AND status <> 'paid'
        RETURNING user_id
      `
    : await sql`
        UPDATE razorpay_orders
        SET
          status = 'paid',
          razorpay_payment_id = ${input.paymentId},
          paid_at = now()
        WHERE id = ${input.orderId}
          AND status <> 'paid'
        RETURNING user_id
      `;

  const userId = (rows[0] as { user_id?: string } | undefined)?.user_id;
  if (!userId) return false;

  await setUserMembershipPremium(userId);
  return true;
}
