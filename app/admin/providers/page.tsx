'use client';

import { useState, useEffect } from 'react';
import { Plus, Pencil, Trash2, Eye, EyeOff, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface Provider {
  id: string;
  name: string;
  displayName: string;
  modelId: string;
  baseUrl: string;
  isActive: boolean;
  apiKey?: string;
}

export default function ProvidersPage() {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProvider, setEditingProvider] = useState<Provider | null>(null);
  const [formData, setFormData] = useState<Partial<Provider> & { apiKey?: string }>({});
  const [showApiKey, setShowApiKey] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    loadProviders();
  }, []);

  const loadProviders = async () => {
    try {
      const res = await fetch('/api/admin/providers');
      const data = await res.json();
      if (res.ok) setProviders(data.providers || []);
    } catch {
      toast.error('加载服务商失败');
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenModal = (provider?: Provider) => {
    if (provider) {
      setEditingProvider(provider);
      setFormData({ ...provider });
    } else {
      setEditingProvider(null);
      setFormData({ isActive: true });
    }
    setShowApiKey(false);
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    if (!formData.name || !formData.displayName || !formData.modelId || !formData.baseUrl) {
      toast.error('请填写所有必填字段');
      return;
    }
    if (!editingProvider && !formData.apiKey) {
      toast.error('新服务商必须填写 API Key');
      return;
    }

    setIsSaving(true);
    try {
      const res = await fetch('/api/admin/providers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingProvider?.id,
          name: formData.name,
          displayName: formData.displayName,
          modelId: formData.modelId,
          baseUrl: formData.baseUrl,
          apiKey: formData.apiKey || undefined,
          isActive: formData.isActive,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || '保存失败');
        return;
      }

      toast.success(editingProvider ? '服务商已更新' : '服务商已创建');
      setIsModalOpen(false);
      loadProviders();
    } catch {
      toast.error('网络错误');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('确定要删除此服务商吗？')) return;

    try {
      const res = await fetch(`/api/admin/providers/${id}`, { method: 'DELETE' });
      if (res.ok) {
        toast.success('服务商已删除');
        loadProviders();
      } else {
        toast.error('删除失败');
      }
    } catch {
      toast.error('网络错误');
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold tracking-tight">API 服务商</h2>
        <Button onClick={() => handleOpenModal()} className="bg-primary text-background hover:bg-primary/90">
          <Plus className="w-4 h-4 mr-2" />
          添加服务商
        </Button>
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-muted/50 text-muted-foreground uppercase text-xs font-medium">
              <tr>
                <th className="px-6 py-4">状态</th>
                <th className="px-6 py-4">显示名称</th>
                <th className="px-6 py-4">内部名称</th>
                <th className="px-6 py-4">模型 ID</th>
                <th className="px-6 py-4">Base URL</th>
                <th className="px-6 py-4 text-right">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {providers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-muted-foreground">
                    暂无服务商配置，点击上方按钮添加
                  </td>
                </tr>
              ) : (
                providers.map((provider) => (
                  <tr key={provider.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-6 py-4">
                      <div
                        className={cn(
                          'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border',
                          provider.isActive
                            ? 'bg-green-500/10 text-green-500 border-green-500/20'
                            : 'bg-gray-500/10 text-gray-400 border-gray-500/20'
                        )}
                      >
                        <span className={cn('w-1.5 h-1.5 rounded-full', provider.isActive ? 'bg-green-500' : 'bg-gray-400')} />
                        {provider.isActive ? '启用' : '禁用'}
                      </div>
                    </td>
                    <td className="px-6 py-4 font-medium text-foreground">{provider.displayName}</td>
                    <td className="px-6 py-4 text-muted-foreground font-mono text-xs">{provider.name}</td>
                    <td className="px-6 py-4 text-muted-foreground font-mono text-xs">{provider.modelId}</td>
                    <td className="px-6 py-4 text-muted-foreground text-xs truncate max-w-[200px]">{provider.baseUrl}</td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button variant="ghost" size="icon" onClick={() => handleOpenModal(provider)}>
                          <Pencil className="w-4 h-4 text-muted-foreground hover:text-primary" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(provider.id)}>
                          <Trash2 className="w-4 h-4 text-muted-foreground hover:text-destructive" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-[500px] bg-card border-border">
          <DialogHeader>
            <DialogTitle>{editingProvider ? '编辑服务商' : '添加服务商'}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>内部名称</Label>
                <Input
                  placeholder="如 nano-banana"
                  value={formData.name || ''}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="bg-muted/50"
                />
              </div>
              <div className="space-y-2">
                <Label>显示名称</Label>
                <Input
                  placeholder="如 Nano Banana"
                  value={formData.displayName || ''}
                  onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
                  className="bg-muted/50"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>模型 ID</Label>
              <Input
                placeholder="如 gemini-2.5-flash-image"
                value={formData.modelId || ''}
                onChange={(e) => setFormData({ ...formData, modelId: e.target.value })}
                className="bg-muted/50 font-mono text-sm"
              />
            </div>
            <div className="space-y-2">
              <Label>Base URL</Label>
              <Input
                placeholder="https://generativelanguage.googleapis.com"
                value={formData.baseUrl || ''}
                onChange={(e) => setFormData({ ...formData, baseUrl: e.target.value })}
                className="bg-muted/50 font-mono text-sm"
              />
            </div>
            <div className="space-y-2">
              <Label>API Key</Label>
              <div className="relative">
                <Input
                  type={showApiKey ? 'text' : 'password'}
                  placeholder="sk-..."
                  value={formData.apiKey || ''}
                  onChange={(e) => setFormData({ ...formData, apiKey: e.target.value })}
                  className="bg-muted/50 font-mono text-sm pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowApiKey(!showApiKey)}
                  className="absolute right-3 top-2.5 text-muted-foreground hover:text-foreground"
                >
                  {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-muted/30">
              <Label className="cursor-pointer">启用状态</Label>
              <button
                type="button"
                onClick={() => setFormData({ ...formData, isActive: !formData.isActive })}
                className={cn(
                  'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
                  formData.isActive ? 'bg-primary' : 'bg-muted-foreground/30'
                )}
              >
                <span
                  className={cn(
                    'inline-block h-4 w-4 transform rounded-full bg-white transition-transform',
                    formData.isActive ? 'translate-x-6' : 'translate-x-1'
                  )}
                />
              </button>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsModalOpen(false)}>
              取消
            </Button>
            <Button onClick={handleSave} disabled={isSaving} className="bg-primary text-background hover:bg-primary/90">
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : '保存'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
