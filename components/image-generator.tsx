'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { useAppStore, type ImageAspectRatio, type ImageSize } from '@/lib/store';
import { saveHistoryItem, getAllHistory, deleteHistoryItem, deleteHistoryItems } from '@/lib/db';
import type { HistoryItem } from '@/lib/types';
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
  const [refImage, setRefImage] = useState<string | null>(null);

  const [models, setModels] = useState<Model[]>([]);
  const [selectedModel, setSelectedModel] = useState<string>('');

  const [selectedImage, setSelectedImage] = useState<HistoryItem | null>(null);
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isBatchProcessing, setIsBatchProcessing] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('请选择图片文件');
      e.target.value = '';
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('图片过大，请使用 5MB 以下的图片');
      e.target.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onerror = () => { toast.error('读取图片失败'); e.target.value = ''; };
    reader.onload = () => {
      setRefImage(reader.result as string);
      e.target.value = '';
    };
    reader.readAsDataURL(file);
  }, []);

  const handleGenerate = async () => {
    if (!prompt.trim() || isLoading || !selectedModel) return;

    setIsLoading(true);
    if (window.innerWidth < 768) setIsSidebarOpen(false);

    try {
      const inputImage = refImage ? {
        mimeType: refImage.split(';')[0].split(':')[1],
        data: refImage.split(',')[1],
      } : undefined;

      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          modelKey: selectedModel,
          inputImage,
          aspectRatio: aspectRatio === 'auto' ? undefined : aspectRatio,
          imageSize: supportsImageSize ? imageSize : undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Generation failed');
      }

      const modelDisplay = models.find(m => m.modelKey === selectedModel)?.displayName || selectedModel;

      const newItem: HistoryItem = {
        id: createId(),
        timestamp: Date.now(),
        params: { prompt, model: modelDisplay, aspectRatio, imageSize, referenceImage: refImage || undefined },
        imageData: data.image.data,
        mimeType: data.image.mimeType,
      };

      await saveHistoryItem(newItem);
      setHistory((prev) => [newItem, ...prev]);
      toast.success('图片生成完成');
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : '生成失败';
      toast.error(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleReuseParams = (item: HistoryItem) => {
    setPrompt(item.params.prompt);
    setAspectRatio(item.params.aspectRatio);
    setImageSize(item.params.imageSize);
    if (item.params.referenceImage) {
      setRefImage(item.params.referenceImage);
    } else {
      setRefImage(null);
    }
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
                参考图 (REFERENCE)
              </Label>
              {refImage && (
                <button onClick={() => setRefImage(null)} className="text-[10px] text-destructive hover:text-destructive/80">
                  移除
                </button>
              )}
            </div>
            {!refImage ? (
              <label className="flex items-center justify-center w-full h-16 border border-border border-dashed rounded-lg cursor-pointer bg-muted/30 hover:bg-muted/60 hover:border-muted-foreground transition-all group">
                <div className="flex items-center gap-2">
                  <Upload className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                  <span className="text-xs text-muted-foreground">上传参考图片</span>
                </div>
                <input type="file" className="hidden" accept="image/*" onChange={handleFileSelect} ref={fileInputRef} />
              </label>
            ) : (
              <div className="relative w-full bg-muted/30 rounded-lg overflow-hidden border border-border group">
                <img src={refImage} alt="Ref" className="w-full max-h-40 object-contain opacity-80 group-hover:opacity-100 transition-opacity" />
              </div>
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
                生成中...
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
              {isLoading && (
                <div className="aspect-square rounded-xl bg-muted border border-border animate-pulse flex items-center justify-center relative overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent skew-x-12 animate-shimmer" />
                  <Sparkles className="w-8 h-8 text-primary animate-bounce" />
                </div>
              )}
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
