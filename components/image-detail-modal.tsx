'use client';

import { X, Download, Copy, Trash2, RotateCcw, Sparkles } from 'lucide-react';
import type { HistoryItem } from '@/lib/types';
import { toast } from 'sonner';

const getFileExtension = (mimeType: string) => {
  const map: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/gif': 'gif',
  };
  return map[mimeType.toLowerCase()] || 'png';
};

interface ImageDetailModalProps {
  item: HistoryItem | null;
  onClose: () => void;
  onReuse: (item: HistoryItem) => void;
  onDelete: (id: string) => void;
}

export function ImageDetailModal({ item, onClose, onReuse, onDelete }: ImageDetailModalProps) {
  if (!item) return null;

  const imageUrl = `data:${item.mimeType};base64,${item.imageData}`;

  const handleCopyPrompt = async () => {
    try {
      await navigator.clipboard.writeText(item.params.prompt);
      toast.success('提示词已复制');
    } catch {
      toast.error('复制失败');
    }
  };

  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = imageUrl;
    link.download = `painting-${item.id}.${getFileExtension(item.mimeType)}`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    toast.success('图片已下载');
  };

  return (
    <div className="fixed inset-0 z-50 flex bg-black/95 backdrop-blur-sm">
      <button
        onClick={onClose}
        className="absolute top-4 right-4 z-50 p-2 text-gray-400 hover:text-white bg-black/50 rounded-full hover:bg-gray-800 transition-colors md:hidden"
      >
        <X className="w-6 h-6" />
      </button>

      <div className="flex flex-col md:flex-row w-full h-full overflow-hidden">
        <div
          className="flex-1 bg-background flex items-center justify-center p-4 md:p-8 relative"
          onClick={onClose}
        >
          <img
            src={imageUrl}
            alt="Detail"
            className="max-w-full max-h-full object-contain shadow-2xl shadow-black/50 rounded-md"
            onClick={(e) => e.stopPropagation()}
          />
        </div>

        <div className="w-full md:w-[400px] bg-sidebar border-l border-border flex flex-col h-[50%] md:h-full shadow-2xl z-40">
          <div className="flex items-center justify-between p-6 border-b border-border">
            <div className="flex items-center gap-2 text-primary">
              <Sparkles className="w-5 h-5" />
              <h2 className="text-lg font-bold text-foreground">详情</h2>
            </div>
            <button
              onClick={onClose}
              className="hidden md:block text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-6 space-y-8">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                  提示词 (Prompt)
                </label>
                <button
                  onClick={handleCopyPrompt}
                  className="text-xs flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors"
                >
                  <Copy className="w-3 h-3" /> 复制
                </button>
              </div>
              <div className="bg-muted/50 p-4 rounded-xl border border-border text-muted-foreground text-sm italic leading-relaxed">
                "{item.params.prompt}"
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="bg-muted/30 p-3 rounded-lg border border-border">
                <div className="text-[10px] text-muted-foreground uppercase mb-1">尺寸</div>
                <div className="font-mono text-foreground font-medium">{item.params.imageSize}</div>
              </div>
              <div className="bg-muted/30 p-3 rounded-lg border border-border">
                <div className="text-[10px] text-muted-foreground uppercase mb-1">比例</div>
                <div className="font-mono text-foreground font-medium">{item.params.aspectRatio}</div>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                模型 (Model)
              </label>
              <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg border border-border">
                <div className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]" />
                <span className="text-sm font-medium text-foreground/80 truncate">
                  {item.params.model}
                </span>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                创建时间
              </label>
              <div className="text-sm text-foreground/80">
                {new Date(item.timestamp).toLocaleString('zh-CN')}
              </div>
            </div>
          </div>

          <div className="p-6 border-t border-border space-y-3 bg-muted/30">
            <button
              onClick={handleDownload}
              className="flex items-center justify-center gap-2 w-full bg-foreground text-background font-bold py-3 rounded-xl hover:bg-foreground/90 transition-colors"
            >
              <Download className="w-4 h-4" />
              下载图片
            </button>

            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => {
                  onReuse(item);
                  onClose();
                }}
                className="flex items-center justify-center gap-2 py-2.5 rounded-lg border border-border hover:bg-muted text-muted-foreground hover:text-foreground transition-colors text-sm font-medium"
              >
                <RotateCcw className="w-4 h-4" />
                复用参数
              </button>
              <button
                onClick={() => {
                  onDelete(item.id);
                  onClose();
                }}
                className="flex items-center justify-center gap-2 py-2.5 rounded-lg border border-border hover:bg-destructive/10 hover:border-destructive/50 text-muted-foreground hover:text-destructive transition-colors text-sm font-medium"
              >
                <Trash2 className="w-4 h-4" />
                删除
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
