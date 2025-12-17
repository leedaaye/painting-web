'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { LayoutDashboard, Users, LogOut, Shield, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ADMIN_SESSION_COOKIE } from '@/lib/shared/jwt';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  if (pathname === '/admin/login') {
    return <div className="min-h-screen bg-background text-foreground">{children}</div>;
  }

  const navItems = [
    { href: '/admin/providers', label: 'API 服务商', icon: LayoutDashboard },
    { href: '/admin/users', label: '用户密钥', icon: Users },
    { href: '/admin/settings', label: '系统设置', icon: Settings },
  ];

  const handleLogout = () => {
    document.cookie = `${ADMIN_SESSION_COOKIE}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
    router.push('/admin/login');
  };

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <aside className="w-64 border-r border-border bg-sidebar flex flex-col fixed inset-y-0 z-50">
        <div className="h-16 flex items-center gap-3 px-6 border-b border-border">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-banana-400 to-banana-600 flex items-center justify-center text-background font-bold shadow-lg shadow-primary/20">
            <Shield className="w-5 h-5" />
          </div>
          <span className="font-bold text-lg tracking-tight">管理后台</span>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                )}
              >
                <item.icon className="w-4 h-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-border">
          <Button
            variant="ghost"
            onClick={handleLogout}
            className="w-full justify-start text-muted-foreground hover:text-destructive hover:bg-destructive/10"
          >
            <LogOut className="w-4 h-4 mr-2" />
            退出登录
          </Button>
        </div>
      </aside>

      <main className="flex-1 ml-64 flex flex-col min-h-screen">
        <header className="h-16 border-b border-border bg-background/80 backdrop-blur sticky top-0 z-40 px-8 flex items-center justify-between">
          <h1 className="text-xl font-semibold">
            {navItems.find((i) => i.href === pathname)?.label || 'Dashboard'}
          </h1>
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground">管理员</span>
          </div>
        </header>
        <div className="flex-1 p-8">{children}</div>
      </main>
    </div>
  );
}
