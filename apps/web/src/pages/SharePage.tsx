import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { shareApi } from '../api/endpoints';
import { ApiError } from '../api/types';
import type { SharedDocument } from '../api/types';

export function SharePage() {
  const { token = '' } = useParams();
  const [doc, setDoc] = useState<SharedDocument | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        setDoc(await shareApi.publicGet(token));
      } catch (e) {
        setError(e instanceof ApiError ? e.message : '链接无效或已关闭');
      }
    })();
  }, [token]);

  if (error) {
    return (
      <section className="card">
        <h1>无法打开分享</h1>
        <p className="form-msg">{error}</p>
        <Link to="/">回首页</Link>
      </section>
    );
  }

  if (!doc) {
    return <p className="center muted">加载分享文档…</p>;
  }

  return (
    <section className="card share-view">
      <p className="muted">公开只读分享</p>
      <h1>{doc.title}</h1>
      {doc.updatedAt && (
        <p className="muted">更新于 {new Date(doc.updatedAt).toLocaleString()}</p>
      )}
      <pre className="md-body">{doc.bodyMd || '（空文档）'}</pre>
    </section>
  );
}
