import { SignJWT, jwtVerify, type JWTPayload } from 'jose';

export type SessionType = 'user' | 'admin';

export const USER_SESSION_COOKIE = 'pw_user_session';
export const ADMIN_SESSION_COOKIE = 'pw_admin_session';

export type SessionClaims = {
  typ: SessionType;
  sub: string;
};

export type VerifiedSession = JWTPayload & SessionClaims;

function requireJwtSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('Missing JWT_SECRET');
  return new TextEncoder().encode(secret);
}

export async function signSessionToken(claims: SessionClaims, expiresInSeconds: number): Promise<string> {
  const secret = requireJwtSecret();
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT({ typ: claims.typ })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(claims.sub)
    .setIssuedAt(now)
    .setExpirationTime(now + expiresInSeconds)
    .sign(secret);
}

export async function verifySessionToken(token: string): Promise<VerifiedSession> {
  const secret = requireJwtSecret();
  const { payload } = await jwtVerify(token, secret, { algorithms: ['HS256'] });
  const sub = payload.sub;
  const typ = (payload as Partial<SessionClaims>).typ;
  if (typeof sub !== 'string') throw new Error('Invalid token: sub');
  if (typ !== 'user' && typ !== 'admin') throw new Error('Invalid token: typ');
  return payload as VerifiedSession;
}

export function extractBearerToken(authorizationHeader: string | null): string | null {
  if (!authorizationHeader) return null;
  const [scheme, value] = authorizationHeader.split(' ', 2);
  if (scheme?.toLowerCase() !== 'bearer' || !value) return null;
  return value.trim() || null;
}

function parseCookies(cookieHeader: string): Map<string, string> {
  const map = new Map<string, string>();
  const parts = cookieHeader.split(';');
  for (const part of parts) {
    const idx = part.indexOf('=');
    if (idx <= 0) continue;
    const name = part.slice(0, idx).trim();
    const value = part.slice(idx + 1).trim();
    if (!name) continue;
    map.set(name, value);
  }
  return map;
}

export function extractCookieToken(cookieHeader: string | null, cookieName: string): string | null {
  if (!cookieHeader) return null;
  const cookies = parseCookies(cookieHeader);
  const value = cookies.get(cookieName);
  return value?.trim() || null;
}

export function getTokenFromRequest(req: Request, cookieName: string): string | null {
  return (
    extractBearerToken(req.headers.get('authorization')) ??
    extractCookieToken(req.headers.get('cookie'), cookieName)
  );
}
