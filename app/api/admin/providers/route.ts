import { NextResponse } from 'next/server';
import { prisma } from '@/lib/server/prisma';
import { requireAdmin, HttpError } from '@/lib/server/auth';
import { maskSecret } from '@/lib/server/secrets';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  try {
    await requireAdmin(req);
    const providers = await prisma.apiProvider.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        baseUrl: true,
        modelId: true,
        displayName: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        apiKey: true,
      },
    });
    return NextResponse.json({ providers });
  } catch (err) {
    if (err instanceof HttpError) return NextResponse.json({ error: err.message }, { status: err.status });
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    await requireAdmin(req);
    const body = (await req.json().catch(() => null)) as {
      id?: string;
      name?: string;
      baseUrl?: string;
      apiKey?: string;
      modelId?: string;
      displayName?: string;
      isActive?: boolean;
    } | null;

    const id = typeof body?.id === 'string' ? body.id : undefined;
    const name = typeof body?.name === 'string' ? body.name.trim() : '';
    const baseUrl = typeof body?.baseUrl === 'string' ? body.baseUrl.trim() : '';
    const apiKey = typeof body?.apiKey === 'string' ? body.apiKey.trim() : undefined;
    const modelId = typeof body?.modelId === 'string' ? body.modelId.trim() : '';
    const displayName = typeof body?.displayName === 'string' ? body.displayName.trim() : '';
    const isActive = typeof body?.isActive === 'boolean' ? body.isActive : true;

    if (!name || !baseUrl || !modelId || !displayName) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }
    try {
      const u = new URL(baseUrl);
      if (u.protocol !== 'http:' && u.protocol !== 'https:') throw new Error('bad protocol');
    } catch {
      return NextResponse.json({ error: 'Invalid baseUrl' }, { status: 400 });
    }

    if (!id && !apiKey) return NextResponse.json({ error: 'apiKey is required for create' }, { status: 400 });

    const saved = id
      ? await prisma.apiProvider.update({
          where: { id },
          data: {
            name,
            baseUrl,
            modelId,
            displayName,
            isActive,
            ...(apiKey ? { apiKey } : {}),
          },
        })
      : await prisma.apiProvider.create({
          data: { name, baseUrl, apiKey: apiKey!, modelId, displayName, isActive },
        });

    return NextResponse.json({
      provider: {
        id: saved.id,
        name: saved.name,
        baseUrl: saved.baseUrl,
        modelId: saved.modelId,
        displayName: saved.displayName,
        isActive: saved.isActive,
        createdAt: saved.createdAt,
        updatedAt: saved.updatedAt,
        apiKeyMasked: maskSecret(saved.apiKey),
        hasApiKey: Boolean(saved.apiKey),
      },
    });
  } catch (err) {
    if (err instanceof HttpError) return NextResponse.json({ error: err.message }, { status: err.status });
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
