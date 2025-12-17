import { NextResponse } from 'next/server';
import { prisma } from '@/lib/server/prisma';
import { requireUser, HttpError } from '@/lib/server/auth';
import { generateImageViaGemini } from '@/lib/server/gemini';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  try {
    const user = await requireUser(req);
    const body = (await req.json().catch(() => null)) as {
      prompt?: string;
      modelKey?: string;
      inputImage?: { mimeType: string; data: string };
      aspectRatio?: string;
      imageSize?: string;
    } | null;

    const prompt = typeof body?.prompt === 'string' ? body.prompt.trim() : '';
    const modelKey = typeof body?.modelKey === 'string' ? body.modelKey : '';

    if (!prompt) return NextResponse.json({ error: 'Missing prompt' }, { status: 400 });
    if (!modelKey) return NextResponse.json({ error: 'Missing modelKey' }, { status: 400 });

    const provider = await prisma.apiProvider.findFirst({
      where: { isActive: true, name: modelKey },
      orderBy: { createdAt: 'desc' },
    });
    if (!provider) return NextResponse.json({ error: 'No active provider for model' }, { status: 503 });

    const inputImage =
      body?.inputImage &&
      typeof body.inputImage?.mimeType === 'string' &&
      typeof body.inputImage?.data === 'string'
        ? { mimeType: body.inputImage.mimeType, data: body.inputImage.data }
        : undefined;

    const aspectRatio = typeof body?.aspectRatio === 'string' ? body.aspectRatio : undefined;
    const imageSize = typeof body?.imageSize === 'string' ? body.imageSize : undefined;

    const image = await generateImageViaGemini(provider, { prompt, inputImage, aspectRatio, imageSize });

    const [updated] = await prisma.$transaction([
      prisma.userKey.update({
        where: { id: user.id },
        data: { usageCount: { increment: 1 }, lastUsedAt: new Date() },
        select: { usageCount: true, lastUsedAt: true },
      }),
      prisma.userUsage.upsert({
        where: { userId_modelName: { userId: user.id, modelName: provider.displayName } },
        create: { userId: user.id, modelName: provider.displayName, count: 1 },
        update: { count: { increment: 1 } },
      }),
    ]);

    return NextResponse.json(
      {
        model: { modelKey, displayName: provider.displayName },
        image,
        usage: { usageCount: updated.usageCount, lastUsedAt: updated.lastUsedAt },
      },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (err) {
    if (err instanceof HttpError) return NextResponse.json({ error: err.message }, { status: err.status });
    const msg = err instanceof Error ? err.message : 'Internal error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
