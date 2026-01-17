'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { useAppStore, type ImageAspectRatio, type ImageSize } from '@/lib/store';
import { saveHistoryItem, getAllHistory, deleteHistoryItem, deleteHistoryItems } from '@/lib/db';
import type { HistoryItem, ReferenceImage } from '@/lib/types';
import { ImageDetailModal } from '@/components/image-detail-modal';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import {
  Loader2, Zap, ImageIcon, Download, Upload, X, Menu, Layers,
  CheckCircle, Circle, Trash2, Sparkles, LogOut
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { USER_SESSION_COOKIE } from '@/lib/shared/jwt';

interface Model {
  modelKey: string;
  displayName: string;
}

const ASPECT_RATIOS: { value: ImageAspectRatio; label: string }[] = [
  { value: 'auto', label: 'Auto' },
  { value: '21:9', label: '21:9' },
  { value: '16:9', label: '16:9' },
  { value: '3:2', label: '3:2' },
  { value: '4:3', label: '4:3' },
  { value: '5:4', label: '5:4' },
  { value: '1:1', label: '1:1' },
  { value: '4:5', label: '4:5' },
  { value: '3:4', label: '3:4' },
  { value: '2:3', label: '2:3' },
  { value: '9:16', label: '9:16' },
];

const IMAGE_SIZES: { value: ImageSize; label: string }[] = [
  { value: '1K', label: '1K' },
  { value: '2K', label: '2K' },
  { value: '4K', label: '4K' },
];

const createId = () => crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;

const MAX_REF_IMAGES = 14;
const MAX_REF_IMAGE_BYTES = 5 * 1024 * 1024;
const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

const readFileAsDataUrl = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error ?? new Error('File read failed'));
    reader.onabort = () => reject(new Error('File read aborted'));
    reader.onload = () => {
      if (typeof reader.result === 'string') resolve(reader.result);
      else reject(new Error('Unexpected file read result'));
    };
    reader.readAsDataURL(file);
  });

const parseDataUrl = (value: string): { mimeType: string; data: string } | null => {
  if (!value.startsWith('data:')) return null;
  const commaIdx = value.indexOf(',');
  if (commaIdx === -1) return null;
  const meta = value.slice(5, commaIdx);
  const base64Idx = meta.toLowerCase().indexOf(';base64');
  if (base64Idx === -1) return null;
  const mimeType = meta.slice(0, base64Idx).split(';')[0];
  const data = value.slice(commaIdx + 1);
  if (!mimeType || !data) return null;
  return { mimeType, data };
};

const getFileExtension = (mimeType: string) => {
  const map: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/gif': 'gif',
  };
  return map[mimeType.toLowerCase()] || 'png';
};

interface ImageGeneratorProps {
  onLogout: () => void;
}

export function ImageGenerator({ onLogout }: ImageGeneratorProps) {
  const { aspectRatio, setAspectRatio, imageSize, setImageSize } = useAppStore();

  const [prompt, setPrompt] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [refImages, setRefImages] = useState<ReferenceImage[]>([]);

  const [models, setModels] = useState<Model[]>([]);
  const [selectedModel, setSelectedModel] = useState<string>('');
  const [imageCount, setImageCount] = useState(1);

  const [selectedImage, setSelectedImage] = useState<HistoryItem | null>(null);
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isBatchProcessing, setIsBatchProcessing] = useState(false);
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const refImageOpToken = useRef(0);
  const abortControllerRef = useRef<AbortController | null>(null);

  const clearRefImages = useCallback(() => {
    refImageOpToken.current += 1;
    setRefImages([]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, []);

  useEffect(() => {
    return () => { refImageOpToken.current += 1; };
  }, []);

  useEffect(() => {
    loadHistory();
    loadModels();
  }, []);

  const loadHistory = async () => {
    try {
      const items = await getAllHistory();
      setHistory(items);
    } catch (error) {
      console.error('Failed to load history:', error);
    }
  };

  const loadModels = async () => {
    try {
      const res = await fetch('/api/models');
      const data = await res.json();
      if (res.ok && data.models) {
        setModels(data.models);
        if (data.models.length > 0 && !selectedModel) {
          setSelectedModel(data.models[0].modelKey);
        }
      }
    } catch (error) {
      console.error('Failed to load models:', error);
    }
  };

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    if (!files.length) return;

    const opToken = refImageOpToken.current;
    const remaining = MAX_REF_IMAGES - refImages.length;
    if (remaining <= 0) {
      toast.error(`最多上传${MAX_REF_IMAGES}张参考图`);
      return;
    }

    const validFiles: File[] = [];
    for (const file of files.slice(0, remaining)) {
      if (!file.type.startsWith('image/')) {
        toast.error(`${file.name} 不是图片文件`);
        continue;
      }
      if (!ALLOWED_MIME_TYPES.has(file.type)) {
        toast.error(`${file.name} 格式不支持`);
        continue;
      }
      if (file.size > MAX_REF_IMAGE_BYTES) {
        toast.error(`${file.name} 过大，请使用5MB以下的图片`);
        continue;
      }
      validFiles.push(file);
    }
    if (!validFiles.length) return;

    const results = await Promise.allSettled(validFiles.map(readFileAsDataUrl));
    if (opToken !== refImageOpToken.current) return;

    const next: ReferenceImage[] = [];
    results.forEach((result, idx) => {
      if (result.status === 'fulfilled') next.push({ id: createId(), data: result.value });
      else toast.error(`读取 ${validFiles[idx].name} 失败`);
    });
    if (!next.length) return;

    setRefImages(prev => {
      const cap = MAX_REF_IMAGES - prev.length;
      if (cap <= 0) return prev;
      return [...prev, ...next.slice(0, cap)];
    });
  }, [refImages.length]);

  const handleGenerate = async () => {
    if (!prompt.trim() || isLoading || !selectedModel) return;

    if (abortControllerRef.current) abortControllerRef.current.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;

    const snapshotPrompt = prompt;
    const snapshotModel = selectedModel;
    const snapshotAspectRatio = aspectRatio;
    const snapshotImageSize = imageSize;
    const snapshotRefImages = refImages;
    const snapshotModels = models;

    setIsLoading(true);
    setProgress({ current: 0, total: imageCount });
    if (window.innerWidth < 768) setIsSidebarOpen(false);

    try {
      const inputImages = snapshotRefImages.length > 0
        ? snapshotRefImages.map((img, idx) => {
            const parsed = parseDataUrl(img.data);
            if (!parsed) throw new Error(`参考图${idx + 1} 数据无效，请重新上传`);
            if (!ALLOWED_MIME_TYPES.has(parsed.mimeType)) throw new Error(`参考图${idx + 1} 格式不支持`);
            return { mimeType: parsed.mimeType, data: parsed.data, label: `参考图${idx + 1}` };
          })
        : undefined;

      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: snapshotPrompt,
          modelKey: snapshotModel,
          inputImages,
          aspectRatio: snapshotAspectRatio === 'auto' ? undefined : snapshotAspectRatio,
          imageSize: supportsImageSize ? snapshotImageSize : undefined,
          count: imageCount,
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Generation failed');
      }

      if (!res.body) throw new Error('No response body');

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let successCount = 0;
      const modelDisplay = snapshotModels.find(m => m.modelKey === snapshotModel)?.displayName || snapshotModel;

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const parts = buffer.split('\n\n');
          buffer = parts.pop() || '';

          for (const part of parts) {
            const lines = part.split('\n');
            let event = '';
            let dataStr = '';
            for (const line of lines) {
              if (line.startsWith('event: ')) event = line.slice(7).trim();
              else if (line.startsWith('data: ')) dataStr = line.slice(6).trim();
            }

            if (event === 'image' && dataStr) {
              try {
                const img = JSON.parse(dataStr);
                const newItem: HistoryItem = {
                  id: createId(),
                  timestamp: Date.now(),
                  params: { prompt: snapshotPrompt, model: modelDisplay, aspectRatio: snapshotAspectRatio, imageSize: snapshotImageSize, referenceImages: snapshotRefImages.length > 0 ? snapshotRefImages : undefined },
                  imageData: img.data,
                  mimeType: img.mimeType,
                };
                await saveHistoryItem(newItem);
                setHistory((prev) => [newItem, ...prev]);
                successCount++;
                setProgress((prev) => prev ? { ...prev, current: prev.current + 1 } : null);
              } catch (parseError) {
                console.error('Failed to parse image data:', parseError);
              }
            } else if (event === 'error' && dataStr) {
              try {
                const err = JSON.parse(dataStr);
                toast.error(err.message || 'Image generation failed');
              } catch (parseError) {
                toast.error('Image generation failed');
              }
            }
          }
        }
      } finally {
        reader.cancel().catch(() => {});
      }

      if (successCount > 0) toast.success(`${successCount} 张图片生成完成`);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : '生成失败';
      toast.error(msg);
    } finally {
      setIsLoading(false);
      setProgress(null);
    }
  };

  const handleReuseParams = (item: HistoryItem) => {
    setPrompt(item.params.prompt);
    setAspectRatio(item.params.aspectRatio);
    setImageSize(item.params.imageSize);
    setRefImages(item.params.referenceImages || []);
    setIsSidebarOpen(true);
  };

  const handleDeleteItem = async (id: string) => {
    try {
      await deleteHistoryItem(id);
      setHistory((prev) => prev.filter((item) => item.id !== id));
      setSelectedIds((prev) => {
        if (!prev.has(id)) return prev;
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      toast.success('已删除');
    } catch (error) {
      console.error('Failed to delete:', error);
      toast.error('删除失败');
    }
  };

  const toggleSelectionMode = () => {
    setIsSelectionMode(!isSelectionMode);
    setSelectedIds(new Set());
  };

  const toggleItemSelection = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedIds(newSet);
  };

  const handleSelectAll = () => {
    if (selectedIds.size === history.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(history.map((item) => item.id)));
    }
  };

  const handleBatchDelete = async () => {
    if (selectedIds.size === 0) return;
    if (!window.confirm(`确定要删除选中的 ${selectedIds.size} 张图片吗？`)) return;

    setIsBatchProcessing(true);
    try {
      await deleteHistoryItems(Array.from(selectedIds));
      setHistory((prev) => prev.filter((item) => !selectedIds.has(item.id)));
      setSelectedIds(new Set());
      toast.success(`已删除 ${selectedIds.size} 张图片`);
    } catch {
      toast.error('删除失败');
    } finally {
      setIsBatchProcessing(false);
    }
  };

  const handleBatchDownload = () => {
    if (selectedIds.size === 0) return;
    const items = history.filter((item) => selectedIds.has(item.id));
    items.forEach((item, i) => {
      setTimeout(() => {
        const link = document.createElement('a');
        link.href = `data:${item.mimeType};base64,${item.imageData}`;
        link.download = `painting-${item.id}.${getFileExtension(item.mimeType)}`;
        document.body.appendChild(link);
        link.click();
        link.remove();
      }, i * 500);
    });
    toast.success(`开始下载 ${items.length} 张图片`);
  };

  const handleLogout = () => {
    document.cookie = `${USER_SESSION_COOKIE}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
    onLogout();
  };

  const selectedModelDisplay = models.find(m => m.modelKey === selectedModel)?.displayName || '';
  const supportsImageSize = selectedModelDisplay.toLowerCase().includes('pro');

  return (
    <div className="flex h-screen w-full bg-background text-foreground overflow-hidden">
      <aside
        className={cn(
          'fixed md:relative z-40 w-[340px] h-full bg-sidebar border-r border-border',
          'transform transition-transform duration-300 ease-in-out flex flex-col shrink-0',
          isSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        )}
      >
        <div className="h-16 flex items-center justify-between px-6 border-b border-border shrink-0">
          <div className="flex items-center gap-3">
            <img src="/logo.svg" alt="Logo" className="w-8 h-8" />
            <h1 className="text-lg font-bold tracking-tight text-foreground">Painting Web</h1>
          </div>
          <button onClick={() => setIsSidebarOpen(false)} className="md:hidden text-muted-foreground">
            <Menu className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-primary" />
                提示词 (PROMPT)
              </label>
              <span className="text-[10px] text-muted-foreground">{prompt.length}/2000</span>
            </div>
            <div className="relative group">
              <Textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="描述你的想象..."
                className="h-32 bg-muted/50 border-border focus:border-primary resize-none"
              />
              {prompt && (
                <button
                  onClick={() => setPrompt('')}
                  className="absolute bottom-2 right-2 text-[10px] text-muted-foreground hover:text-foreground bg-muted px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  清空
                </button>
              )}
            </div>
          </div>

          <div className="border-t border-border" />

          <div className="space-y-2">
            <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
              模型 (MODEL)
            </Label>
            <div className="grid grid-cols-1 gap-2">
              {models.map((m) => (
                <button
                  key={m.modelKey}
                  onClick={() => setSelectedModel(m.modelKey)}
                  className={cn(
                    'p-3 rounded-lg border transition-all duration-200 ease-in-out cursor-pointer text-center',
                    selectedModel === m.modelKey
                      ? 'bg-gradient-to-br from-primary/20 to-primary/5 border-primary/50 shadow-lg ring-2 ring-primary/40'
                      : 'bg-muted/30 border-border hover:bg-muted/50 hover:border-primary/30 hover:shadow-md'
                  )}
                >
                  <div className={cn('text-sm font-medium', selectedModel === m.modelKey ? 'text-primary' : 'text-muted-foreground')}>
                    {m.displayName}
                  </div>
                </button>
              ))}
              {models.length === 0 && (
                <p className="text-xs text-muted-foreground">No models available</p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                参考图 ({refImages.length}/{MAX_REF_IMAGES})
              </Label>
              {refImages.length > 0 && (
                <button onClick={clearRefImages} className="text-[10px] text-destructive hover:text-destructive/80">
                  全部移除
                </button>
              )}
            </div>
            {refImages.length > 0 && (
              <div className="grid grid-cols-4 gap-2">
                {refImages.map((img, idx) => (
                  <div
                    key={img.id}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.effectAllowed = 'move';
                      e.dataTransfer.setData('text/plain', img.id);
                    }}
                    onDragOver={(e) => {
                      e.preventDefault();
                      e.dataTransfer.dropEffect = 'move';
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      const fromId = e.dataTransfer.getData('text/plain');
                      if (!fromId || fromId === img.id) return;
                      setRefImages(prev => {
                        const fromIdx = prev.findIndex(i => i.id === fromId);
                        const toIdx = prev.findIndex(i => i.id === img.id);
                        if (fromIdx === -1 || toIdx === -1 || fromIdx === toIdx) return prev;
                        const next = [...prev];
                        const [moved] = next.splice(fromIdx, 1);
                        next.splice(toIdx, 0, moved);
                        return next;
                      });
                    }}
                    className="relative aspect-square bg-muted/30 rounded-lg overflow-hidden border border-border group cursor-move hover:border-primary/50 transition-colors"
                  >
                    <img src={img.data} alt={`参考图${idx + 1}`} className="w-full h-full object-cover" />
                    <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-[10px] text-center py-0.5">
                      参考图{idx + 1}
                    </div>
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setRefImages(prev => prev.filter(i => i.id !== img.id));
                      }}
                      className="absolute top-1 right-1 w-5 h-5 bg-black/60 hover:bg-destructive rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="w-3 h-3 text-white" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            {refImages.length < MAX_REF_IMAGES && (
              <label className="flex items-center justify-center w-full h-12 border border-border border-dashed rounded-lg cursor-pointer bg-muted/30 hover:bg-muted/60 hover:border-muted-foreground transition-all group">
                <div className="flex items-center gap-2">
                  <Upload className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                  <span className="text-xs text-muted-foreground">上传参考图片</span>
                </div>
                <input type="file" className="hidden" accept="image/*" multiple onChange={handleFileSelect} ref={fileInputRef} />
              </label>
            )}
          </div>

          <div className="space-y-2">
            <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
              长宽比 (默认 Auto)
            </Label>
            <div className="grid grid-cols-4 gap-2">
              {ASPECT_RATIOS.map((opt) => {
                const isAuto = opt.value === 'auto';
                const [w, h] = isAuto ? [1, 1] : opt.value.split(':').map(Number);
                const maxDim = 20;
                const scale = maxDim / Math.max(w, h);
                const boxW = Math.round(w * scale);
                const boxH = Math.round(h * scale);
                return (
                  <button
                    key={opt.value}
                    onClick={() => setAspectRatio(opt.value)}
                    className={cn(
                      'flex flex-col items-center justify-center gap-1.5 p-2.5 rounded-lg border transition-all duration-200',
                      aspectRatio === opt.value
                        ? 'bg-primary/10 border-primary/50 ring-1 ring-primary/30'
                        : 'bg-muted/20 border-border hover:bg-muted/40 hover:border-muted-foreground'
                    )}
                  >
                    <div
                      className={cn(
                        'border-2',
                        aspectRatio === opt.value ? 'border-primary' : 'border-muted-foreground/50',
                        isAuto && 'border-dashed'
                      )}
                      style={{ width: boxW, height: boxH }}
                    />
                    <span className={cn('text-[10px] font-medium', aspectRatio === opt.value ? 'text-primary' : 'text-muted-foreground')}>
                      {opt.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className={cn('space-y-2', !supportsImageSize && 'opacity-50 pointer-events-none')}>
            <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
              分辨率 (RESOLUTION)
            </Label>
            <div className="flex bg-muted/30 rounded-lg p-1 border border-border">
              {IMAGE_SIZES.map((s) => (
                <button
                  key={s.value}
                  onClick={() => setImageSize(s.value)}
                  className={cn(
                    'flex-1 py-1.5 text-[10px] font-bold rounded transition-all',
                    imageSize === s.value ? 'bg-secondary text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  {s.label}
                </button>
              ))}
            </div>
            {!supportsImageSize && <p className="text-[10px] text-muted-foreground">当前模型不支持分辨率控制</p>}
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
              <Layers className="w-3 h-3" />
              生成数量 (COUNT)
            </label>
            <input
              type="number"
              min={1}
              max={10}
              value={imageCount}
              onChange={(e) => setImageCount(Math.min(10, Math.max(1, parseInt(e.target.value) || 1)))}
              className="w-full px-3 py-2 text-sm bg-muted/50 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>
        </div>

        <div className="p-5 border-t border-border bg-sidebar shrink-0 space-y-3">
          <Button
            onClick={handleGenerate}
            disabled={isLoading || !prompt.trim() || !selectedModel}
            className="w-full py-6 font-bold text-sm shadow-xl shadow-primary/10 bg-gradient-to-r from-banana-600 to-banana-500 hover:from-banana-500 hover:to-banana-400 text-background disabled:opacity-50"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                {progress ? `生成中 (${progress.current}/${progress.total})...` : '生成中...'}
              </>
            ) : (
              <>
                <Zap className="w-4 h-4 mr-2 fill-current" />
                生成图片 (GENERATE)
              </>
            )}
          </Button>
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors py-2"
          >
            <LogOut className="w-3 h-3" />
            <span>退出登录</span>
          </button>
        </div>
      </aside>

      <main className="flex-1 h-full flex flex-col relative overflow-hidden bg-background">
        <header className="h-16 relative flex items-center justify-center px-6 border-b border-border/50 bg-background/90 backdrop-blur z-20 shrink-0">
          {!isSelectionMode ? (
            <>
              <div className="absolute left-6 flex items-center gap-3">
                <button
                  onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                  className="p-2 -ml-2 text-muted-foreground hover:text-foreground rounded-lg md:hidden"
                >
                  <Menu className="w-6 h-6" />
                </button>
                {history.length > 0 && (
                  <button
                    onClick={toggleSelectionMode}
                    className="flex items-center gap-2 px-3 py-1.5 bg-muted/50 hover:bg-muted text-muted-foreground rounded-lg text-sm transition-colors border border-border"
                  >
                    <Layers className="w-4 h-4" />
                    <span className="hidden sm:inline">批量管理</span>
                  </button>
                )}
              </div>
              <h2 className="text-2xl font-black tracking-widest bg-gradient-to-r from-blue-400 via-purple-400 to-primary bg-clip-text text-transparent uppercase italic">
                探索画廊
              </h2>
              <div className="absolute right-6" />
            </>
          ) : (
            <div className="w-full flex items-center justify-between">
              <div className="flex items-center gap-4">
                <button
                  onClick={toggleSelectionMode}
                  disabled={isBatchProcessing}
                  className="p-2 hover:bg-muted rounded-lg text-muted-foreground transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
                <span className="font-bold text-foreground">已选择 {selectedIds.size} 项</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleSelectAll}
                  disabled={isBatchProcessing}
                  className="px-3 py-1.5 text-sm font-medium text-muted-foreground hover:text-foreground bg-muted hover:bg-secondary rounded-lg transition-colors disabled:opacity-50"
                >
                  {selectedIds.size === history.length ? '取消全选' : '全选'}
                </button>
                <div className="h-6 w-px bg-border mx-1" />
                <button
                  onClick={handleBatchDownload}
                  disabled={selectedIds.size === 0 || isBatchProcessing}
                  className={cn(
                    'p-2 rounded-lg transition-colors',
                    selectedIds.size > 0 && !isBatchProcessing ? 'text-primary hover:bg-muted' : 'text-muted-foreground cursor-not-allowed'
                  )}
                  title="批量下载"
                >
                  <Download className="w-5 h-5" />
                </button>
                <button
                  onClick={handleBatchDelete}
                  disabled={selectedIds.size === 0 || isBatchProcessing}
                  className={cn(
                    'p-2 rounded-lg transition-colors',
                    selectedIds.size > 0 && !isBatchProcessing ? 'text-destructive hover:bg-destructive/10' : 'text-muted-foreground cursor-not-allowed'
                  )}
                  title="批量删除"
                >
                  {isBatchProcessing ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <Trash2 className="w-5 h-5" />
                  )}
                </button>
              </div>
            </div>
          )}
        </header>

        <div className="flex-1 overflow-y-auto p-4 md:p-6">
          {history.length === 0 && !isLoading ? (
            <div className="h-full flex flex-col items-center justify-center text-muted-foreground space-y-4">
              <div className="w-24 h-24 bg-muted rounded-full flex items-center justify-center">
                <ImageIcon className="w-10 h-10 opacity-30" />
              </div>
              <div className="text-center">
                <p className="text-lg font-medium text-muted-foreground">画布为空</p>
                <p className="text-sm opacity-50">创建你的第一个杰作</p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 md:gap-6">
              {isLoading && Array.from({ length: imageCount }).map((_, i) => (
                <div key={`loading-${i}`} className="aspect-square rounded-xl bg-muted border border-border animate-pulse flex items-center justify-center relative overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent skew-x-12 animate-shimmer" />
                  <Sparkles className="w-8 h-8 text-primary animate-bounce" />
                </div>
              ))}
              {history.map((item) => (
                <div
                  key={item.id}
                  onClick={() => {
                    if (isSelectionMode) toggleItemSelection(item.id);
                    else setSelectedImage(item);
                  }}
                  className={cn(
                    'group relative aspect-square rounded-xl bg-muted overflow-hidden cursor-pointer border transition-all hover:shadow-2xl hover:shadow-black/50',
                    isSelectionMode && selectedIds.has(item.id)
                      ? 'border-primary ring-2 ring-primary/20'
                      : 'border-transparent hover:border-border hover:-translate-y-1'
                  )}
                >
                  <img
                    src={`data:${item.mimeType};base64,${item.imageData}`}
                    alt={item.params.prompt}
                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                    loading="lazy"
                  />
                  {isSelectionMode && (
                    <div className="absolute top-2 right-2 z-10 transition-transform transform scale-100 active:scale-90">
                      {selectedIds.has(item.id) ? (
                        <CheckCircle className="w-6 h-6 text-primary fill-background" />
                      ) : (
                        <Circle className="w-6 h-6 text-white/70 hover:text-white fill-black/40" />
                      )}
                    </div>
                  )}
                  {!isSelectionMode && (
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-3">
                      <p className="text-white text-xs font-medium line-clamp-2 mb-2">{item.params.prompt}</p>
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-gray-300 bg-white/10 px-1.5 py-0.5 rounded backdrop-blur-sm">
                          {item.params.imageSize}
                        </span>
                      </div>
                    </div>
                  )}
                  {isSelectionMode && selectedIds.has(item.id) && (
                    <div className="absolute inset-0 bg-primary/10 pointer-events-none" />
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {selectedImage && (
        <ImageDetailModal
          item={selectedImage}
          onClose={() => setSelectedImage(null)}
          onReuse={handleReuseParams}
          onDelete={handleDeleteItem}
        />
      )}
    </div>
  );
}
