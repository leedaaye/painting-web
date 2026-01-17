import { NextResponse } from 'next/server';
import { prisma } from '@/lib/server/prisma';
import { requireUser, HttpError } from '@/lib/server/auth';
import { generateImageViaGemini, GeminiHttpError, GeminiTimeoutError } from '@/lib/server/gemini';

export const runtime = 'nodejs';
export const maxDuration = 60;

const DEFAULT_GEMINI_TIMEOUT_MS = 25_000;
const DEFAULT_GEN_CONCURRENCY = 2;
const MAX_GEN_CONCURRENCY = 5;

const envPositiveInt = (key: string, fallback: number): number => {
  const n = Number(process.env[key]);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
};

const GEMINI_TIMEOUT_MS = envPositiveInt('GEMINI_TIMEOUT_MS', DEFAULT_GEMINI_TIMEOUT_MS);
const GEN_CONCURRENCY = Math.min(envPositiveInt('IMAGE_GEN_CONCURRENCY', DEFAULT_GEN_CONCURRENCY), MAX_GEN_CONCURRENCY);

async function mapWithConcurrency<T, R>(
  values: T[],
  concurrency: number,
  fn: (value: T, idx: number) => Promise<R>
): Promise<PromiseSettledResult<R>[]> {
  const results: PromiseSettledResult<R>[] = new Array(values.length);
  let nextIndex = 0;

  const workers = Array.from({ length: Math.min(concurrency, values.length) }, async () => {
    while (true) {
      const idx = nextIndex++;
      if (idx >= values.length) return;
      try {
        results[idx] = { status: 'fulfilled', value: await fn(values[idx], idx) };
      } catch (reason) {
        results[idx] = { status: 'rejected', reason };
      }
    }
  });

  await Promise.all(workers);
  return results;
}

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

    const validInputImages = inputImages?.length ? inputImages : undefined;
    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
        try {
          const send = (event: string, data: unknown) => {
            controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
          };

          const results = await mapWithConcurrency(
            Array(count).fill(null),
            GEN_CONCURRENCY,
            async () => generateImageViaGemini(
              provider,
              { prompt, inputImages: validInputImages, aspectRatio, imageSize },
              { timeoutMs: GEMINI_TIMEOUT_MS, signal: req.signal }
            )
          );

          let successCount = 0;
          for (const result of results) {
            if (result.status === 'fulfilled') {
              send('image', result.value);
              successCount++;
            } else {
              const msg = result.reason instanceof Error ? result.reason.message : 'Generation failed';
              send('error', { message: msg });
            }
          }

          if (successCount > 0) {
            const [updated] = await prisma.$transaction([
              prisma.userKey.update({
                where: { id: user.id },
                data: { usageCount: { increment: successCount }, lastUsedAt: new Date() },
                select: { usageCount: true, lastUsedAt: true },
              }),
              prisma.userUsage.upsert({
                where: { userId_modelName: { userId: user.id, modelName: provider.displayName } },
                create: { userId: user.id, modelName: provider.displayName, count: successCount },
                update: { count: { increment: successCount } },
              }),
            ]);
            send('done', { usage: { usageCount: updated.usageCount, lastUsedAt: updated.lastUsedAt } });
          } else {
            send('done', {});
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'Stream error';
          controller.enqueue(encoder.encode(`event: error\ndata: ${JSON.stringify({ message: msg })}\n\n`));
        } finally {
          controller.close();
        }
      },
    });

    return new NextResponse(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (err) {
    if (err instanceof HttpError) return NextResponse.json({ error: err.message }, { status: err.status });
    if (err instanceof GeminiTimeoutError) return NextResponse.json({ error: err.message }, { status: 504 });
    if (err instanceof GeminiHttpError) {
      const status = err.status === 429 ? 503 : 502;
      return NextResponse.json({ error: err.message }, { status });
    }
    const msg = err instanceof Error ? err.message : 'Internal error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
