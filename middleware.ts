import { NextResponse, type NextRequest } from 'next/server';
import { verifySessionToken, extractBearerToken, USER_SESSION_COOKIE, ADMIN_SESSION_COOKIE } from '@/lib/shared/jwt';

function getToken(req: NextRequest, cookieName: string): string | null {
  return extractBearerToken(req.headers.get('authorization')) ?? req.cookies.get(cookieName)?.value ?? null;
}

export async function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname;

  // Public endpoints
  if (path === '/api/auth/login' || path === '/api/admin/login') return NextResponse.next();

  const isAdminPath = path.startsWith('/api/admin/');
  const cookieName = isAdminPath ? ADMIN_SESSION_COOKIE : USER_SESSION_COOKIE;
  const expectedTyp = isAdminPath ? 'admin' : 'user';

  const token = getToken(req, cookieName);
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const session = await verifySessionToken(token);
    if (session.typ !== expectedTyp) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    return NextResponse.next();
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
}

export const config = {
  matcher: ['/api/models', '/api/generate', '/api/admin/:path*'],
};
