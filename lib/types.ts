import type { ImageAspectRatio, ImageSize } from './store';

export interface ReferenceImage {
  id: string;
  data: string;
}

export interface GenerationParams {
  prompt: string;
  model: string;
  aspectRatio: ImageAspectRatio;
  imageSize: ImageSize;
  referenceImages?: ReferenceImage[];
}

export interface HistoryItem {
  id: string;
  timestamp: number;
  params: GenerationParams;
  imageData: string;
  mimeType: string;
}
