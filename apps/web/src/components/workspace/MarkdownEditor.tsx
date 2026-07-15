import { useEffect, useMemo, useRef } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import type { EditorView } from '@codemirror/view';
import {
  buildMarkdownEditorExtensions,
  openEditorSearch,
  openEditorSearchWithQuery,
} from '../../ui/editorExtensions';

type Props = {
  value: string;
  onChange: (value: string) => void;
  readOnly?: boolean;
  onSave?: () => void;
  /** Increment to open the search panel (e.g. from 更多 → 查找). */
  findRequestId?: number;
  /** Optional query when opening from sidebar search. */
  findQuery?: string;
  /** When true, wait until false before applying find (doc load). */
  docLoading?: boolean;
  className?: string;
  ariaLabel?: string;
};

export function MarkdownEditor({
  value,
  onChange,
  readOnly = false,
  onSave,
  findRequestId = 0,
  findQuery = '',
  docLoading = false,
  className,
  ariaLabel = '文档正文',
}: Props) {
  const viewRef = useRef<EditorView | null>(null);

  const extensions = useMemo(
    () => buildMarkdownEditorExtensions({ readOnly, onSave }),
    [onSave, readOnly],
  );

  useEffect(() => {
    if (!findRequestId || docLoading) return;
    const view = viewRef.current;
    if (!view) return;
    // Defer until CM has applied latest doc value
    const t = window.setTimeout(() => {
      const v = viewRef.current;
      if (!v) return;
      const q = findQuery.trim();
      if (q) openEditorSearchWithQuery(v, q);
      else {
        v.focus();
        openEditorSearch(v);
      }
    }, 0);
    return () => window.clearTimeout(t);
  }, [findRequestId, findQuery, docLoading, value]);

  return (
    <div className={className ?? 'ws-cm-wrap'} aria-label={ariaLabel}>
      <CodeMirror
        value={value}
        height="100%"
        theme="light"
        basicSetup={{
          lineNumbers: false,
          foldGutter: false,
          highlightActiveLine: true,
          highlightSelectionMatches: true,
          bracketMatching: true,
          autocompletion: false,
          searchKeymap: true,
        }}
        extensions={extensions}
        onChange={onChange}
        editable={!readOnly}
        readOnly={readOnly}
        onCreateEditor={(view) => {
          viewRef.current = view;
        }}
      />
    </div>
  );
}
