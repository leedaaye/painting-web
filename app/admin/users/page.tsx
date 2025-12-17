'use client';

import { useState, useEffect } from 'react';
import { Plus, Trash2, Copy, Check, Loader2, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface UserUsage {
  modelName: string;
  count: number;
}

interface UserKey {
  id: string;
  name: string;
  keyId: string;
  usageCount: number;
  lastUsedAt: string | null;
  isActive: boolean;
  createdAt: string;
  usages?: UserUsage[];
}

export default function UsersPage() {
  const [users, setUsers] = useState<UserKey[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [newKey, setNewKey] = useState<string | null>(null);
  const [isNewKeyModalOpen, setIsNewKeyModalOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newUserName, setNewUserName] = useState('');
  const [copied, setCopied] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserKey | null>(null);
  const [editForm, setEditForm] = useState({ name: '', keyId: '', isActive: true });
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      const res = await fetch('/api/admin/users');
      const data = await res.json();
      if (res.ok) setUsers(data.users || []);
    } catch {
      toast.error('加载用户失败');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateKey = async () => {
    if (!newUserName.trim()) {
      toast.error('请输入名称');
      return;
    }

    setIsCreating(true);
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newUserName }),
      });

      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || '创建密钥失败');
        return;
      }

      setNewKey(data.key);
      setIsCreateModalOpen(false);
      setIsNewKeyModalOpen(true);
      setNewUserName('');
      loadUsers();
    } catch {
      toast.error('网络错误');
    } finally {
      setIsCreating(false);
    }
  };

  const copyToClipboard = () => {
    if (newKey) {
      navigator.clipboard.writeText(newKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast.success('已复制到剪贴板');
    }
  };

  const handleOpenSettings = (user: UserKey) => {
    setEditingUser(user);
    setEditForm({ name: user.name, keyId: user.keyId, isActive: user.isActive });
    setIsSettingsModalOpen(true);
  };

  const handleSaveSettings = async () => {
    if (!editingUser) return;
    if (!editForm.name.trim() || !editForm.keyId.trim()) {
      toast.error('请填写所有字段');
      return;
    }

    setIsSaving(true);
    try {
      const res = await fetch(`/api/admin/users/${editingUser.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm),
      });

      if (res.ok) {
        toast.success('已保存');
        setIsSettingsModalOpen(false);
        loadUsers();
      } else {
        const data = await res.json();
        toast.error(data.error || '保存失败');
      }
    } catch {
      toast.error('网络错误');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('确定要撤销此密钥吗？此操作无法撤销。')) return;

    try {
      const res = await fetch(`/api/admin/users/${id}`, { method: 'DELETE' });
      if (res.ok) {
        toast.success('密钥已撤销');
        loadUsers();
      } else {
        toast.error('删除失败');
      }
    } catch {
      toast.error('网络错误');
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '从未';
    return new Date(dateStr).toLocaleString('zh-CN');
  };

  const formatUsages = (user: UserKey) => {
    if (!user.usages || user.usages.length === 0) {
      return <span>{user.usageCount}</span>;
    }
    return (
      <div className="space-y-1">
        {user.usages.map((u) => (
          <div key={u.modelName} className="text-xs">
            <span className="text-muted-foreground">{u.modelName}:</span> {u.count}
          </div>
        ))}
      </div>
    );
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
        <h2 className="text-2xl font-bold tracking-tight">用户密钥管理</h2>
        <Button onClick={() => setIsCreateModalOpen(true)} className="bg-primary text-background hover:bg-primary/90">
          <Plus className="w-4 h-4 mr-2" />
          创建密钥
        </Button>
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-muted/50 text-muted-foreground uppercase text-xs font-medium">
              <tr>
                <th className="px-6 py-4">名称</th>
                <th className="px-6 py-4">密钥 ID</th>
                <th className="px-6 py-4">使用次数</th>
                <th className="px-6 py-4">最后使用</th>
                <th className="px-6 py-4">状态</th>
                <th className="px-6 py-4 text-right">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {users.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-muted-foreground">
                    暂无用户密钥，点击上方按钮创建
                  </td>
                </tr>
              ) : (
                users.map((user) => (
                  <tr key={user.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-6 py-4 font-medium text-foreground">{user.name}</td>
                    <td className="px-6 py-4 text-muted-foreground font-mono text-xs">{user.keyId}</td>
                    <td className="px-6 py-4 text-muted-foreground">{formatUsages(user)}</td>
                    <td className="px-6 py-4 text-muted-foreground text-xs">{formatDate(user.lastUsedAt)}</td>
                    <td className="px-6 py-4">
                      <span
                        className={cn(
                          'px-2.5 py-0.5 rounded-full text-xs font-medium border',
                          user.isActive
                            ? 'bg-green-500/10 text-green-500 border-green-500/20'
                            : 'bg-red-500/10 text-red-500 border-red-500/20'
                        )}
                      >
                        {user.isActive ? '启用' : '禁用'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="icon" onClick={() => handleOpenSettings(user)}>
                          <Settings className="w-4 h-4 text-muted-foreground hover:text-primary" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(user.id)}>
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

      {/* Create User Modal */}
      <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle>创建用户密钥</DialogTitle>
            <DialogDescription>输入用户名称以便识别</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>用户名称</Label>
              <Input
                placeholder="如 Alice、团队 A 等"
                value={newUserName}
                onChange={(e) => setNewUserName(e.target.value)}
                className="bg-muted/50"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateModalOpen(false)}>
              取消
            </Button>
            <Button onClick={handleCreateKey} disabled={isCreating} className="bg-primary text-background hover:bg-primary/90">
              {isCreating ? <Loader2 className="w-4 h-4 animate-spin" /> : '创建'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New Key Display Modal */}
      <Dialog open={isNewKeyModalOpen} onOpenChange={setIsNewKeyModalOpen}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle>密钥创建成功</DialogTitle>
            <DialogDescription>请立即复制此密钥，关闭后将无法再次查看</DialogDescription>
          </DialogHeader>
          <div className="flex items-center gap-2 p-4 bg-muted/50 rounded-lg border border-border mt-2">
            <code className="flex-1 font-mono text-sm text-primary break-all">{newKey}</code>
            <Button size="icon" variant="ghost" onClick={copyToClipboard} className="shrink-0">
              {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
            </Button>
          </div>
          <DialogFooter>
            <Button onClick={() => setIsNewKeyModalOpen(false)} className="w-full">
              完成
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Settings Modal */}
      <Dialog open={isSettingsModalOpen} onOpenChange={setIsSettingsModalOpen}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle>用户设置</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>名称</Label>
              <Input
                value={editForm.name}
                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                className="bg-muted/50"
              />
            </div>
            <div className="space-y-2">
              <Label>密钥 ID</Label>
              <Input
                value={editForm.keyId}
                onChange={(e) => setEditForm({ ...editForm, keyId: e.target.value })}
                className="bg-muted/50 font-mono"
              />
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-muted/30">
              <Label className="cursor-pointer">启用状态</Label>
              <button
                type="button"
                onClick={() => setEditForm({ ...editForm, isActive: !editForm.isActive })}
                className={cn(
                  'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
                  editForm.isActive ? 'bg-primary' : 'bg-muted-foreground/30'
                )}
              >
                <span
                  className={cn(
                    'inline-block h-4 w-4 transform rounded-full bg-white transition-transform',
                    editForm.isActive ? 'translate-x-6' : 'translate-x-1'
                  )}
                />
              </button>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsSettingsModalOpen(false)}>
              取消
            </Button>
            <Button onClick={handleSaveSettings} disabled={isSaving} className="bg-primary text-background hover:bg-primary/90">
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : '保存'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
