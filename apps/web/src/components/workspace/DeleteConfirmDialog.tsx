type Props = {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export function DeleteConfirmDialog({
  open,
  title,
  message,
  confirmLabel = '删除',
  busy,
  onConfirm,
  onCancel,
}: Props) {
  if (!open) return null;
  return (
    <div
      className="ws-overlay"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div
        className="ws-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="ws-delete-title"
        aria-describedby="ws-delete-desc"
      >
        <div className="ws-dialog-head">
          <h2 id="ws-delete-title">{title}</h2>
          <button
            type="button"
            className="ws-icon-btn"
            aria-label="关闭"
            onClick={onCancel}
          >
            ×
          </button>
        </div>
        <div className="ws-dialog-body">
          <p id="ws-delete-desc" style={{ margin: 0, whiteSpace: 'pre-wrap' }}>
            {message}
          </p>
        </div>
        <div className="ws-dialog-foot">
          <button type="button" className="ws-btn" onClick={onCancel} disabled={busy}>
            取消
          </button>
          <button
            type="button"
            className="ws-btn ws-btn--danger"
            onClick={onConfirm}
            disabled={busy}
          >
            {busy ? '处理中…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
