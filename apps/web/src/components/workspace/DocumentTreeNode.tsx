import { useDraggable, useDroppable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import {
  ChevronDown,
  ChevronRight,
  FileText,
  Folder,
  FolderOpen,
  GripVertical,
  MoreHorizontal,
} from 'lucide-react';
import type { PublicNode } from '../../api/types';
import type { TreeDropPosition } from '../../ui/treeOps';

export type TreeNodeMenuAction =
  | 'new-doc'
  | 'new-folder'
  | 'rename'
  | 'move'
  | 'up'
  | 'down'
  | 'duplicate'
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
  dropHint?: TreeDropPosition | null;
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
  dropHint,
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

  const {
    attributes,
    listeners,
    setNodeRef: setDragRef,
    transform,
    isDragging,
  } = useDraggable({
    id: node.id,
    disabled: !canWrite || renaming,
    data: { node },
  });

  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id: node.id,
    disabled: !canWrite,
    data: { node },
  });

  function setRowRef(el: HTMLDivElement | null) {
    setDragRef(el);
    setDropRef(el);
  }

  const style = transform
    ? { transform: CSS.Translate.toString(transform) }
    : undefined;

  return (
    <li>
      <div
        ref={setRowRef}
        style={style}
        className={[
          'ws-tree-row',
          selected ? 'is-selected' : '',
          menuOpen ? 'menu-open' : '',
          isDragging ? 'is-dragging' : '',
          isOver && dropHint ? `drop-${dropHint}` : '',
        ]
          .filter(Boolean)
          .join(' ')}
        onContextMenu={onContextMenu}
        data-node-id={node.id}
      >
        {canWrite && !renaming ? (
          <button
            type="button"
            className="ws-tree-grip"
            aria-label={`拖拽 ${node.title}`}
            title="拖拽移动"
            {...listeners}
            {...attributes}
            onClick={(e) => e.stopPropagation()}
          >
            <GripVertical size={14} />
          </button>
        ) : (
          <span className="ws-tree-grip-spacer" aria-hidden />
        )}

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
          {node.type === 'doc' && (
            <button
              type="button"
              role="menuitem"
              disabled={!canWrite}
              onClick={() => onMenuAction('duplicate')}
            >
              复制文档
            </button>
          )}
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
