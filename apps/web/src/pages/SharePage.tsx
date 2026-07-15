import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { shareApi } from '../api/endpoints';
import { ApiError } from '../api/types';
import type { SharedDocument } from '../api/types';
import { StatePanel } from '../components/StatePanel';
import { MarkdownView } from '../ui/markdown';
import { formatUpdatedAt, resolveViewPhase } from '../ui/viewState';

export function SharePage() {
  const { token = '' } = useParams();
  const [doc, setDoc] = useState<SharedDocument | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      setError(null);
      setDoc(null);
      try {
        setDoc(await shareApi.publicGet(token));
      } catch (e) {
        setError(e instanceof ApiError ? e.message : '链接无效或已关闭');
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  const phase = resolveViewPhase({
    loading,
    error,
    isEmpty: !doc,
  });

  return (
    <div className="share-shell">
      {phase === 'loading' && (
        <StatePanel phase="loading" title="正在打开分享" description="校验链接并加载正文…" />
      )}

      {phase === 'error' && (
        <section className="card">
          <StatePanel
            phase="error"
            title="无法打开分享"
            description={error ?? '链接无效或已关闭'}
            action={
              <Link className="btn secondary small" to="/">
                回首页
              </Link>
            }
          />
        </section>
      )}

      {phase === 'ready' && doc && (
        <section className="card share-view" aria-labelledby="share-title">
          <p className="share-kicker">公开只读分享</p>
          <h1 id="share-title">{doc.title}</h1>
          {doc.updatedAt && (
            <p className="muted">更新于 {formatUpdatedAt(doc.updatedAt)}</p>
          )}
          <MarkdownView source={doc.bodyMd} className="md-preview share-md" />
        </section>
      )}
    </div>
  );
}
