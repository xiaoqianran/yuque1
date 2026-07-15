import { FormEvent, useEffect, useState, type MouseEvent } from 'react';
import { Link } from 'react-router-dom';
import { kbApi } from '../api/endpoints';
import { ApiError } from '../api/types';
import type { PublicKb } from '../api/types';
import { useAuth } from '../auth/AuthContext';
import { StatePanel } from '../components/StatePanel';
import { normalizeKbName } from '../ui/treeOps';
import { confirmDeleteKbMessage } from '../ui/urls';
import { resolveKbListPresentation, roleLabel } from '../ui/viewState';

function canWriteKb(role: PublicKb['role']): boolean {
  return role === 'owner' || role === 'editor';
}

export function KbListPage() {
  const { user, logout } = useAuth();
  const [items, setItems] = useState<PublicKb[]>([]);
  const [name, setName] = useState('');
  const [listLoadError, setListLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState('');
  const [renamingBusy, setRenamingBusy] = useState(false);

  async function load() {
    setLoading(true);
    setListLoadError(null);
    try {
      const data = await kbApi.list();
      setItems(data.items);
    } catch (e) {
      setListLoadError(e instanceof ApiError ? e.message : '加载失败');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    if (!name.trim() || creating) return;
    setCreating(true);
    setActionError(null);
    try {
      await kbApi.create(name.trim());
      setName('');
      await load();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : '创建失败');
    } finally {
      setCreating(false);
    }
  }

  async function onDeleteKb(kb: PublicKb, e: MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!window.confirm(confirmDeleteKbMessage(kb.name))) return;
    setDeletingId(kb.id);
    setActionError(null);
    try {
      await kbApi.remove(kb.id);
      if (renamingId === kb.id) {
        setRenamingId(null);
        setRenameDraft('');
      }
      await load();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : '删除失败');
    } finally {
      setDeletingId(null);
    }
  }

  function startRename(kb: PublicKb, e: MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setRenamingId(kb.id);
    setRenameDraft(kb.name);
    setActionError(null);
  }

  function cancelRename(e?: MouseEvent) {
    e?.preventDefault();
    e?.stopPropagation();
    setRenamingId(null);
    setRenameDraft('');
  }

  async function submitRename(kb: PublicKb, e: FormEvent | MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    const parsed = normalizeKbName(renameDraft);
    if (!parsed.ok) {
      setActionError(parsed.message);
      return;
    }
    setRenamingBusy(true);
    setActionError(null);
    try {
      await kbApi.update(kb.id, { name: parsed.name });
      setRenamingId(null);
      setRenameDraft('');
      await load();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : '重命名失败');
    } finally {
      setRenamingBusy(false);
    }
  }

  const { phase, inlineActionError, loadErrorMessage } = resolveKbListPresentation({
    loading,
    listLoadError,
    actionError,
    itemCount: items.length,
  });

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>我的知识库</h1>
          <p className="muted">
            {user?.nickname}
            {user?.mobileE164 ? ` · ${user.mobileE164}` : ''}
          </p>
        </div>
        <button type="button" className="btn secondary" onClick={() => void logout()}>
          退出登录
        </button>
      </div>

      <div className="create-bar">
        <form className="form inline-form" onSubmit={onCreate}>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="输入名称，创建知识库"
            maxLength={128}
            aria-label="知识库名称"
          />
          <button type="submit" className="btn primary" disabled={creating || !name.trim()}>
            {creating ? '创建中…' : '创建'}
          </button>
        </form>
        {inlineActionError && (
          <p className="form-msg form-msg--error" role="alert">
            {inlineActionError}
          </p>
        )}
      </div>

      {phase === 'loading' && (
        <StatePanel phase="loading" title="正在加载知识库" description="从服务器拉取列表…" />
      )}

      {phase === 'error' && (
        <StatePanel
          phase="error"
          title="无法加载知识库"
          description={loadErrorMessage ?? '未知错误'}
          action={
            <button type="button" className="btn secondary small" onClick={() => void load()}>
              重试
            </button>
          }
        />
      )}

      {phase === 'empty' && (
        <StatePanel
          phase="empty"
          title="还没有知识库"
          description="在上方输入名称并点击「创建」，即可开始写文档。"
        />
      )}

      {phase === 'ready' && (
        <ul className="kb-list">
          {items.map((kb) => (
            <li key={kb.id}>
              {renamingId === kb.id ? (
                <form
                  className="kb-item-row kb-rename-row"
                  onSubmit={(ev) => void submitRename(kb, ev)}
                >
                  <input
                    value={renameDraft}
                    onChange={(e) => setRenameDraft(e.target.value)}
                    maxLength={128}
                    aria-label="新知识库名称"
                    autoFocus
                  />
                  <button type="submit" className="btn primary small" disabled={renamingBusy}>
                    {renamingBusy ? '保存中…' : '保存'}
                  </button>
                  <button
                    type="button"
                    className="btn secondary small"
                    disabled={renamingBusy}
                    onClick={(ev) => cancelRename(ev)}
                  >
                    取消
                  </button>
                </form>
              ) : (
                <div className="kb-item-row">
                  <Link to={`/kbs/${kb.id}`} className="kb-item">
                    <strong>{kb.name}</strong>
                    <span className="role-pill">{roleLabel(kb.role)}</span>
                  </Link>
                  {canWriteKb(kb.role) && (
                    <button
                      type="button"
                      className="btn secondary small"
                      onClick={(ev) => startRename(kb, ev)}
                      aria-label={`重命名知识库 ${kb.name}`}
                    >
                      重命名
                    </button>
                  )}
                  {kb.role === 'owner' && (
                    <button
                      type="button"
                      className="btn secondary small danger-outline"
                      disabled={deletingId === kb.id}
                      onClick={(ev) => void onDeleteKb(kb, ev)}
                      aria-label={`删除知识库 ${kb.name}`}
                    >
                      {deletingId === kb.id ? '删除中…' : '删除'}
                    </button>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
