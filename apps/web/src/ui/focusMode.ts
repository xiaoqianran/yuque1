/** Keyboard helpers for document focus (fullscreen) mode. */

export type KeyLike = {
  key: string;
  metaKey: boolean;
  ctrlKey: boolean;
  shiftKey: boolean;
};

/** Ctrl/Cmd+Shift+F toggles focus mode. */
export function isToggleFocusShortcut(e: KeyLike): boolean {
  if (!(e.metaKey || e.ctrlKey) || !e.shiftKey) return false;
  return e.key === 'f' || e.key === 'F';
}

/** Escape exits focus mode (does not toggle). */
export function isExitFocusKey(e: Pick<KeyLike, 'key'>): boolean {
  return e.key === 'Escape' || e.key === 'Esc';
}
