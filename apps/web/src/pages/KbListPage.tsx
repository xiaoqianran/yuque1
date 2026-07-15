import { FormEvent, useEffect, useState, type MouseEvent } from 'react';
import { Link } from 'react-router-dom';
import { kbApi } from '../api/endpoints';
import { ApiError } from '../api/types';
import type { PublicKb } from '../api/types';
import { useAuth } from '../auth/AuthContext';
import { StatePanel } from '../components/StatePanel';
import { confirmDeleteKbMessage } from '../ui/urls';
import { resolveKbListPresentation, roleLabel } from '../ui/viewState';

export function KbListPage() {
  const { user, logout } = useAuth();
  const [items, setItems] = useState<PublicKb[]>([]);
  const [name, setName] = useState('');
  const [listLoadError, setListLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

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
      await load();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : '删除失败');
    } finally {
      setDeletingId(null);
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
              <div className="kb-item-row">
                <Link to={`/kbs/${kb.id}`} className="kb-item">
                  <strong>{kb.name}</strong>
                  <span className="role-pill">{roleLabel(kb.role)}</span>
                </Link>
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
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
