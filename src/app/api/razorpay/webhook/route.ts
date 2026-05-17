import { NextResponse } from 'next/server';
import { markRazorpayOrderPaid } from '@/lib/db/razorpay-orders';
import {
  verifyRazorpayWebhookSignature,
  type RazorpayWebhookPayload,
} from '@/lib/razorpay/webhook';

export const dynamic = 'force-dynamic';

/**
 * Razorpay Dashboard → Webhooks → URL:
 *   https://YOUR_DOMAIN/api/razorpay/webhook
 *
 * Local dev: use ngrok (or similar) and paste the public HTTPS URL above.
 */
export async function POST(request: Request) {
  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET?.trim();
  if (!webhookSecret) {
    console.error('[razorpay/webhook] RAZORPAY_WEBHOOK_SECRET is not set');
    return NextResponse.json({ error: 'Webhook not configured' }, { status: 500 });
  }

  const rawBody = await request.text();
  const signature = request.headers.get('x-razorpay-signature');

  if (!verifyRazorpayWebhookSignature(rawBody, signature, webhookSecret)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  let body: RazorpayWebhookPayload;
  try {
    body = JSON.parse(rawBody) as RazorpayWebhookPayload;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const event = body.event ?? 'unknown';

  switch (event) {
    case 'payment.captured':
    case 'order.paid': {
      const payment = body.payload?.payment?.entity;
      const order = body.payload?.order?.entity;
      const orderId =
        (typeof order?.id === 'string' ? order.id : undefined) ??
        (typeof payment?.order_id === 'string' ? payment.order_id : undefined);
      const paymentId = typeof payment?.id === 'string' ? payment.id : undefined;
      if (orderId && paymentId) {
        const unlocked = await markRazorpayOrderPaid({ orderId, paymentId });
        console.info('[razorpay/webhook]', event, { orderId, paymentId, unlocked });
      } else {
        console.warn('[razorpay/webhook] missing order/payment id', event);
      }
      break;
    }
    case 'payment.failed': {
      console.warn('[razorpay/webhook] payment.failed', body.payload?.payment?.entity?.id);
      break;
    }
    default:
      console.info('[razorpay/webhook] unhandled event', event);
  }

  // Razorpay expects 2xx quickly; do heavy work async if needed.
  return NextResponse.json({ received: true });
}
