/** Per-KB last opened document id (localStorage). */

export const LAST_OPENED_KEY_PREFIX = 'yuque1:last-opened-doc:';

export function lastOpenedStorageKey(kbId: string): string {
  return `${LAST_OPENED_KEY_PREFIX}${kbId}`;
}

export function loadLastOpenedDocId(kbId: string): string | null {
  if (typeof localStorage === 'undefined') return null;
  try {
    const v = localStorage.getItem(lastOpenedStorageKey(kbId));
    return v && v.trim() ? v.trim() : null;
  } catch {
    return null;
  }
}

export function saveLastOpenedDocId(kbId: string, nodeId: string | null): void {
  if (typeof localStorage === 'undefined') return;
  try {
    const key = lastOpenedStorageKey(kbId);
    if (!nodeId) {
      localStorage.removeItem(key);
      return;
    }
    localStorage.setItem(key, nodeId);
  } catch {
    // quota / private mode
  }
}
