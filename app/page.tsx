'use client';

import { useState, useEffect } from 'react';
import { ImageGenerator } from '@/components/image-generator';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Key } from 'lucide-react';
import { toast } from 'sonner';

export default function Page() {
  const [isChecking, setIsChecking] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [accessKey, setAccessKey] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const res = await fetch('/api/models');
      if (res.ok) {
        setIsAuthenticated(true);
      }
    } catch {
      // Not authenticated
    } finally {
      setIsChecking(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accessKey.trim()) return;

    setIsLoggingIn(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: accessKey }),
      });

      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || '登录失败');
        return;
      }

      toast.success('登录成功');
      setIsAuthenticated(true);
    } catch {
      toast.error('网络错误');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setAccessKey('');
  };

  if (isChecking) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <div className="w-full max-w-sm space-y-6 px-4">
          <div className="flex flex-col items-center space-y-2 text-center">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-banana-400 to-banana-600 flex items-center justify-center shadow-lg shadow-primary/20 mb-4">
              <Key className="w-7 h-7 text-background" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Painting Web</h1>
            <p className="text-sm text-muted-foreground">
              输入访问密钥以开始创作
            </p>
          </div>

          <div className="rounded-xl border border-border bg-card p-6 shadow-xl">
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="accessKey">访问密钥</Label>
                <Input
                  id="accessKey"
                  type="password"
                  placeholder="pw_..."
                  value={accessKey}
                  onChange={(e) => setAccessKey(e.target.value)}
                  className="bg-muted/50 border-border focus:border-primary/50 font-mono"
                />
              </div>
              <Button
                type="submit"
                disabled={isLoggingIn || !accessKey.trim()}
                className="w-full font-bold bg-gradient-to-r from-banana-400 to-banana-600 hover:from-banana-500 hover:to-banana-700 text-background border-none"
              >
                {isLoggingIn ? <Loader2 className="w-4 h-4 animate-spin" /> : '进入'}
              </Button>
            </form>
          </div>

          <p className="px-8 text-center text-xs text-muted-foreground">
            请联系管理员获取访问密钥
          </p>
        </div>
      </div>
    );
  }

  return <ImageGenerator onLogout={handleLogout} />;
}
