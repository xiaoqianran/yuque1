/** Title helper for document duplicate (save-as). */

export const DUPLICATE_TITLE_SUFFIX = '（副本）';
export const DUPLICATE_TITLE_MAX = 512;

/**
 * Build a sibling-copy title from the source document title.
 * Truncates base so that base + suffix stays within max length.
 */
export function duplicateTitle(
  sourceTitle: string,
  opts?: { suffix?: string; maxLength?: number },
): string {
  const suffix = opts?.suffix ?? DUPLICATE_TITLE_SUFFIX;
  const max = opts?.maxLength ?? DUPLICATE_TITLE_MAX;
  const base = (sourceTitle ?? '').trim() || '无标题文档';
  if (base.length + suffix.length <= max) {
    return `${base}${suffix}`;
  }
  const keep = Math.max(1, max - suffix.length);
  return `${base.slice(0, keep)}${suffix}`;
}
