import { NextResponse } from 'next/server';
import { loginUserWithKey, HttpError } from '@/lib/server/auth';
import { USER_SESSION_COOKIE } from '@/lib/shared/jwt';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => null)) as unknown;
    const key = typeof (body as { key?: string })?.key === 'string' ? (body as { key: string }).key.trim() : '';
    if (!key) return NextResponse.json({ error: 'Missing key' }, { status: 400 });

    const { token, user } = await loginUserWithKey(key);
    const res = NextResponse.json({
      token,
      user: { id: user.id, name: user.name, usageCount: user.usageCount, lastUsedAt: user.lastUsedAt, isActive: user.isActive },
    });
    res.cookies.set(USER_SESSION_COOKIE, token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 60 * 60 * 24 * 30,
    });
    res.headers.set('Cache-Control', 'no-store');
    return res;
  } catch (err) {
    if (err instanceof HttpError) return NextResponse.json({ error: err.message }, { status: err.status });
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
