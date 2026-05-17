import { createHmac, timingSafeEqual } from 'node:crypto';
import { getRazorpayKeyId, getRazorpayKeySecret } from '@/lib/razorpay/config';

type RazorpayOrderResponse = {
  id: string;
  amount: number;
  currency: string;
  receipt?: string;
  status?: string;
};

async function razorpayPost<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const auth = Buffer.from(`${getRazorpayKeyId()}:${getRazorpayKeySecret()}`).toString('base64');
  const res = await fetch(`https://api.razorpay.com/v1${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let json: T & { error?: { description?: string } };
  try {
    json = JSON.parse(text) as T & { error?: { description?: string } };
  } catch {
    throw new Error(`Razorpay error (${res.status}): ${text.slice(0, 200)}`);
  }
  if (!res.ok) {
    throw new Error(json.error?.description ?? `Razorpay request failed (${res.status})`);
  }
  return json as T;
}

export async function createRazorpayOrder(input: {
  amountPaise: number;
  currency?: string;
  receipt: string;
  notes?: Record<string, string>;
}): Promise<RazorpayOrderResponse> {
  return razorpayPost<RazorpayOrderResponse>('/orders', {
    amount: input.amountPaise,
    currency: input.currency ?? 'INR',
    receipt: input.receipt,
    notes: input.notes ?? {},
  });
}

export function verifyRazorpayPaymentSignature(input: {
  orderId: string;
  paymentId: string;
  signature: string;
}): boolean {
  const secret = getRazorpayKeySecret();
  const payload = `${input.orderId}|${input.paymentId}`;
  const expected = createHmac('sha256', secret).update(payload).digest('hex');
  try {
    const a = Buffer.from(expected, 'utf8');
    const b = Buffer.from(input.signature.trim(), 'utf8');
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export function getPublicRazorpayKeyId(): string {
  return process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID?.trim() || getRazorpayKeyId();
}
