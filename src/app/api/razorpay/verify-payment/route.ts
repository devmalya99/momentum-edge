import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSessionFromCookies } from '@/lib/auth/server-session';
import { markRazorpayOrderPaid } from '@/lib/db/razorpay-orders';
import { verifyRazorpayPaymentSignature } from '@/lib/razorpay/server';

export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  razorpay_order_id: z.string().min(1),
  razorpay_payment_id: z.string().min(1),
  razorpay_signature: z.string().min(1),
});

export async function POST(request: Request) {
  try {
    const session = await getSessionFromCookies();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const parsed = bodySchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid payment payload' }, { status: 400 });
    }

    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = parsed.data;

    if (
      !verifyRazorpayPaymentSignature({
        orderId: razorpay_order_id,
        paymentId: razorpay_payment_id,
        signature: razorpay_signature,
      })
    ) {
      return NextResponse.json({ error: 'Invalid payment signature' }, { status: 400 });
    }

    await markRazorpayOrderPaid({
      orderId: razorpay_order_id,
      paymentId: razorpay_payment_id,
      userId: session.sub,
    });

    return NextResponse.json({ ok: true, membership: 'premium' as const });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Payment verification failed';
    console.error('[razorpay/verify-payment]', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
