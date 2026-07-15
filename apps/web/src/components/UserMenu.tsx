import { useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { ApiError } from '../api/types';

export function UserMenu() {
  const { user, logout, updateNickname } = useAuth();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  if (!user) return null;

  function startEdit() {
    setDraft(user!.nickname);
    setEditing(true);
    setError(null);
    setStatus(null);
  }

  async function save() {
    setSaving(true);
    setError(null);
    setStatus(null);
    try {
      await updateNickname(draft);
      setEditing(false);
      setStatus('昵称已更新');
    } catch (e) {
      setError(e instanceof ApiError ? e.message : '更新失败');
    } finally {
      setSaving(false);
    }
  }

  async function onLogout() {
    setOpen(false);
    await logout();
  }

  return (
    <div className="user-menu">
      <button
        type="button"
        className="user-menu-trigger"
        aria-expanded={open}
        aria-haspopup="true"
        title={user.mobileE164}
        onClick={() => {
          setOpen((v) => !v);
          setError(null);
          setStatus(null);
        }}
      >
        <span className="header-user">{user.nickname}</span>
        <span className="user-menu-caret" aria-hidden>
          ▾
        </span>
      </button>
      {open && (
        <div className="user-menu-panel" role="menu">
          <p className="user-menu-meta muted">{user.mobileE164}</p>
          {editing ? (
            <div className="user-menu-edit">
              <label className="field-label">
                昵称
                <input
                  value={draft}
                  maxLength={64}
                  onChange={(e) => setDraft(e.target.value)}
                  aria-label="新昵称"
                  autoFocus
                />
              </label>
              <div className="row">
                <button
                  type="button"
                  className="btn primary small"
                  disabled={saving}
                  onClick={() => void save()}
                >
                  {saving ? '保存中…' : '保存'}
                </button>
                <button
                  type="button"
                  className="btn secondary small"
                  disabled={saving}
                  onClick={() => setEditing(false)}
                >
                  取消
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              className="btn secondary small"
              role="menuitem"
              onClick={() => startEdit()}
            >
              修改昵称
            </button>
          )}
          {error && (
            <p className="hint warn" role="alert">
              {error}
            </p>
          )}
          {status && <p className="hint">{status}</p>}
          <button
            type="button"
            className="btn secondary small danger-outline"
            role="menuitem"
            onClick={() => void onLogout()}
          >
            退出登录
          </button>
        </div>
      )}
    </div>
  );
}
