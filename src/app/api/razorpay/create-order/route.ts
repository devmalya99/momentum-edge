import { NextResponse } from 'next/server';
import { getSessionFromCookies } from '@/lib/auth/server-session';
import { getUserById } from '@/lib/db/users';
import { insertRazorpayOrder } from '@/lib/db/razorpay-orders';
import { formatInrFromPaise, getPremiumAmountPaise } from '@/lib/razorpay/config';
import { createRazorpayOrder, getPublicRazorpayKeyId } from '@/lib/razorpay/server';

export const dynamic = 'force-dynamic';

export async function POST() {
  try {
    const session = await getSessionFromCookies();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await getUserById(session.sub);
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const amountPaise = getPremiumAmountPaise();
    const receipt = `premium_${user.id.slice(0, 8)}_${Date.now()}`;

    const order = await createRazorpayOrder({
      amountPaise,
      receipt,
      notes: { userId: user.id, product: 'premium' },
    });

    await insertRazorpayOrder({
      orderId: order.id,
      userId: user.id,
      amountPaise: order.amount,
      currency: order.currency,
    });

    return NextResponse.json({
      keyId: getPublicRazorpayKeyId(),
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      amountLabel: formatInrFromPaise(order.amount),
      prefill: {
        name: user.name,
        email: user.email,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create order';
    console.error('[razorpay/create-order]', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
