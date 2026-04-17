import { NextResponse } from 'next/server';
import { hash } from 'bcryptjs';
import { createUser, getUserByEmail } from '@/lib/db/users';
import { signSessionToken, setAuthCookie } from '@/lib/auth/session';
import { signupSchema } from '@/lib/auth/schemas';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = signupSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? 'Invalid signup input' },
        { status: 400 },
      );
    }

    const existing = await getUserByEmail(parsed.data.email);
    if (existing) {
      return NextResponse.json({ error: 'Email already in use' }, { status: 409 });
    }

    const passwordHash = await hash(parsed.data.password, 10);
    const userId = crypto.randomUUID();
    await createUser({
      id: userId,
      email: parsed.data.email,
      passwordHash,
      name: parsed.data.name,
    });

    const token = await signSessionToken({
      sub: userId,
      email: parsed.data.email,
      name: parsed.data.name,
    });
    const response = NextResponse.json({
      user: {
        id: userId,
        email: parsed.data.email,
        name: parsed.data.name,
        tradingExperience: '',
        imageUrl: '',
      },
    });
    setAuthCookie(response, token);
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to sign up';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
