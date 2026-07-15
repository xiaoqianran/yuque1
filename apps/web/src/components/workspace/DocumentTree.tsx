import { useEffect, useMemo, useState } from 'react';
import type { PublicNode } from '../../api/types';
import {
  buildChildrenMap,
  siblingReorderAvailability,
} from '../../ui/treeOps';
import {
  DocumentTreeNode,
  type TreeNodeMenuAction,
} from './DocumentTreeNode';

type Props = {
  nodes: PublicNode[];
  selectedId: string | null;
  collapsedIds: ReadonlySet<string>;
  canWrite: boolean;
  onSelect: (n: PublicNode) => void;
  onToggleCollapse: (id: string) => void;
  onCreateUnder: (type: 'folder' | 'doc', contextNode: PublicNode) => void;
  onRename: (node: PublicNode, title: string) => void;
  onMoveRequest: (node: PublicNode) => void;
  onReorder: (node: PublicNode, direction: 'up' | 'down') => void;
  onDeleteRequest: (node: PublicNode) => void;
  renameNodeId?: string | null;
  onRenameNodeIdChange?: (id: string | null) => void;
};

export function DocumentTree({
  nodes,
  selectedId,
  collapsedIds,
  canWrite,
  onSelect,
  onToggleCollapse,
  onCreateUnder,
  onRename,
  onMoveRequest,
  onReorder,
  onDeleteRequest,
  renameNodeId: controlledRenameId,
  onRenameNodeIdChange,
}: Props) {
  const childMap = useMemo(() => buildChildrenMap(nodes), [nodes]);
  const [menuNodeId, setMenuNodeId] = useState<string | null>(null);
  const [menuPos, setMenuPos] = useState<{ x: number; y: number } | null>(null);
  const [internalRenameId, setInternalRenameId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');

  const renameNodeId = controlledRenameId ?? internalRenameId;
  const setRenameNodeId = (id: string | null) => {
    onRenameNodeIdChange?.(id);
    if (controlledRenameId === undefined) setInternalRenameId(id);
  };

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setMenuNodeId(null);
        setMenuPos(null);
        if (renameNodeId) setRenameNodeId(null);
      }
    }
    function onClick() {
      setMenuNodeId(null);
      setMenuPos(null);
    }
    window.addEventListener('keydown', onKey);
    window.addEventListener('click', onClick);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('click', onClick);
    };
  }, [renameNodeId]);

  function openMenu(node: PublicNode, x: number, y: number) {
    setMenuNodeId(node.id);
    setMenuPos({ x, y });
  }

  function startRename(node: PublicNode) {
    setRenameNodeId(node.id);
    setRenameValue(node.title);
    setMenuNodeId(null);
  }

  function commitRename(node: PublicNode) {
    const title = renameValue.trim();
    setRenameNodeId(null);
    if (!title || title === node.title) return;
    onRename(node, title);
  }

  function handleMenuAction(node: PublicNode, action: TreeNodeMenuAction) {
    setMenuNodeId(null);
    setMenuPos(null);
    switch (action) {
      case 'new-doc':
        onCreateUnder('doc', node);
        break;
      case 'new-folder':
        onCreateUnder('folder', node);
        break;
      case 'rename':
        startRename(node);
        break;
      case 'move':
        onMoveRequest(node);
        break;
      case 'up':
        onReorder(node, 'up');
        break;
      case 'down':
        onReorder(node, 'down');
        break;
      case 'delete':
        onDeleteRequest(node);
        break;
    }
  }

  function renderLevel(parentId: string | null, depth: number) {
    const children = childMap.get(parentId) ?? [];
    if (!children.length) return null;
    return (
      <ul className="ws-tree">
        {children.map((n) => {
          const kids = childMap.get(n.id) ?? [];
          const hasKids = kids.length > 0;
          const collapsed = collapsedIds.has(n.id);
          const avail = siblingReorderAvailability(nodes, n.id);
          return (
            <DocumentTreeNode
              key={n.id}
              node={n}
              depth={depth}
              hasKids={hasKids}
              collapsed={collapsed}
              selected={selectedId === n.id}
              renaming={renameNodeId === n.id}
              renameValue={renameValue}
              menuOpen={menuNodeId === n.id}
              menuPos={menuNodeId === n.id ? menuPos : null}
              canWrite={canWrite}
              canUp={avail.canUp}
              canDown={avail.canDown}
              onSelect={() => {
                onSelect(n);
                if (n.type === 'folder' && hasKids) {
                  // single click opens folder expand if collapsed
                  if (collapsed) onToggleCollapse(n.id);
                }
              }}
              onToggleCollapse={() => onToggleCollapse(n.id)}
              onContextMenu={(e) => {
                e.preventDefault();
                e.stopPropagation();
                openMenu(n, e.clientX, e.clientY);
              }}
              onMoreClick={(e) => {
                e.stopPropagation();
                const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                openMenu(n, rect.left, rect.bottom + 2);
              }}
              onDoubleClickTitle={() => {
                if (canWrite) startRename(n);
              }}
              onRenameChange={setRenameValue}
              onRenameCommit={() => commitRename(n)}
              onRenameCancel={() => setRenameNodeId(null)}
              onMenuAction={(a) => handleMenuAction(n, a)}
              onCloseMenu={() => {
                setMenuNodeId(null);
                setMenuPos(null);
              }}
            >
              {hasKids && !collapsed ? renderLevel(n.id, depth + 1) : null}
            </DocumentTreeNode>
          );
        })}
      </ul>
    );
  }

  if (nodes.length === 0) {
    return null;
  }

  return renderLevel(null, 0);
}
