'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Shield, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export default function AdminLoginPage() {
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) return;

    setIsLoading(true);
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });

      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || '登录失败');
        return;
      }

      if (data.bootstrapped) {
        toast.success('管理员账户创建成功');
      } else {
        toast.success('欢迎回来，管理员');
      }
      router.push('/admin/providers');
    } catch {
      toast.error('网络错误');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex h-screen w-full items-center justify-center bg-background">
      <div className="w-full max-w-sm space-y-6 px-4">
        <div className="flex flex-col items-center space-y-2 text-center">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-banana-400 to-banana-600 flex items-center justify-center shadow-lg shadow-primary/20 mb-4">
            <Shield className="w-7 h-7 text-background" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">管理员登录</h1>
          <p className="text-sm text-muted-foreground">
            输入密码以访问管理后台
          </p>
        </div>

        <div className="rounded-xl border border-border bg-card p-6 shadow-xl">
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password">密码</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="bg-muted/50 border-border focus:border-primary/50"
              />
            </div>
            <Button
              type="submit"
              disabled={isLoading}
              className="w-full font-bold bg-gradient-to-r from-banana-400 to-banana-600 hover:from-banana-500 hover:to-banana-700 text-background border-none"
            >
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : '登录'}
            </Button>
          </form>
        </div>

        <p className="px-8 text-center text-xs text-muted-foreground">
          首次登录将自动初始化管理员账户
        </p>
      </div>
    </div>
  );
}
