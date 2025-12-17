import { NextResponse } from 'next/server';
import { bootstrapOrLoginAdmin, HttpError } from '@/lib/server/auth';
import { ADMIN_SESSION_COOKIE } from '@/lib/shared/jwt';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => null)) as unknown;
    const password = typeof (body as { password?: string })?.password === 'string' ? (body as { password: string }).password : '';
    if (!password) return NextResponse.json({ error: 'Missing password' }, { status: 400 });

    const { token, bootstrapped } = await bootstrapOrLoginAdmin(password);
    const res = NextResponse.json({ token, bootstrapped });
    res.cookies.set(ADMIN_SESSION_COOKIE, token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 60 * 60 * 24 * 7,
    });
    res.headers.set('Cache-Control', 'no-store');
    return res;
  } catch (err) {
    if (err instanceof HttpError) return NextResponse.json({ error: err.message }, { status: err.status });
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
