import type { ContentRevision, ContentRevisionBrief } from '../../api/types';

type Props = {
  open: boolean;
  loading?: boolean;
  items: ContentRevisionBrief[] | null;
  preview: ContentRevision | null;
  onClose: () => void;
  onRefresh: () => void;
  onSelect: (id: string) => void;
  onApply: () => void;
  onClearPreview: () => void;
};

export function HistoryDrawer({
  open,
  loading,
  items,
  preview,
  onClose,
  onRefresh,
  onSelect,
  onApply,
  onClearPreview,
}: Props) {
  if (!open) return null;
  return (
    <div
      className="ws-overlay ws-overlay--drawer"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <aside className="ws-drawer" role="dialog" aria-modal="true" aria-labelledby="ws-history-title">
        <div className="ws-drawer-head">
          <h2 id="ws-history-title">历史快照</h2>
          <div className="row" style={{ gap: 4 }}>
            <button
              type="button"
              className="ws-btn"
              onClick={onRefresh}
              disabled={loading}
            >
              {loading ? '…' : '刷新'}
            </button>
            <button type="button" className="ws-icon-btn" aria-label="关闭" onClick={onClose}>
              ×
            </button>
          </div>
        </div>
        <div className="ws-drawer-body">
          <p className="hint">仅强制覆盖时写入；可预览并填入编辑器后自行保存。</p>
          {!items?.length ? (
            <p className="muted">暂无覆盖快照</p>
          ) : (
            <ul className="ws-history-list">
              {items.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    className={`ws-history-item${preview?.id === item.id ? ' active' : ''}`}
                    onClick={() => onSelect(item.id)}
                  >
                    <span>
                      <strong>v{item.version}</strong>{' '}
                      <span className="muted">
                        {new Date(item.createdAt).toLocaleString()}
                      </span>
                    </span>
                    <span className="muted">
                      {item.createdBy?.nickname ?? '未知'} · {item.reason}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {preview && (
            <div className="ws-history-preview">
              <div className="row" style={{ gap: 8, marginBottom: 8 }}>
                <strong>快照 v{preview.version}</strong>
                <button type="button" className="ws-btn ws-btn--primary" onClick={onApply}>
                  填入编辑器
                </button>
                <button type="button" className="ws-btn" onClick={onClearPreview}>
                  关闭预览
                </button>
              </div>
              <pre>{preview.bodyMd}</pre>
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}
