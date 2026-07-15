import { History, MoreHorizontal, Share2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { PublicNode } from '../../api/types';

export type DocMenuAction =
  | 'import'
  | 'export'
  | 'copy'
  | 'history'
  | 'focus'
  | 'outline'
  | 'delete';

type Props = {
  title: string;
  breadcrumb: PublicNode[];
  canWrite: boolean;
  saveLabel: string;
  saveTone?: 'default' | 'dirty' | 'saving';
  editorMode: 'edit' | 'preview';
  onEditorModeChange: (mode: 'edit' | 'preview') => void;
  onTitleChange: (title: string) => void;
  onTitleCommit: () => void;
  onShare: () => void;
  onMenuAction: (action: DocMenuAction) => void;
  focusMode?: boolean;
};

export function DocumentHeader({
  title,
  breadcrumb,
  canWrite,
  saveLabel,
  saveTone = 'default',
  editorMode,
  onEditorModeChange,
  onTitleChange,
  onTitleCommit,
  onShare,
  onMenuAction,
  focusMode,
}: Props) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPos, setMenuPos] = useState({ x: 0, y: 0 });

  useEffect(() => {
    if (!menuOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setMenuOpen(false);
    }
    function onClick() {
      setMenuOpen(false);
    }
    window.addEventListener('keydown', onKey);
    window.addEventListener('click', onClick);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('click', onClick);
    };
  }, [menuOpen]);

  const path =
    breadcrumb.length > 1
      ? breadcrumb
          .slice(0, -1)
          .map((n) => n.title)
          .join(' / ')
      : '';

  return (
    <header className="ws-doc-header">
      <div className="ws-doc-header-left">
        {path && (
          <div className="ws-breadcrumb" title={path}>
            {path}
          </div>
        )}
        <input
          className="ws-doc-title-input"
          value={title}
          onChange={(e) => onTitleChange(e.target.value)}
          onBlur={() => onTitleCommit()}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              (e.target as HTMLInputElement).blur();
            }
          }}
          readOnly={!canWrite}
          aria-label="文档标题"
        />
      </div>
      <div className="ws-doc-header-right">
        <span
          className={`ws-save-status${
            saveTone === 'dirty'
              ? ' ws-save-status--dirty'
              : saveTone === 'saving'
                ? ' ws-save-status--saving'
                : ''
          }`}
          aria-live="polite"
        >
          {saveLabel}
        </span>
        <div className="ws-seg" role="group" aria-label="编辑模式">
          <button
            type="button"
            aria-pressed={editorMode === 'edit'}
            onClick={() => onEditorModeChange('edit')}
          >
            编辑
          </button>
          <button
            type="button"
            aria-pressed={editorMode === 'preview'}
            onClick={() => onEditorModeChange('preview')}
          >
            预览
          </button>
        </div>
        <button
          type="button"
          className="ws-btn"
          onClick={onShare}
          aria-label="分享"
          title="分享"
        >
          <Share2 size={15} />
          分享
        </button>
        <button
          type="button"
          className="ws-icon-btn"
          aria-label="更多操作"
          title="更多"
          onClick={(e) => {
            e.stopPropagation();
            const r = e.currentTarget.getBoundingClientRect();
            setMenuPos({ x: r.right - 180, y: r.bottom + 4 });
            setMenuOpen((v) => !v);
          }}
        >
          <MoreHorizontal size={18} />
        </button>
        {menuOpen && (
          <div
            className="ws-menu"
            style={{ left: menuPos.x, top: menuPos.y }}
            role="menu"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              role="menuitem"
              disabled={!canWrite}
              onClick={() => {
                setMenuOpen(false);
                onMenuAction('import');
              }}
            >
              导入 Markdown
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setMenuOpen(false);
                onMenuAction('export');
              }}
            >
              导出 Markdown
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setMenuOpen(false);
                onMenuAction('copy');
              }}
            >
              复制 Markdown
            </button>
            <div className="ws-menu-sep" />
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setMenuOpen(false);
                onMenuAction('history');
              }}
            >
              <History size={14} /> 查看历史
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setMenuOpen(false);
                onMenuAction('outline');
              }}
            >
              大纲
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setMenuOpen(false);
                onMenuAction('focus');
              }}
            >
              {focusMode ? '退出专注' : '专注模式'}
            </button>
            <div className="ws-menu-sep" />
            <button
              type="button"
              role="menuitem"
              className="danger"
              disabled={!canWrite}
              onClick={() => {
                setMenuOpen(false);
                onMenuAction('delete');
              }}
            >
              删除文档
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
