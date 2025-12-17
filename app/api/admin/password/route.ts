import { NextResponse } from 'next/server';
import { requireAdmin, updateAdminPassword, HttpError } from '@/lib/server/auth';

export const runtime = 'nodejs';

export async function PUT(req: Request) {
  try {
    await requireAdmin(req);

    const body = (await req.json().catch(() => null)) as unknown;
    const { currentPassword, newPassword } = (body as { currentPassword?: string; newPassword?: string }) || {};

    if (!currentPassword || !newPassword) {
      return NextResponse.json({ error: '请填写所有必填项' }, { status: 400 });
    }

    if (newPassword.length < 6) {
      return NextResponse.json({ error: '新密码长度至少需要6位' }, { status: 400 });
    }

    await updateAdminPassword(currentPassword, newPassword);
    return NextResponse.json({ success: true });
  } catch (err) {
    if (err instanceof HttpError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}
