/** Autosave policy helpers (debounce delay + when to skip). */

export const AUTOSAVE_DEBOUNCE_MS = 1500;

export type AutosaveSkipReason =
  | 'conflict'
  | 'clean'
  | 'no_version'
  | 'saving'
  | 'no_doc'
  | 'readonly';

export type AutosaveGate =
  | { allow: true }
  | { allow: false; reason: AutosaveSkipReason };

/**
 * Whether an autosave attempt should proceed (after debounce fires).
 * Conflict freezes autosave until user decides (PRD).
 */
export function canAutosave(opts: {
  hasDoc: boolean;
  version: number | null;
  body: string;
  lastSavedBody: string | null;
  hasConflict: boolean;
  isSaving: boolean;
  canWrite?: boolean;
}): AutosaveGate {
  if (!opts.hasDoc) return { allow: false, reason: 'no_doc' };
  if (opts.canWrite === false) return { allow: false, reason: 'readonly' };
  if (opts.hasConflict) return { allow: false, reason: 'conflict' };
  if (opts.isSaving) return { allow: false, reason: 'saving' };
  if (opts.version == null) return { allow: false, reason: 'no_version' };
  if (opts.lastSavedBody !== null && opts.body === opts.lastSavedBody) {
    return { allow: false, reason: 'clean' };
  }
  return { allow: true };
}

export function isDirty(body: string, lastSavedBody: string | null): boolean {
  if (lastSavedBody === null) return false;
  return body !== lastSavedBody;
}

export function autosaveStatusLabel(opts: {
  isSaving: boolean;
  isDirty: boolean;
  lastAuto: boolean;
  version: number | null;
}): string | null {
  if (opts.isSaving) return '自动保存中…';
  if (opts.isDirty) return '未保存';
  if (opts.lastAuto && opts.version != null) {
    return `已自动保存 v${opts.version}`;
  }
  return null;
}
