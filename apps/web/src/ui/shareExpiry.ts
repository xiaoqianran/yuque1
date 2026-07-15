/** Share link expiry presets for the workspace UI. */

export type ShareExpiryPreset = 'never' | '1d' | '7d' | '30d';

export const SHARE_EXPIRY_OPTIONS: {
  value: ShareExpiryPreset;
  label: string;
}[] = [
  { value: 'never', label: '永久' },
  { value: '1d', label: '1 天' },
  { value: '7d', label: '7 天' },
  { value: '30d', label: '30 天' },
];

const MS: Record<Exclude<ShareExpiryPreset, 'never'>, number> = {
  '1d': 86_400_000,
  '7d': 7 * 86_400_000,
  '30d': 30 * 86_400_000,
};

/** Convert preset to ISO expiresAt, or null for never. */
export function expiresAtFromPreset(
  preset: ShareExpiryPreset,
  nowMs: number = Date.now(),
): string | null {
  if (preset === 'never') return null;
  return new Date(nowMs + MS[preset]).toISOString();
}

/** True when expiresAt is set and already in the past. */
export function isShareExpired(
  expiresAt: string | null | undefined,
  nowMs: number = Date.now(),
): boolean {
  if (!expiresAt) return false;
  const t = Date.parse(expiresAt);
  if (Number.isNaN(t)) return false;
  return t <= nowMs;
}

/** Human-readable expiry line for the share panel. */
export function formatShareExpiry(
  expiresAt: string | null | undefined,
  nowMs: number = Date.now(),
): string {
  if (!expiresAt) return '有效期：永久';
  const t = Date.parse(expiresAt);
  if (Number.isNaN(t)) return '有效期：未知';
  const label = new Date(t).toLocaleString();
  if (t <= nowMs) return `已过期（${label}）`;
  return `有效期至 ${label}`;
}
