import { useEffect, useMemo, useRef } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import type { EditorView } from '@codemirror/view';
import {
  buildMarkdownEditorExtensions,
  openEditorSearch,
} from '../../ui/editorExtensions';

type Props = {
  value: string;
  onChange: (value: string) => void;
  readOnly?: boolean;
  onSave?: () => void;
  /** Increment to open the search panel (e.g. from 更多 → 查找). */
  findRequestId?: number;
  className?: string;
  ariaLabel?: string;
};

export function MarkdownEditor({
  value,
  onChange,
  readOnly = false,
  onSave,
  findRequestId = 0,
  className,
  ariaLabel = '文档正文',
}: Props) {
  const viewRef = useRef<EditorView | null>(null);

  const extensions = useMemo(
    () => buildMarkdownEditorExtensions({ readOnly, onSave }),
    [onSave, readOnly],
  );

  useEffect(() => {
    if (!findRequestId) return;
    const view = viewRef.current;
    if (!view) return;
    view.focus();
    openEditorSearch(view);
  }, [findRequestId]);

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
