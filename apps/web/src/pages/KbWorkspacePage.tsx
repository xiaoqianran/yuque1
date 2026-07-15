import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { contentApi, kbApi, shareApi, treeApi } from '../api/endpoints';
import { ApiError } from '../api/types';
import type { PublicKb, PublicNode, ShareInfo } from '../api/types';
import { StatePanel } from '../components/StatePanel';
import { buildPublicShareUrl, confirmDeleteNodeMessage } from '../ui/urls';
import { resolveViewPhase } from '../ui/viewState';

function buildChildrenMap(nodes: PublicNode[]): Map<string | null, PublicNode[]> {
  const map = new Map<string | null, PublicNode[]>();
  for (const n of nodes) {
    const key = n.parentId;
    const list = map.get(key) ?? [];
    list.push(n);
    map.set(key, list);
  }
  for (const list of map.values()) {
    list.sort((a, b) => a.sortOrder - b.sortOrder || a.title.localeCompare(b.title));
  }
  return map;
}

function TreeNodes({
  parentId,
  map,
  depth,
  selectedId,
  onSelect,
}: {
  parentId: string | null;
  map: Map<string | null, PublicNode[]>;
  depth: number;
  selectedId: string | null;
  onSelect: (n: PublicNode) => void;
}) {
  const children = map.get(parentId) ?? [];
  return (
    <ul className="tree" style={{ paddingLeft: depth === 0 ? 0 : 12 }}>
      {children.map((n) => (
        <li key={n.id}>
          <button
            type="button"
            className={`tree-item ${selectedId === n.id ? 'active' : ''}`}
            onClick={() => onSelect(n)}
          >
            <span
              className={`tree-type ${n.type === 'folder' ? 'tree-type--folder' : 'tree-type--doc'}`}
              aria-hidden
            >
              {n.type === 'folder' ? 'F' : 'D'}
            </span>
            <span>{n.title}</span>
          </button>
          <TreeNodes
            parentId={n.id}
            map={map}
            depth={depth + 1}
            selectedId={selectedId}
            onSelect={onSelect}
          />
        </li>
      ))}
    </ul>
  );
}

export function KbWorkspacePage() {
  const { kbId = '' } = useParams();
  const [kb, setKb] = useState<PublicKb | null>(null);
  const [nodes, setNodes] = useState<PublicNode[]>([]);
  const [selected, setSelected] = useState<PublicNode | null>(null);
  const [body, setBody] = useState('');
  const [version, setVersion] = useState<number | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [conflict, setConflict] = useState<{ serverVersion: number } | null>(null);
  const [share, setShare] = useState<ShareInfo | null>(null);
  const [newTitle, setNewTitle] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [docLoading, setDocLoading] = useState(false);
  const [copyHint, setCopyHint] = useState<string | null>(null);

  const childMap = useMemo(() => buildChildrenMap(nodes), [nodes]);

  const refreshTree = useCallback(async () => {
    const data = await treeApi.list(kbId);
    setNodes(data.items);
  }, [kbId]);

  const loadWorkspace = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [k, t] = await Promise.all([kbApi.get(kbId), treeApi.list(kbId)]);
      setKb(k);
      setNodes(t.items);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : '加载知识库失败');
    } finally {
      setLoading(false);
    }
  }, [kbId]);

  useEffect(() => {
    void loadWorkspace();
  }, [loadWorkspace]);

  async function openNode(n: PublicNode) {
    setSelected(n);
    setConflict(null);
    setShare(null);
    setStatus(null);
    if (n.type !== 'doc') {
      setBody('');
      setVersion(null);
      return;
    }
    setDocLoading(true);
    try {
      const c = await contentApi.get(n.id);
      setBody(c.bodyMd);
      setVersion(c.version);
      const s = await shareApi.get(n.id);
      setShare(s);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : '打开文档失败');
    } finally {
      setDocLoading(false);
    }
  }

  async function createNode(type: 'folder' | 'doc') {
    const title = newTitle.trim() || (type === 'folder' ? '新建文件夹' : '无标题文档');
    try {
      const node = await treeApi.create(kbId, {
        type,
        title,
        parentId: selected ? selected.id : null,
      });
      setNewTitle('');
      await refreshTree();
      if (type === 'doc') await openNode(node);
      else setSelected(node);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : '创建失败');
    }
  }

  async function save() {
    if (!selected || selected.type !== 'doc' || version == null) return;
    setStatus('保存中…');
    setConflict(null);
    try {
      const meta = await contentApi.put(selected.id, version, body);
      setVersion(meta.version);
      setStatus(`已保存 v${meta.version}`);
    } catch (e) {
      if (e instanceof ApiError && e.code === 'DOC_VERSION_CONFLICT') {
        const serverVersion = Number(
          (e.details as { serverVersion?: number } | null)?.serverVersion ?? 0,
        );
        setConflict({ serverVersion });
        setStatus('版本冲突：请选择处理方式');
      } else {
        setStatus(e instanceof ApiError ? e.message : '保存失败');
      }
    }
  }

  async function reloadServer() {
    if (!selected || selected.type !== 'doc') return;
    const c = await contentApi.get(selected.id);
    setBody(c.bodyMd);
    setVersion(c.version);
    setConflict(null);
    setStatus(`已加载服务器 v${c.version}`);
  }

  async function overwrite() {
    if (!selected || !conflict) return;
    const meta = await contentApi.overwrite(selected.id, conflict.serverVersion, body);
    setVersion(meta.version);
    setConflict(null);
    setStatus(`已覆盖保存 v${meta.version}`);
  }

  async function saveAsCopy() {
    if (!selected) return;
    const r = await contentApi.saveAs(selected.id, body);
    setConflict(null);
    await refreshTree();
    await openNode(r.node);
    setStatus('已另存为新文档');
  }

  async function toggleShare() {
    if (!selected || selected.type !== 'doc') return;
    try {
      if (share?.enabled) {
        await shareApi.disable(selected.id);
        setShare({ enabled: false, token: null, urlPath: null, expiresAt: null });
        setCopyHint(null);
        setStatus('已关闭分享');
      } else {
        const s = await shareApi.enable(selected.id);
        setShare(s);
        setStatus('已开启分享');
      }
    } catch (e) {
      setStatus(e instanceof ApiError ? e.message : '分享操作失败');
    }
  }

  async function deleteSelected() {
    if (!selected) return;
    if (!window.confirm(confirmDeleteNodeMessage(selected.title, selected.type))) {
      return;
    }
    try {
      await treeApi.remove(selected.id);
      setSelected(null);
      setBody('');
      setVersion(null);
      setShare(null);
      setStatus(`已删除「${selected.title}」`);
      await refreshTree();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : '删除失败');
    }
  }

  async function copyShareUrl() {
    if (!share?.token) return;
    const url = buildPublicShareUrl(share.token);
    try {
      await navigator.clipboard.writeText(url);
      setCopyHint('已复制到剪贴板');
    } catch {
      // fallback: select-friendly
      setCopyHint('请手动复制下方链接');
    }
  }

  const publicShareUrl =
    share?.enabled && share.token ? buildPublicShareUrl(share.token) : null;

  const loadPhase = resolveViewPhase({
    loading,
    error: loading ? null : error && !kb ? error : null,
    isEmpty: false,
  });

  if (loadPhase === 'loading') {
    return (
      <div className="editor-placeholder">
        <StatePanel phase="loading" title="正在打开知识库" description="加载元数据与文档树…" />
      </div>
    );
  }

  if (!kb) {
    return (
      <div className="editor-placeholder">
        <StatePanel
          phase="error"
          title="无法打开知识库"
          description={error ?? '资源不存在或无权限'}
          action={
            <div className="row">
              <Link className="btn secondary small" to="/">
                返回列表
              </Link>
              <button type="button" className="btn primary small" onClick={() => void loadWorkspace()}>
                重试
              </button>
            </div>
          }
        />
      </div>
    );
  }

  return (
    <div className="workspace">
      <aside className="sidebar" aria-label="文档树">
        <div className="sidebar-head">
          <Link to="/" className="back">
            ← 全部知识库
          </Link>
          <h2>{kb.name}</h2>
        </div>
        <div className="tree-actions">
          <input
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="节点标题"
            aria-label="新建节点标题"
          />
          <div className="row">
            <button
              type="button"
              className="btn secondary small"
              onClick={() => void createNode('folder')}
            >
              + 文件夹
            </button>
            <button type="button" className="btn secondary small" onClick={() => void createNode('doc')}>
              + 文档
            </button>
          </div>
          <p className="hint">新建挂在当前选中节点下（文档也可挂子节点）</p>
          {selected && (
            <button
              type="button"
              className="btn secondary small danger-outline"
              onClick={() => void deleteSelected()}
            >
              删除选中节点
            </button>
          )}
        </div>
        <div className="tree-scroll">
          {nodes.length === 0 ? (
            <StatePanel
              phase="empty"
              title="文档树为空"
              description="创建文件夹或文档后会出现在这里。"
            />
          ) : (
            <TreeNodes
              parentId={null}
              map={childMap}
              depth={0}
              selectedId={selected?.id ?? null}
              onSelect={(n) => void openNode(n)}
            />
          )}
        </div>
      </aside>

      <section className="editor-pane" aria-label="编辑区">
        {error && kb && (
          <p className="form-msg form-msg--error" role="alert">
            {error}
          </p>
        )}

        {!selected && (
          <div className="editor-placeholder">
            <StatePanel
              phase="empty"
              title="选择或创建文档"
              description="在左侧树中选择节点，或新建文档开始编辑 Markdown。"
            />
          </div>
        )}

        {selected?.type === 'folder' && (
          <div className="card folder-panel">
            <h2>{selected.title}</h2>
            <p className="muted">这是文件夹，没有正文。可在其下创建子文件夹或文档。</p>
          </div>
        )}

        {selected?.type === 'doc' && (
          <>
            <div className="editor-toolbar">
              <h2>{selected.title}</h2>
              <div className="row">
                <span className="badge">v{version ?? '—'}</span>
                <button type="button" className="btn primary small" onClick={() => void save()}>
                  保存
                </button>
                <button
                  type="button"
                  className="btn secondary small"
                  onClick={() => void toggleShare()}
                >
                  {share?.enabled ? '关闭分享' : '开启分享'}
                </button>
                <button
                  type="button"
                  className="btn secondary small danger-outline"
                  onClick={() => void deleteSelected()}
                >
                  删除
                </button>
              </div>
            </div>
            {status && <p className="status-line">{status}</p>}
            {conflict && (
              <div className="conflict-banner" role="alert">
                <strong>版本冲突</strong>
                <span className="muted">服务器版本 v{conflict.serverVersion}，请选择如何处理</span>
                <div className="row">
                  <button
                    type="button"
                    className="btn secondary small"
                    onClick={() => void reloadServer()}
                  >
                    加载最新
                  </button>
                  <button type="button" className="btn primary small" onClick={() => void overwrite()}>
                    强制覆盖
                  </button>
                  <button
                    type="button"
                    className="btn secondary small"
                    onClick={() => void saveAsCopy()}
                  >
                    另存副本
                  </button>
                </div>
              </div>
            )}
            {publicShareUrl && share?.token && (
              <div className="share-link">
                <div className="row" style={{ width: '100%' }}>
                  <span className="share-link-label">公开链接</span>
                  <button type="button" className="btn secondary small" onClick={() => void copyShareUrl()}>
                    复制链接
                  </button>
                  {copyHint && <span className="muted">{copyHint}</span>}
                </div>
                <a className="share-link-url" href={publicShareUrl} target="_blank" rel="noreferrer">
                  {publicShareUrl}
                </a>
                <p className="hint">也可在站内打开： <Link to={`/s/${share.token}`}>预览分享页</Link></p>
              </div>
            )}
            {docLoading ? (
              <StatePanel phase="loading" title="加载正文" description="读取文档内容与版本…" />
            ) : (
              <textarea
                className="editor"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="在此编写 Markdown 正文…"
                spellCheck={false}
                aria-label="文档正文"
              />
            )}
          </>
        )}
      </section>
    </div>
  );
}
