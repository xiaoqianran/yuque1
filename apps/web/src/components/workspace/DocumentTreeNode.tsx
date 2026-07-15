import {
  ChevronDown,
  ChevronRight,
  FileText,
  Folder,
  FolderOpen,
  MoreHorizontal,
} from 'lucide-react';
import type { PublicNode } from '../../api/types';

export type TreeNodeMenuAction =
  | 'new-doc'
  | 'new-folder'
  | 'rename'
  | 'move'
  | 'up'
  | 'down'
  | 'delete';

type Props = {
  node: PublicNode;
  depth: number;
  hasKids: boolean;
  collapsed: boolean;
  selected: boolean;
  renaming: boolean;
  renameValue: string;
  menuOpen: boolean;
  canWrite: boolean;
  canUp: boolean;
  canDown: boolean;
  onSelect: () => void;
  onToggleCollapse: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
  onMoreClick: (e: React.MouseEvent) => void;
  onDoubleClickTitle: () => void;
  onRenameChange: (v: string) => void;
  onRenameCommit: () => void;
  onRenameCancel: () => void;
  onMenuAction: (action: TreeNodeMenuAction) => void;
  onCloseMenu: () => void;
  menuPos: { x: number; y: number } | null;
  children?: React.ReactNode;
};

export function DocumentTreeNode({
  node,
  hasKids,
  collapsed,
  selected,
  renaming,
  renameValue,
  menuOpen,
  canWrite,
  canUp,
  canDown,
  onSelect,
  onToggleCollapse,
  onContextMenu,
  onMoreClick,
  onDoubleClickTitle,
  onRenameChange,
  onRenameCommit,
  onRenameCancel,
  onMenuAction,
  onCloseMenu,
  menuPos,
  children,
}: Props) {
  const isFolder = node.type === 'folder';
  const showTwistie = isFolder || hasKids;

  return (
    <li>
      <div
        className={`ws-tree-row${selected ? ' is-selected' : ''}${menuOpen ? ' menu-open' : ''}`}
        onContextMenu={onContextMenu}
      >
        {showTwistie ? (
          <button
            type="button"
            className="ws-tree-twistie"
            aria-label={collapsed ? '展开' : '折叠'}
            aria-expanded={!collapsed}
            onClick={(e) => {
              e.stopPropagation();
              onToggleCollapse();
            }}
          >
            {collapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
          </button>
        ) : (
          <span className="ws-tree-twistie-spacer" aria-hidden />
        )}

        {renaming ? (
          <input
            className="ws-tree-rename"
            value={renameValue}
            autoFocus
            aria-label="重命名"
            onChange={(e) => onRenameChange(e.target.value)}
            onBlur={() => onRenameCommit()}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                onRenameCommit();
              }
              if (e.key === 'Escape') {
                e.preventDefault();
                onRenameCancel();
              }
            }}
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <button
            type="button"
            className="ws-tree-item"
            onClick={onSelect}
            onDoubleClick={(e) => {
              e.preventDefault();
              onDoubleClickTitle();
            }}
            title={node.title}
          >
            <span className="ws-tree-icon" aria-hidden>
              {isFolder ? (
                collapsed || !hasKids ? (
                  <Folder size={15} />
                ) : (
                  <FolderOpen size={15} />
                )
              ) : (
                <FileText size={15} />
              )}
            </span>
            <span className="ws-tree-title">{node.title}</span>
          </button>
        )}

        {canWrite && !renaming && (
          <button
            type="button"
            className="ws-icon-btn ws-tree-more"
            aria-label="节点操作"
            title="更多"
            onClick={onMoreClick}
          >
            <MoreHorizontal size={16} />
          </button>
        )}
      </div>

      {menuOpen && menuPos && (
        <div
          className="ws-menu"
          style={{ left: menuPos.x, top: menuPos.y }}
          role="menu"
        >
          <button
            type="button"
            role="menuitem"
            disabled={!canWrite}
            onClick={() => onMenuAction('new-doc')}
          >
            新建文档
          </button>
          <button
            type="button"
            role="menuitem"
            disabled={!canWrite}
            onClick={() => onMenuAction('new-folder')}
          >
            新建文件夹
          </button>
          <div className="ws-menu-sep" />
          <button
            type="button"
            role="menuitem"
            disabled={!canWrite}
            onClick={() => onMenuAction('rename')}
          >
            重命名
          </button>
          <button
            type="button"
            role="menuitem"
            disabled={!canWrite}
            onClick={() => onMenuAction('move')}
          >
            移动
          </button>
          <button
            type="button"
            role="menuitem"
            disabled={!canWrite || !canUp}
            onClick={() => onMenuAction('up')}
          >
            上移
          </button>
          <button
            type="button"
            role="menuitem"
            disabled={!canWrite || !canDown}
            onClick={() => onMenuAction('down')}
          >
            下移
          </button>
          <div className="ws-menu-sep" />
          <button
            type="button"
            role="menuitem"
            className="danger"
            disabled={!canWrite}
            onClick={() => onMenuAction('delete')}
          >
            删除
          </button>
          <button type="button" role="menuitem" onClick={onCloseMenu}>
            取消
          </button>
        </div>
      )}

      {hasKids && !collapsed && children}
    </li>
  );
}
