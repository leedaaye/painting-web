import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type ImageAspectRatio = 'auto' | '1:1' | '2:3' | '3:2' | '3:4' | '4:3' | '4:5' | '5:4' | '9:16' | '16:9' | '21:9';
export type ImageSize = '1K' | '2K' | '4K';

interface AppState {
  apiKey: string;
  baseUrl: string;
  model: string;
  aspectRatio: ImageAspectRatio;
  imageSize: ImageSize;
  setApiKey: (key: string) => void;
  setBaseUrl: (url: string) => void;
  setModel: (model: string) => void;
  setAspectRatio: (ratio: ImageAspectRatio) => void;
  setImageSize: (size: ImageSize) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      apiKey: '',
      baseUrl: '',
      model: 'gemini-2.5-flash-image',
      aspectRatio: 'auto',
      imageSize: '1K',
      setApiKey: (key) => set({ apiKey: key }),
      setBaseUrl: (url) => set({ baseUrl: url }),
      setModel: (model) => set({ model }),
      setAspectRatio: (ratio) => set({ aspectRatio: ratio }),
      setImageSize: (size) => set({ imageSize: size }),
    }),
    { name: 'painting-web-storage' }
  )
);
