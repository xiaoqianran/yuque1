import { useMemo } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { markdown } from '@codemirror/lang-markdown';
import { EditorView, keymap } from '@codemirror/view';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';

type Props = {
  value: string;
  onChange: (value: string) => void;
  readOnly?: boolean;
  onSave?: () => void;
  className?: string;
  ariaLabel?: string;
};

export function MarkdownEditor({
  value,
  onChange,
  readOnly = false,
  onSave,
  className,
  ariaLabel = '文档正文',
}: Props) {
  const extensions = useMemo(() => {
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
      EditorView.lineWrapping,
      keymap.of([...defaultKeymap, ...historyKeymap]),
      saveKey,
      EditorView.theme({
        '&': { height: '100%' },
        '.cm-scroller': { overflow: 'auto' },
      }),
      EditorView.editable.of(!readOnly),
    ];
  }, [onSave, readOnly]);

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
          highlightSelectionMatches: false,
          bracketMatching: true,
          autocompletion: false,
        }}
        extensions={extensions}
        onChange={onChange}
        editable={!readOnly}
        readOnly={readOnly}
      />
    </div>
  );
}
