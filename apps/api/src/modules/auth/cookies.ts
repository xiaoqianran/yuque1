import type { Request, Response } from 'express';
import { SID_COOKIE } from './auth.types';

export function parseCookies(header: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) return out;
  for (const part of header.split(';')) {
    const i = part.indexOf('=');
    if (i <= 0) continue;
    const k = part.slice(0, i).trim();
    const v = part.slice(i + 1).trim();
    out[k] = decodeURIComponent(v);
  }
  return out;
}

export function readSid(req: Request): string | undefined {
  return parseCookies(req.headers.cookie)[SID_COOKIE];
}

export function setSidCookie(res: Response, sid: string): void {
  const secure = process.env.COOKIE_SECURE === 'true';
  const parts = [
    `${SID_COOKIE}=${encodeURIComponent(sid)}`,
    'HttpOnly',
    'Path=/',
    'SameSite=Lax',
  ];
  if (secure) parts.push('Secure');
  const days = Number(process.env.SESSION_TTL_DAYS ?? 7);
  parts.push(`Max-Age=${Math.max(1, days) * 24 * 3600}`);
  res.setHeader('Set-Cookie', parts.join('; '));
}

export function clearSidCookie(res: Response): void {
  const secure = process.env.COOKIE_SECURE === 'true';
  const parts = [
    `${SID_COOKIE}=`,
    'HttpOnly',
    'Path=/',
    'SameSite=Lax',
    'Max-Age=0',
  ];
  if (secure) parts.push('Secure');
  res.setHeader('Set-Cookie', parts.join('; '));
}
