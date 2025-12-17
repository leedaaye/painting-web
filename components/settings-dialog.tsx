'use client';

import { useState } from 'react';
import { Settings, Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAppStore } from '@/lib/store';
import { toast } from 'sonner';

export function SettingsDialog() {
  const { apiKey, baseUrl, setApiKey, setBaseUrl } = useAppStore();
  const [open, setOpen] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [tempKey, setTempKey] = useState(apiKey);
  const [tempUrl, setTempUrl] = useState(baseUrl);

  const handleOpenChange = (isOpen: boolean) => {
    if (isOpen) {
      setTempKey(apiKey);
      setTempUrl(baseUrl);
    }
    setOpen(isOpen);
  };

  const handleSave = () => {
    setApiKey(tempKey);
    setBaseUrl(tempUrl);
    setOpen(false);
    toast.success('设置已保存');
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <button className="w-full flex items-center justify-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors py-2">
          <Settings className="w-3 h-3" />
          <span>配置代理服务</span>
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px] bg-card border-border">
        <DialogHeader>
          <DialogTitle className="text-foreground">API 设置</DialogTitle>
          <DialogDescription className="text-muted-foreground">
            配置您的 API 连接信息。数据仅存储在本地浏览器中。
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="url" className="text-foreground/80">API Base URL</Label>
            <Input
              id="url"
              value={tempUrl}
              onChange={(e) => setTempUrl(e.target.value)}
              placeholder="https://generativelanguage.googleapis.com"
              className="bg-muted/50 border-border"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="key" className="text-foreground/80">API Key</Label>
            <div className="relative">
              <Input
                id="key"
                type={showKey ? 'text' : 'password'}
                value={tempKey}
                onChange={(e) => setTempKey(e.target.value)}
                placeholder="AIza..."
                className="pr-10 bg-muted/50 border-border"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                onClick={() => setShowKey(!showKey)}
              >
                {showKey ? <EyeOff className="h-4 w-4 text-muted-foreground" /> : <Eye className="h-4 w-4 text-muted-foreground" />}
              </Button>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button
            onClick={handleSave}
            className="bg-gradient-to-r from-banana-600 to-banana-500 hover:from-banana-500 hover:to-banana-400 text-background"
          >
            保存配置
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
