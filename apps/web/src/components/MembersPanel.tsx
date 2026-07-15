import { FormEvent, useCallback, useEffect, useState } from 'react';
import { membersApi } from '../api/endpoints';
import { ApiError } from '../api/types';
import type { KbMember, PublicKb } from '../api/types';
import { roleLabel } from '../ui/viewState';

type Props = {
  kb: PublicKb;
  /** Called after ownership transfer so parent can refresh kb.role */
  onOwnershipTransferred?: () => void;
};

export function MembersPanel({ kb, onOwnershipTransferred }: Props) {
  const [items, setItems] = useState<KbMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mobile, setMobile] = useState('');
  const [role, setRole] = useState<'editor' | 'reader'>('editor');
  const [busy, setBusy] = useState(false);

  const isOwner = kb.role === 'owner';

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await membersApi.list(kb.id);
      setItems(data.items);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : '加载成员失败');
    } finally {
      setLoading(false);
    }
  }, [kb.id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function onAdd(e: FormEvent) {
    e.preventDefault();
    if (!isOwner || busy) return;
    setBusy(true);
    setError(null);
    try {
      await membersApi.add(kb.id, mobile.trim(), role);
      setMobile('');
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '添加失败');
    } finally {
      setBusy(false);
    }
  }

  async function onRoleChange(userId: string, next: 'editor' | 'reader') {
    if (!isOwner) return;
    setError(null);
    try {
      await membersApi.updateRole(kb.id, userId, next);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '变更角色失败');
    }
  }

  async function onRemove(userId: string, nickname: string) {
    if (!isOwner) return;
    if (!window.confirm(`确定移除成员「${nickname}」吗？`)) return;
    setError(null);
    try {
      await membersApi.remove(kb.id, userId);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '移除失败');
    }
  }

  async function onTransfer(userId: string, nickname: string) {
    if (!isOwner) return;
    if (
      !window.confirm(
        `确定将 owner 转让给「${nickname}」吗？\n\n转让后你将成为可编辑成员，对方成为唯一 owner。`,
      )
    ) {
      return;
    }
    setError(null);
    setBusy(true);
    try {
      await membersApi.transferOwner(kb.id, userId);
      await load();
      onOwnershipTransferred?.();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '转让失败');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="members-panel" aria-label="知识库成员">
      <h3 className="members-title">成员</h3>
      {loading && <p className="hint">加载成员…</p>}
      {error && (
        <p className="form-msg form-msg--error" role="alert">
          {error}
        </p>
      )}
      {!loading && (
        <ul className="members-list">
          {items.map((m) => (
            <li key={m.userId} className="members-row">
              <div className="members-info">
                <strong>{m.nickname}</strong>
                <span className="muted members-mobile">{m.mobileE164}</span>
              </div>
              {isOwner && m.role !== 'owner' ? (
                <div className="row">
                  <select
                    className="field-select"
                    value={m.role}
                    aria-label={`${m.nickname} 角色`}
                    onChange={(e) =>
                      void onRoleChange(m.userId, e.target.value as 'editor' | 'reader')
                    }
                  >
                    <option value="editor">可编辑</option>
                    <option value="reader">只读</option>
                  </select>
                  <button
                    type="button"
                    className="btn secondary small"
                    disabled={busy}
                    onClick={() => void onTransfer(m.userId, m.nickname)}
                  >
                    转让 owner
                  </button>
                  <button
                    type="button"
                    className="btn secondary small danger-outline"
                    disabled={busy}
                    onClick={() => void onRemove(m.userId, m.nickname)}
                  >
                    移除
                  </button>
                </div>
              ) : (
                <span className="role-pill">{roleLabel(m.role)}</span>
              )}
            </li>
          ))}
        </ul>
      )}
      {isOwner && (
        <form className="members-add" onSubmit={onAdd}>
          <p className="hint">添加已注册用户（须先短信登录过）</p>
          <input
            value={mobile}
            onChange={(e) => setMobile(e.target.value)}
            placeholder="+8613800138001"
            aria-label="成员手机号"
          />
          <div className="row">
            <select
              className="field-select"
              value={role}
              onChange={(e) => setRole(e.target.value as 'editor' | 'reader')}
              aria-label="新成员角色"
            >
              <option value="editor">可编辑</option>
              <option value="reader">只读</option>
            </select>
            <button type="submit" className="btn primary small" disabled={busy || !mobile.trim()}>
              {busy ? '处理中…' : '添加'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
