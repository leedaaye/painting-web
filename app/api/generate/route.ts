import { NextResponse } from 'next/server';
import { prisma } from '@/lib/server/prisma';
import { requireUser, HttpError } from '@/lib/server/auth';
import { generateImageViaGemini } from '@/lib/server/gemini';

export const runtime = 'nodejs';

const MAX_INPUT_IMAGES = 14;
const MAX_BASE64_LEN = Math.ceil((5 * 1024 * 1024 * 4) / 3) + 4;
const MAX_LABEL_LEN = 32;
const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

const normalizeLabel = (v: unknown, idx: number): string => {
  const fallback = `参考图${idx + 1}`;
  if (typeof v !== 'string') return fallback;
  const s = v.trim().replace(/[\r\n\[\]]+/g, '').slice(0, MAX_LABEL_LEN);
  return s || fallback;
};

const isSafeBase64 = (v: string): boolean =>
  !!v && v.length <= MAX_BASE64_LEN && !v.startsWith('data:') && !v.includes(',') && !/\s/.test(v);

export async function POST(req: Request) {
  try {
    const user = await requireUser(req);
    const body = (await req.json().catch(() => null)) as {
      prompt?: string;
      modelKey?: string;
      inputImages?: { mimeType: string; data: string; label: string }[];
      aspectRatio?: string;
      imageSize?: string;
      count?: number;
    } | null;

    const prompt = typeof body?.prompt === 'string' ? body.prompt.trim() : '';
    const modelKey = typeof body?.modelKey === 'string' ? body.modelKey : '';
    const count = Math.min(Math.max(typeof body?.count === 'number' ? Math.floor(body.count) : 1, 1), 10);

    if (!prompt) return NextResponse.json({ error: 'Missing prompt' }, { status: 400 });
    if (!modelKey) return NextResponse.json({ error: 'Missing modelKey' }, { status: 400 });

    const provider = await prisma.apiProvider.findFirst({
      where: { isActive: true, name: modelKey },
      orderBy: { createdAt: 'desc' },
    });
    if (!provider) return NextResponse.json({ error: 'No active provider for model' }, { status: 503 });

    const rawInputImages = Array.isArray(body?.inputImages) ? body.inputImages.slice(0, MAX_INPUT_IMAGES) : null;
    const inputImages = rawInputImages
      ?.map((img, idx) => {
        if (typeof img !== 'object' || img === null) return null;
        const r = img as Record<string, unknown>;
        const mimeType = typeof r.mimeType === 'string' ? r.mimeType.trim() : '';
        const data = typeof r.data === 'string' ? r.data.trim() : '';
        if (!ALLOWED_MIME.has(mimeType) || !isSafeBase64(data)) return null;
        return { mimeType, data, label: normalizeLabel(r.label, idx) };
      })
      .filter((x): x is { mimeType: string; data: string; label: string } => x !== null);

    if (rawInputImages && inputImages && inputImages.length !== rawInputImages.length) {
      return NextResponse.json({ error: 'Invalid inputImages' }, { status: 400 });
    }

    const aspectRatio = typeof body?.aspectRatio === 'string' ? body.aspectRatio : undefined;
    const imageSize = typeof body?.imageSize === 'string' ? body.imageSize : undefined;

    const images: { mimeType: string; data: string }[] = [];
    const validInputImages = inputImages?.length ? inputImages : undefined;
    for (let i = 0; i < count; i++) {
      const image = await generateImageViaGemini(provider, { prompt, inputImages: validInputImages, aspectRatio, imageSize });
      images.push(image);
    }

    const [updated] = await prisma.$transaction([
      prisma.userKey.update({
        where: { id: user.id },
        data: { usageCount: { increment: count }, lastUsedAt: new Date() },
        select: { usageCount: true, lastUsedAt: true },
      }),
      prisma.userUsage.upsert({
        where: { userId_modelName: { userId: user.id, modelName: provider.displayName } },
        create: { userId: user.id, modelName: provider.displayName, count },
        update: { count: { increment: count } },
      }),
    ]);

    return NextResponse.json(
      {
        model: { modelKey, displayName: provider.displayName },
        images,
        image: images[0],
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
