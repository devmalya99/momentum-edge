import { createHmac, timingSafeEqual } from 'node:crypto';

/** Razorpay sends `X-Razorpay-Signature` = HMAC-SHA256(webhook_secret, raw body). */
export function verifyRazorpayWebhookSignature(
  rawBody: string,
  signatureHeader: string | null,
  webhookSecret: string,
): boolean {
  if (!signatureHeader?.trim() || !webhookSecret.trim()) return false;

  const expected = createHmac('sha256', webhookSecret).update(rawBody).digest('hex');

  try {
    const a = Buffer.from(expected, 'utf8');
    const b = Buffer.from(signatureHeader.trim(), 'utf8');
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export type RazorpayWebhookPayload = {
  event?: string;
  payload?: {
    payment?: { entity?: Record<string, unknown> };
    order?: { entity?: Record<string, unknown> };
    subscription?: { entity?: Record<string, unknown> };
  };
};
