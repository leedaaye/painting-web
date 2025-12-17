import { NextResponse } from 'next/server';
import { prisma } from '@/lib/server/prisma';
import { createUserKey, requireAdmin, HttpError } from '@/lib/server/auth';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  try {
    await requireAdmin(req);
    const users = await prisma.userKey.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        keyId: true,
        name: true,
        usageCount: true,
        lastUsedAt: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        usages: { select: { modelName: true, count: true } },
      },
    });
    return NextResponse.json({ users });
  } catch (err) {
    if (err instanceof HttpError) return NextResponse.json({ error: err.message }, { status: err.status });
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    await requireAdmin(req);
    const body = (await req.json().catch(() => null)) as { name?: string } | null;
    const name = typeof body?.name === 'string' ? body.name.trim() : '';
    if (!name) return NextResponse.json({ error: 'Missing name' }, { status: 400 });

    const { plainKey, user } = await createUserKey(name);
    return NextResponse.json({ user, key: plainKey }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    if (err instanceof HttpError) return NextResponse.json({ error: err.message }, { status: err.status });
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
