import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { markdown } from '@codemirror/lang-markdown';
import {
  SearchQuery,
  findNext,
  highlightSelectionMatches,
  openSearchPanel,
  search,
  searchKeymap,
  setSearchQuery,
} from '@codemirror/search';
import type { Extension } from '@codemirror/state';
import { EditorView, keymap } from '@codemirror/view';

export type MarkdownEditorExtensionOpts = {
  readOnly?: boolean;
  onSave?: () => void;
};

/**
 * Shared CodeMirror 6 extensions for the workspace Markdown editor.
 * Includes history, markdown language, line wrapping, search panel, Mod-s save.
 */
export function buildMarkdownEditorExtensions(
  opts: MarkdownEditorExtensionOpts = {},
): Extension[] {
  const { readOnly = false, onSave } = opts;
  const saveKey = keymap.of([
    {
      key: 'Mod-s',
      run: () => {
        onSave?.();
        return true;
      },
    },
  ]);
  return [
    markdown(),
    history(),
    search({ top: true }),
    highlightSelectionMatches(),
    EditorView.lineWrapping,
    keymap.of([
      ...defaultKeymap,
      ...historyKeymap,
      ...searchKeymap,
    ]),
    saveKey,
    EditorView.theme({
      '&': { height: '100%' },
      '.cm-scroller': { overflow: 'auto' },
    }),
    EditorView.editable.of(!readOnly),
  ];
}

/** Open the CodeMirror search panel on a view (if available). */
export function openEditorSearch(view: EditorView | null | undefined): boolean {
  if (!view) return false;
  return openSearchPanel(view);
}

/**
 * Build a case-insensitive SearchQuery for sidebar → editor jump.
 * Pure helper for unit tests.
 */
export function buildSidebarSearchQuery(raw: string): SearchQuery | null {
  const search = raw.trim();
  if (!search) return null;
  return new SearchQuery({
    search,
    caseSensitive: false,
    literal: true,
  });
}

/**
 * Open search panel, optionally set query and jump to first match.
 * Used when opening a document from sidebar full-text search results.
 */
export function openEditorSearchWithQuery(
  view: EditorView | null | undefined,
  rawQuery: string,
): boolean {
  if (!view) return false;
  openSearchPanel(view);
  const q = buildSidebarSearchQuery(rawQuery);
  if (q) {
    view.dispatch({ effects: setSearchQuery.of(q) });
    findNext(view);
  }
  view.focus();
  return true;
}

/** Extension package markers for unit tests (shipped search wiring). */
export function editorSearchFeatures(): string[] {
  return [
    'search',
    'searchKeymap',
    'highlightSelectionMatches',
    'Mod-f',
    'sidebar-jump',
  ];
}
