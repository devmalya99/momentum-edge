import { compare } from 'bcryptjs';
import { NextResponse } from 'next/server';
import { loginSchema } from '@/lib/auth/schemas';
import { signSessionToken, setAuthCookie } from '@/lib/auth/session';
import { toPublicUser } from '@/lib/auth/public-user';
import { getUserByEmail } from '@/lib/db/users';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = loginSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? 'Invalid login input' },
        { status: 400 },
      );
    }

    const user = await getUserByEmail(parsed.data.email);
    if (!user) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    const isValidPassword = await compare(parsed.data.password, user.password_hash);
    if (!isValidPassword) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    const token = await signSessionToken({
      sub: user.id,
      email: user.email,
      name: user.name,
    });

    const response = NextResponse.json({ user: toPublicUser(user) });
    setAuthCookie(response, token);
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to log in';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
