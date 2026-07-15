/** Pure helpers for list/detail view presentation states (testable). */

export type ViewPhase = 'loading' | 'empty' | 'error' | 'ready';

export type ViewStateInput = {
  loading: boolean;
  error: string | null | undefined;
  isEmpty: boolean;
};

/**
 * Derive a single presentation phase from loading/error/empty flags.
 * Priority: loading → error → empty → ready.
 */
export function resolveViewPhase(input: ViewStateInput): ViewPhase {
  if (input.loading) return 'loading';
  if (input.error) return 'error';
  if (input.isEmpty) return 'empty';
  return 'ready';
}

export function statePanelClass(phase: ViewPhase): string {
  return `state-panel state-panel--${phase}`;
}

export function roleLabel(role: string): string {
  switch (role) {
    case 'owner':
      return '所有者';
    case 'editor':
      return '可编辑';
    case 'reader':
      return '只读';
    default:
      return role;
  }
}

export function formatUpdatedAt(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString();
}

/** KB list page: list load errors drive phase; action (create) errors stay inline. */
export type KbListPresentationInput = {
  loading: boolean;
  listLoadError: string | null | undefined;
  actionError: string | null | undefined;
  itemCount: number;
};

export type KbListPresentation = {
  /** Phase for list body StatePanel only (ignores actionError). */
  phase: ViewPhase;
  /** Inline form message under create bar; null when none. */
  inlineActionError: string | null;
  /** Full-panel load error copy when phase === 'error'. */
  loadErrorMessage: string | null;
};

/**
 * Compose list UI presentation so create failures never hide an already-loaded list.
 */
export function resolveKbListPresentation(
  input: KbListPresentationInput,
): KbListPresentation {
  const phase = resolveViewPhase({
    loading: input.loading,
    error: input.listLoadError,
    isEmpty: input.itemCount === 0,
  });
  return {
    phase,
    inlineActionError: input.actionError?.trim() ? input.actionError : null,
    loadErrorMessage:
      phase === 'error' ? (input.listLoadError ?? '未知错误') : null,
  };
}
