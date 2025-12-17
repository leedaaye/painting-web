import 'server-only';
import type { ApiProvider } from '@prisma/client';

export type InlineImage = { mimeType: string; data: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function extractInlineImage(payload: unknown): InlineImage | null {
  if (!isRecord(payload)) return null;
  const candidates = payload.candidates;
  if (!Array.isArray(candidates) || candidates.length === 0) return null;
  const first = candidates[0];
  if (!isRecord(first)) return null;
  const content = first.content;
  if (!isRecord(content)) return null;
  const parts = content.parts;
  if (!Array.isArray(parts)) return null;

  for (const part of parts) {
    if (!isRecord(part)) continue;
    const inlineData = part.inlineData;
    if (!isRecord(inlineData)) continue;
    const mimeType = inlineData.mimeType;
    const data = inlineData.data;
    if (typeof mimeType === 'string' && typeof data === 'string') return { mimeType, data };
  }
  return null;
}

export type GeminiGenerateInput = {
  prompt: string;
  inputImage?: InlineImage;
  aspectRatio?: string;
  imageSize?: string;
};

export async function generateImageViaGemini(provider: ApiProvider, input: GeminiGenerateInput): Promise<InlineImage> {
  const parts: Array<{ text?: string; inlineData?: { mimeType: string; data: string } }> = [];
  if (input.prompt) parts.push({ text: input.prompt });
  if (input.inputImage) parts.push({ inlineData: { mimeType: input.inputImage.mimeType, data: input.inputImage.data } });

  const body: Record<string, unknown> = {
    contents: [{ role: 'user', parts }],
    generationConfig: {
      responseModalities: ['Text', 'Image'],
    },
  };

  if (input.aspectRatio || input.imageSize) {
    body.generationConfig = {
      ...(body.generationConfig as Record<string, unknown>),
      imageConfig: { aspectRatio: input.aspectRatio, imageSize: input.imageSize },
    };
  }

  const normalizedBase = provider.baseUrl.trim().replace(/\/+$/, '');
  const url = `${normalizedBase}/v1beta/models/${encodeURIComponent(provider.modelId)}:generateContent`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${provider.apiKey}`,
      'x-goog-api-key': provider.apiKey,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    let msg = `Upstream error: ${response.status}`;
    try {
      const parsed = JSON.parse(text) as { error?: { message?: string } };
      msg = parsed?.error?.message || msg;
    } catch {}
    throw new Error(msg);
  }

  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('text/event-stream') || contentType.includes('text/plain')) {
    const text = await response.text();
    for (const line of text.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('data:')) continue;
      const jsonStr = trimmed.slice(5).trim();
      if (!jsonStr || jsonStr === '[DONE]') continue;
      try {
        const data = JSON.parse(jsonStr);
        const extracted = extractInlineImage(data);
        if (extracted) return extracted;
      } catch {}
    }
    throw new Error('No image found in SSE response');
  }

  const data: unknown = await response.json();
  const extracted = extractInlineImage(data);
  if (!extracted) throw new Error('No image found in JSON response');
  return extracted;
}
