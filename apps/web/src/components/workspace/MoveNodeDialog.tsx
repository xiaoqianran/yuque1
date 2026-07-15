import { useEffect, useState } from 'react';
import type { PublicNode } from '../../api/types';
import { buildMoveParentOptions } from '../../ui/treeOps';

type Props = {
  open: boolean;
  node: PublicNode | null;
  nodes: PublicNode[];
  busy?: boolean;
  onClose: () => void;
  onMove: (parentId: string | null) => void;
};

export function MoveNodeDialog({
  open,
  node,
  nodes,
  busy,
  onClose,
  onMove,
}: Props) {
  const [parentId, setParentId] = useState('');

  useEffect(() => {
    if (open && node) {
      setParentId(node.parentId ?? '');
    }
  }, [open, node]);

  if (!open || !node) return null;

  const options = buildMoveParentOptions(nodes, node.id);

  return (
    <div
      className="ws-overlay"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="ws-dialog" role="dialog" aria-modal="true" aria-labelledby="ws-move-title">
        <div className="ws-dialog-head">
          <h2 id="ws-move-title">移动「{node.title}」</h2>
          <button type="button" className="ws-icon-btn" aria-label="关闭" onClick={onClose}>
            ×
          </button>
        </div>
        <div className="ws-dialog-body">
          <div className="ws-field">
            <label htmlFor="ws-move-parent">目标父节点</label>
            <select
              id="ws-move-parent"
              value={parentId}
              onChange={(e) => setParentId(e.target.value)}
            >
              {options.map((o) => (
                <option key={o.value || 'root'} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="ws-dialog-foot">
          <button type="button" className="ws-btn" onClick={onClose}>
            取消
          </button>
          <button
            type="button"
            className="ws-btn ws-btn--primary"
            disabled={busy}
            onClick={() => onMove(parentId === '' ? null : parentId)}
          >
            {busy ? '移动中…' : '移动'}
          </button>
        </div>
      </div>
    </div>
  );
}
