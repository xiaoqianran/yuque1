import { FormEvent, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { kbApi } from '../api/endpoints';
import { ApiError } from '../api/types';
import type { PublicKb } from '../api/types';
import { useAuth } from '../auth/AuthContext';

export function KbListPage() {
  const { user, logout } = useAuth();
  const [items, setItems] = useState<PublicKb[]>([]);
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const data = await kbApi.list();
      setItems(data.items);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : '加载失败');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    try {
      await kbApi.create(name.trim());
      setName('');
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '创建失败');
    }
  }

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>我的知识库</h1>
          <p className="muted">
            {user?.nickname} · {user?.mobileE164}
          </p>
        </div>
        <button type="button" className="btn secondary" onClick={() => void logout()}>
          退出
        </button>
      </div>

      <form className="form inline-form" onSubmit={onCreate}>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="新建知识库名称"
          maxLength={128}
        />
        <button type="submit" className="btn primary">
          创建
        </button>
      </form>

      {error && <p className="form-msg">{error}</p>}
      {loading ? (
        <p className="muted">加载中…</p>
      ) : items.length === 0 ? (
        <p className="muted">暂无知识库，先创建一个吧。</p>
      ) : (
        <ul className="kb-list">
          {items.map((kb) => (
            <li key={kb.id}>
              <Link to={`/kbs/${kb.id}`} className="kb-item">
                <strong>{kb.name}</strong>
                <span className="muted">{kb.role}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
