import type { ImageAspectRatio, ImageSize } from './store';

export interface GenerationParams {
  prompt: string;
  model: string;
  aspectRatio: ImageAspectRatio;
  imageSize: ImageSize;
  referenceImage?: string;
}

export interface HistoryItem {
  id: string;
  timestamp: number;
  params: GenerationParams;
  imageData: string;
  mimeType: string;
}
