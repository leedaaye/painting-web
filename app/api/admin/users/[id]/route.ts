import { NextResponse } from 'next/server';
import bcrypt from 'bcrypt';
import { prisma } from '@/lib/server/prisma';
import { requireAdmin, HttpError } from '@/lib/server/auth';
import { sha256Hex } from '@/lib/server/secrets';

export const runtime = 'nodejs';

export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin(req);
    const { id } = await ctx.params;
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
    await prisma.userKey.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof HttpError) return NextResponse.json({ error: err.message }, { status: err.status });
    const msg = err instanceof Error ? err.message : 'Internal error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin(req);
    const { id } = await ctx.params;
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

    const body = (await req.json().catch(() => null)) as {
      name?: string;
      plainKey?: string;
      isActive?: boolean;
    } | null;

    const data: { name?: string; plainKey?: string; keyId?: string; key?: string; isActive?: boolean } = {};
    if (typeof body?.name === 'string') data.name = body.name.trim();
    if (typeof body?.plainKey === 'string') {
      const newKey = body.plainKey.trim();
      data.plainKey = newKey;
      data.keyId = sha256Hex(newKey);
      data.key = await bcrypt.hash(newKey, 12);
    }
    if (typeof body?.isActive === 'boolean') data.isActive = body.isActive;

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
    }

    const updated = await prisma.userKey.update({
      where: { id },
      data,
      select: { id: true, name: true, plainKey: true, isActive: true },
    });

    return NextResponse.json({ user: updated });
  } catch (err) {
    if (err instanceof HttpError) return NextResponse.json({ error: err.message }, { status: err.status });
    const msg = err instanceof Error ? err.message : 'Internal error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
