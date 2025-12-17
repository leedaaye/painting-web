import 'server-only';
import bcrypt from 'bcrypt';
import { prisma } from '@/lib/server/prisma';
import { sha256Hex, generateUserKeySecret } from '@/lib/server/secrets';
import {
  ADMIN_SESSION_COOKIE,
  USER_SESSION_COOKIE,
  getTokenFromRequest,
  signSessionToken,
  verifySessionToken,
  type SessionType,
} from '@/lib/shared/jwt';

const USER_TOKEN_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days
const ADMIN_TOKEN_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days

export class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export async function requireSessionType(req: Request, cookieName: string, expected: SessionType) {
  const token = getTokenFromRequest(req, cookieName);
  if (!token) throw new HttpError(401, 'Missing session token');
  const session = await verifySessionToken(token).catch(() => {
    throw new HttpError(401, 'Invalid session token');
  });
  if (session.typ !== expected) throw new HttpError(403, 'Forbidden');
  return session;
}

export async function requireUser(req: Request) {
  const session = await requireSessionType(req, USER_SESSION_COOKIE, 'user');
  const user = await prisma.userKey.findUnique({ where: { id: session.sub } });
  if (!user) throw new HttpError(401, 'User not found');
  if (!user.isActive) throw new HttpError(403, 'User disabled');
  return user;
}

export async function requireAdmin(req: Request) {
  await requireSessionType(req, ADMIN_SESSION_COOKIE, 'admin');
}

export async function loginUserWithKey(plainKey: string) {
  const keyId = sha256Hex(plainKey);
  const user = await prisma.userKey.findUnique({ where: { keyId } });
  if (!user) throw new HttpError(401, 'Invalid key');
  if (!user.isActive) throw new HttpError(403, 'User disabled');
  const ok = await bcrypt.compare(plainKey, user.key);
  if (!ok) throw new HttpError(401, 'Invalid key');

  const token = await signSessionToken({ typ: 'user', sub: user.id }, USER_TOKEN_TTL_SECONDS);
  return { token, user };
}

export async function bootstrapOrLoginAdmin(password: string) {
  const existing = await prisma.adminConfig.findFirst({ orderBy: { id: 'asc' } });
  if (!existing) {
    const passwordHash = await bcrypt.hash(password, 12);
    await prisma.adminConfig.create({ data: { passwordHash } });
    const token = await signSessionToken({ typ: 'admin', sub: 'admin' }, ADMIN_TOKEN_TTL_SECONDS);
    return { token, bootstrapped: true };
  }
  const ok = await bcrypt.compare(password, existing.passwordHash);
  if (!ok) throw new HttpError(401, 'Invalid password');
  const token = await signSessionToken({ typ: 'admin', sub: 'admin' }, ADMIN_TOKEN_TTL_SECONDS);
  return { token, bootstrapped: false };
}

export async function createUserKey(name: string, customKey: string) {
  const keyId = sha256Hex(customKey);
  const existing = await prisma.userKey.findUnique({ where: { keyId } });
  if (existing) throw new HttpError(400, '密钥已存在');

  const hashed = await bcrypt.hash(customKey, 12);
  const created = await prisma.userKey.create({
    data: { name, key: hashed, keyId, plainKey: customKey },
    select: { id: true, name: true, usageCount: true, lastUsedAt: true, isActive: true, createdAt: true, plainKey: true },
  });
  return { user: created };
}

export async function updateAdminPassword(currentPassword: string, newPassword: string) {
  const existing = await prisma.adminConfig.findFirst({ orderBy: { id: 'asc' } });
  if (!existing) throw new HttpError(404, '管理员账户不存在');

  const ok = await bcrypt.compare(currentPassword, existing.passwordHash);
  if (!ok) throw new HttpError(401, '当前密码错误');

  const newHash = await bcrypt.hash(newPassword, 12);
  await prisma.adminConfig.update({ where: { id: existing.id }, data: { passwordHash: newHash } });
}
