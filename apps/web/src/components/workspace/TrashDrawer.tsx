import { FileText, Folder } from 'lucide-react';
import type { PublicNode } from '../../api/types';

type Props = {
  open: boolean;
  items: PublicNode[];
  loading?: boolean;
  canWrite: boolean;
  restoringId: string | null;
  purgingId?: string | null;
  emptying?: boolean;
  onClose: () => void;
  onRestore: (nodeId: string, title: string) => void;
  onPurgeRequest?: (node: PublicNode) => void;
  onEmptyRequest?: () => void;
};

export function TrashDrawer({
  open,
  items,
  loading,
  canWrite,
  restoringId,
  purgingId,
  emptying,
  onClose,
  onRestore,
  onPurgeRequest,
  onEmptyRequest,
}: Props) {
  if (!open) return null;
  const busy = Boolean(restoringId || purgingId || emptying);
  return (
    <div
      className="ws-overlay ws-overlay--drawer"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <aside className="ws-drawer" role="dialog" aria-modal="true" aria-labelledby="ws-trash-title">
        <div className="ws-drawer-head">
          <h2 id="ws-trash-title">回收站</h2>
          <div className="row" style={{ gap: 6 }}>
            {canWrite && items.length > 0 && onEmptyRequest && (
              <button
                type="button"
                className="ws-btn ws-btn--danger"
                disabled={busy}
                onClick={onEmptyRequest}
              >
                {emptying ? '清空中…' : '清空回收站'}
              </button>
            )}
            <button type="button" className="ws-icon-btn" aria-label="关闭" onClick={onClose}>
              ×
            </button>
          </div>
        </div>
        <div className="ws-drawer-body">
          <p className="hint">
            已删除的节点可恢复到原位置；永久删除与清空不可撤销。
          </p>
          {loading ? (
            <p className="hint">加载中…</p>
          ) : items.length === 0 ? (
            <p className="hint">暂无已删除节点</p>
          ) : (
            <ul className="ws-trash-list">
              {items.map((n) => (
                <li key={n.id} className="ws-trash-item">
                  <div
                    className="row"
                    style={{
                      gap: 6,
                      minWidth: 0,
                      flex: 1,
                      flexDirection: 'column',
                      alignItems: 'flex-start',
                    }}
                  >
                    <div className="row" style={{ gap: 6, minWidth: 0, width: '100%' }}>
                      {n.type === 'folder' ? (
                        <Folder size={14} aria-hidden />
                      ) : (
                        <FileText size={14} aria-hidden />
                      )}
                      <span className="ws-trash-title" title={n.title}>
                        {n.title}
                      </span>
                    </div>
                    {n.deletedAt && (
                      <span className="muted" style={{ fontSize: 12 }}>
                        删除于 {new Date(n.deletedAt).toLocaleString()}
                      </span>
                    )}
                  </div>
                  {canWrite && (
                    <div className="row" style={{ gap: 6, flexShrink: 0 }}>
                      <button
                        type="button"
                        className="ws-btn"
                        disabled={busy}
                        onClick={() => onRestore(n.id, n.title)}
                      >
                        {restoringId === n.id ? '…' : '恢复'}
                      </button>
                      {onPurgeRequest && (
                        <button
                          type="button"
                          className="ws-btn ws-btn--danger"
                          disabled={busy}
                          onClick={() => onPurgeRequest(n)}
                        >
                          {purgingId === n.id ? '…' : '永久删除'}
                        </button>
                      )}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </aside>
    </div>
  );
}
