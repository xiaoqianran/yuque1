/** Per-KB recent document ids (localStorage). */

export const RECENT_DOCS_MAX = 8;
export const RECENT_DOCS_KEY_PREFIX = 'yuque1:recent-docs:';

export function recentDocsStorageKey(kbId: string): string {
  return `${RECENT_DOCS_KEY_PREFIX}${kbId}`;
}

/**
 * Prepend nodeId and dedupe, keep at most max items.
 * Pure — does not touch storage.
 */
export function pushRecentId(
  existing: string[],
  nodeId: string,
  max: number = RECENT_DOCS_MAX,
): string[] {
  const id = nodeId.trim();
  if (!id || max <= 0) return existing.slice(0, Math.max(0, max));
  const next = [id, ...existing.filter((x) => x !== id)];
  return next.slice(0, max);
}

/** Keep only ids still present in validIdSet (e.g. current tree docs). */
export function filterRecentIds(
  ids: string[],
  validIdSet: ReadonlySet<string>,
): string[] {
  return ids.filter((id) => validIdSet.has(id));
}

export function parseRecentIdsJson(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const v = JSON.parse(raw) as unknown;
    if (!Array.isArray(v)) return [];
    return v.filter((x): x is string => typeof x === 'string' && x.length > 0);
  } catch {
    return [];
  }
}

export function loadRecentDocIds(kbId: string): string[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    return parseRecentIdsJson(localStorage.getItem(recentDocsStorageKey(kbId)));
  } catch {
    return [];
  }
}

export function saveRecentDocIds(kbId: string, ids: string[]): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(recentDocsStorageKey(kbId), JSON.stringify(ids));
  } catch {
    // quota / private mode — ignore
  }
}

export function recordRecentDoc(kbId: string, nodeId: string): string[] {
  const next = pushRecentId(loadRecentDocIds(kbId), nodeId);
  saveRecentDocIds(kbId, next);
  return next;
}
