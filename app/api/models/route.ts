import { NextResponse } from 'next/server';
import { requireUser, HttpError } from '@/lib/server/auth';
import { prisma } from '@/lib/server/prisma';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  try {
    await requireUser(req);

    const providers = await prisma.apiProvider.findMany({
      where: { isActive: true },
      select: { id: true, displayName: true, name: true },
      orderBy: { createdAt: 'asc' },
    });

    const models = providers.map((p) => ({
      modelKey: p.name,
      displayName: p.displayName,
    }));

    return NextResponse.json({ models }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    if (err instanceof HttpError) return NextResponse.json({ error: err.message }, { status: err.status });
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
