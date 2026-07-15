import { useEffect } from 'react';
import {
  AUTOSAVE_DEBOUNCE_MS,
  canAutosave,
} from '../ui/autosave';

export function useDocumentAutosave(opts: {
  docLoading: boolean;
  hasDoc: boolean;
  version: number | null;
  body: string;
  lastSavedBody: string | null;
  hasConflict: boolean;
  isSaving: boolean;
  canWrite: boolean;
  save: (opts?: { auto?: boolean }) => Promise<void>;
  selectedId?: string | null;
}) {
  const {
    docLoading,
    hasDoc,
    version,
    body,
    lastSavedBody,
    hasConflict,
    isSaving,
    canWrite,
    save,
    selectedId,
  } = opts;

  useEffect(() => {
    if (docLoading) return;
    const gate = canAutosave({
      hasDoc,
      version,
      body,
      lastSavedBody,
      hasConflict,
      isSaving,
      canWrite,
    });
    if (!gate.allow) return;
    const t = window.setTimeout(() => {
      void save({ auto: true });
    }, AUTOSAVE_DEBOUNCE_MS);
    return () => window.clearTimeout(t);
  }, [
    body,
    version,
    lastSavedBody,
    hasConflict,
    isSaving,
    hasDoc,
    selectedId,
    docLoading,
    canWrite,
    save,
  ]);
}
