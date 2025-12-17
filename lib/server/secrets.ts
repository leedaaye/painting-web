import 'server-only';
import { createHash, randomBytes } from 'crypto';

export function sha256Hex(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

export function generateUserKeySecret(): string {
  const rand = randomBytes(32).toString('base64url');
  return `uk_live_${rand}`;
}

export function maskSecret(value: string): string {
  if (!value) return '';
  const tail = value.slice(-4);
  return `${'*'.repeat(Math.max(0, value.length - 4))}${tail}`;
}
