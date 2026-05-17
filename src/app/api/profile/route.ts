import { compare, hash } from 'bcryptjs';
import { NextResponse } from 'next/server';
import { profileUpdateSchema } from '@/lib/auth/schemas';
import { setAuthCookie, signSessionToken } from '@/lib/auth/session';
import { getSessionFromCookies } from '@/lib/auth/server-session';
import { toPublicUser } from '@/lib/auth/public-user';
import { BASIC_WATCHLIST_LIMIT } from '@/lib/membership/constants';
import { formatInrFromPaise, getPremiumAmountPaise } from '@/lib/razorpay/config';
import { getUserByEmail, getUserById, updateUserProfile } from '@/lib/db/users';

export async function GET() {
  const session = await getSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const user = await getUserById(session.sub);
  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  const amountPaise = getPremiumAmountPaise();
  return NextResponse.json({
    user: toPublicUser(user),
    membershipOffer: {
      amountPaise,
      amountLabel: formatInrFromPaise(amountPaise),
      watchlistLimit: BASIC_WATCHLIST_LIMIT,
    },
  });
}

export async function PATCH(request: Request) {
  try {
    const session = await getSessionFromCookies();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const parsed = profileUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? 'Invalid profile payload' },
        { status: 400 },
      );
    }

    const currentUser = await getUserById(session.sub);
    if (!currentUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    if (parsed.data.email !== currentUser.email) {
      const existing = await getUserByEmail(parsed.data.email);
      if (existing && existing.id !== currentUser.id) {
        return NextResponse.json({ error: 'Email already in use' }, { status: 409 });
      }
    }

    let nextPasswordHash: string | undefined;
    if (parsed.data.newPassword) {
      if (!parsed.data.currentPassword) {
        return NextResponse.json({ error: 'Current password required' }, { status: 400 });
      }
      const matches = await compare(parsed.data.currentPassword, currentUser.password_hash);
      if (!matches) {
        return NextResponse.json({ error: 'Current password is incorrect' }, { status: 401 });
      }
      nextPasswordHash = await hash(parsed.data.newPassword, 10);
    }

    await updateUserProfile(currentUser.id, {
      name: parsed.data.name,
      email: parsed.data.email,
      tradingExperience: parsed.data.tradingExperience?.trim() || null,
      imageUrl: parsed.data.imageUrl?.trim() || null,
      passwordHash: nextPasswordHash,
    });

    const refreshed = await getUserById(currentUser.id);
    if (!refreshed) {
      return NextResponse.json({ error: 'User not found after update' }, { status: 404 });
    }

    const token = await signSessionToken({
      sub: refreshed.id,
      email: refreshed.email,
      name: refreshed.name,
    });

    const response = NextResponse.json({
      user: toPublicUser(refreshed),
    });
    setAuthCookie(response, token);
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Profile update failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
