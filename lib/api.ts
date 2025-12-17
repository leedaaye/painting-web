import { useAppStore, type ImageAspectRatio, type ImageSize } from './store';

export interface ImageGenerationConfig {
  aspectRatio?: ImageAspectRatio;
  imageSize?: ImageSize;
}

export interface ImageGenerationRequest {
  prompt: string;
  inputImage?: { mimeType: string; data: string };
}

export interface ImageGenerationResponse {
  mimeType: string;
  data: string;
}

export interface GenerateImageOptions {
  onHeartbeat?: () => void;
  signal?: AbortSignal;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function extractInlineImage(payload: unknown): ImageGenerationResponse | null {
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

export async function generateImage(
  request: ImageGenerationRequest,
  options?: GenerateImageOptions
): Promise<ImageGenerationResponse> {
  const { apiKey, baseUrl, model, aspectRatio, imageSize } = useAppStore.getState();

  if (!apiKey) throw new Error('请先在设置中配置 API Key');
  if (!baseUrl) throw new Error('请先在设置中配置 API Base URL');

  const parts: Array<{ text?: string; inlineData?: { mimeType: string; data: string } }> = [];
  if (request.prompt) parts.push({ text: request.prompt });
  if (request.inputImage) {
    parts.push({ inlineData: { mimeType: request.inputImage.mimeType, data: request.inputImage.data } });
  }

  const body: Record<string, unknown> = {
    contents: [{ role: 'user', parts }],
    generationConfig: {
      responseModalities: ['Text', 'Image'],
    },
  };

  if (!model.toLowerCase().includes('flash')) {
    body.generationConfig = {
      ...(body.generationConfig as Record<string, unknown>),
      imageConfig: { aspectRatio, imageSize },
    };
  }

  const normalizedBase = baseUrl.trim().replace(/\/+$/, '');
  const url = `${normalizedBase}/v1beta/models/${encodeURIComponent(model)}:generateContent`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      'x-goog-api-key': apiKey,
    },
    body: JSON.stringify(body),
    signal: options?.signal,
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    let errorMsg = `请求失败: ${response.status}`;
    try {
      const parsed = JSON.parse(errorText);
      errorMsg = parsed?.error?.message || errorMsg;
    } catch {}
    throw new Error(errorMsg);
  }

  const contentType = response.headers.get('content-type') || '';

  // SSE 流式响应
  if (contentType.includes('text/event-stream') || contentType.includes('text/plain')) {
    const text = await response.text();
    const lines = text.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('data:')) {
        const jsonStr = trimmed.slice(5).trim();
        if (!jsonStr || jsonStr === '[DONE]') continue;
        try {
          const data = JSON.parse(jsonStr);
          const extracted = extractInlineImage(data);
          if (extracted) return extracted;
        } catch {}
      }
    }
    throw new Error('未从 SSE 响应中获取到图片数据');
  }

  // 普通 JSON 响应
  const data: unknown = await response.json();
  const extracted = extractInlineImage(data);
  if (!extracted) throw new Error('未获取到图片数据，请检查模型是否支持图片生成');
  return extracted;
}
