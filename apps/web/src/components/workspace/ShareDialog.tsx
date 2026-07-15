import { useState } from 'react';
import type { ShareInfo } from '../../api/types';
import {
  formatShareExpiry,
  isShareExpired,
  SHARE_EXPIRY_OPTIONS,
  type ShareExpiryPreset,
} from '../../ui/shareExpiry';
import { buildPublicShareUrl } from '../../ui/urls';
import { Link } from 'react-router-dom';

type Props = {
  open: boolean;
  share: ShareInfo | null;
  canWrite: boolean;
  busy?: boolean;
  onClose: () => void;
  onEnable: (preset: ShareExpiryPreset) => Promise<void>;
  onDisable: () => Promise<void>;
  onUpdateExpiry: (preset: ShareExpiryPreset) => Promise<void>;
};

export function ShareDialog({
  open,
  share,
  canWrite,
  busy,
  onClose,
  onEnable,
  onDisable,
  onUpdateExpiry,
}: Props) {
  const [preset, setPreset] = useState<ShareExpiryPreset>('never');
  const [copyHint, setCopyHint] = useState<string | null>(null);

  if (!open) return null;

  const publicUrl =
    share?.enabled && share.token ? buildPublicShareUrl(share.token) : null;

  async function copy() {
    if (!share?.token) return;
    const url = buildPublicShareUrl(share.token);
    try {
      await navigator.clipboard.writeText(url);
      setCopyHint('已复制到剪贴板');
    } catch {
      setCopyHint('请手动复制下方链接');
    }
  }

  return (
    <div
      className="ws-overlay"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="ws-dialog" role="dialog" aria-modal="true" aria-labelledby="ws-share-title">
        <div className="ws-dialog-head">
          <h2 id="ws-share-title">分享文档</h2>
          <button type="button" className="ws-icon-btn" aria-label="关闭" onClick={onClose}>
            ×
          </button>
        </div>
        <div className="ws-dialog-body">
          <div className="ws-field">
            <label htmlFor="ws-share-expiry">有效期</label>
            <select
              id="ws-share-expiry"
              value={preset}
              onChange={(e) => setPreset(e.target.value as ShareExpiryPreset)}
              disabled={!canWrite}
            >
              {SHARE_EXPIRY_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>

          {share?.enabled ? (
            <>
              <p className="hint">
                状态：已开启
                {isShareExpired(share.expiresAt) ? (
                  <span className="badge badge-warn" style={{ marginLeft: 8 }}>
                    已过期
                  </span>
                ) : (
                  <span className="muted" style={{ marginLeft: 8 }}>
                    {formatShareExpiry(share.expiresAt)}
                  </span>
                )}
              </p>
              {publicUrl && (
                <>
                  <div className="ws-share-url">{publicUrl}</div>
                  <div className="row" style={{ marginTop: 8, gap: 8 }}>
                    <button type="button" className="ws-btn" onClick={() => void copy()}>
                      复制链接
                    </button>
                    {share.token && (
                      <Link className="ws-btn" to={`/s/${share.token}`} target="_blank">
                        预览
                      </Link>
                    )}
                  </div>
                  {copyHint && <p className="hint">{copyHint}</p>}
                </>
              )}
            </>
          ) : (
            <p className="hint">分享关闭后，公开链接将不可访问。</p>
          )}
        </div>
        <div className="ws-dialog-foot">
          <button type="button" className="ws-btn" onClick={onClose}>
            关闭
          </button>
          {canWrite && share?.enabled && (
            <button
              type="button"
              className="ws-btn"
              disabled={busy}
              onClick={() => void onUpdateExpiry(preset)}
            >
              更新有效期
            </button>
          )}
          {canWrite && (
            <button
              type="button"
              className="ws-btn ws-btn--primary"
              disabled={busy}
              onClick={() =>
                void (share?.enabled ? onDisable() : onEnable(preset))
              }
            >
              {share?.enabled ? '关闭分享' : '开启分享'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
