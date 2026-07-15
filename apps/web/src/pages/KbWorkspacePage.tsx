import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { contentApi, kbApi, shareApi, treeApi } from '../api/endpoints';
import { ApiError } from '../api/types';
import type {
  ContentRevision,
  ContentRevisionBrief,
  PublicKb,
  PublicNode,
  ShareInfo,
} from '../api/types';
import { MembersPanel } from '../components/MembersPanel';
import { StatePanel } from '../components/StatePanel';
import {
  AUTOSAVE_DEBOUNCE_MS,
  canAutosave,
  isDirty,
} from '../ui/autosave';
import {
  extractOutline,
  focusTextareaLine,
  MarkdownView,
} from '../ui/markdown';
import {
  expiresAtFromPreset,
  formatShareExpiry,
  isShareExpired,
  SHARE_EXPIRY_OPTIONS,
  type ShareExpiryPreset,
} from '../ui/shareExpiry';
import {
  buildMoveParentOptions,
  collectAncestorIds,
  collectParentIdsWithChildren,
  expandAncestorsInCollapsed,
  normalizeKbDescription,
  normalizeKbName,
  normalizeRenameTitle,
  normalizeSearchQuery,
  planSiblingReorder,
  siblingReorderAvailability,
  toggleCollapsedId,
  type SiblingReorderDirection,
} from '../ui/treeOps';
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
  collapsedIds,
  onToggleCollapse,
}: {
  parentId: string | null;
  map: Map<string | null, PublicNode[]>;
  depth: number;
  selectedId: string | null;
  onSelect: (n: PublicNode) => void;
  collapsedIds: ReadonlySet<string>;
  onToggleCollapse: (nodeId: string) => void;
}) {
  const children = map.get(parentId) ?? [];
  return (
    <ul className="tree" style={{ paddingLeft: depth === 0 ? 0 : 12 }}>
      {children.map((n) => {
        const kids = map.get(n.id) ?? [];
        const hasKids = kids.length > 0;
        const collapsed = collapsedIds.has(n.id);
        return (
          <li key={n.id}>
            <div className="tree-row">
              {hasKids ? (
                <button
                  type="button"
                  className="tree-twistie"
                  aria-label={collapsed ? '展开子节点' : '折叠子节点'}
                  aria-expanded={!collapsed}
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleCollapse(n.id);
                  }}
                >
                  {collapsed ? '▶' : '▼'}
                </button>
              ) : (
                <span className="tree-twistie-spacer" aria-hidden />
              )}
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
                <span className="tree-item-title">{n.title}</span>
              </button>
            </div>
            {hasKids && !collapsed && (
              <TreeNodes
                parentId={n.id}
                map={map}
                depth={depth + 1}
                selectedId={selectedId}
                onSelect={onSelect}
                collapsedIds={collapsedIds}
                onToggleCollapse={onToggleCollapse}
              />
            )}
          </li>
        );
      })}
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
  const [renameTitle, setRenameTitle] = useState('');
  const [searchQ, setSearchQ] = useState('');
  const [searchHits, setSearchHits] = useState<PublicNode[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [moveParentId, setMoveParentId] = useState('');
  const [kbNameDraft, setKbNameDraft] = useState('');
  const [kbDescDraft, setKbDescDraft] = useState('');
  const [kbSaving, setKbSaving] = useState(false);
  const [shareExpiryPreset, setShareExpiryPreset] =
    useState<ShareExpiryPreset>('never');
  const [editorMode, setEditorMode] = useState<'edit' | 'preview'>('edit');
  const [revisions, setRevisions] = useState<ContentRevisionBrief[] | null>(null);
  const [revisionsOpen, setRevisionsOpen] = useState(false);
  const [revisionsLoading, setRevisionsLoading] = useState(false);
  const [revisionPreview, setRevisionPreview] = useState<ContentRevision | null>(
    null,
  );
  const [lastSavedBody, setLastSavedBody] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [outlineOpen, setOutlineOpen] = useState(true);
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(() => new Set());
  const editorRef = useRef<HTMLTextAreaElement | null>(null);
  const previewRef = useRef<HTMLDivElement | null>(null);

  const childMap = useMemo(() => buildChildrenMap(nodes), [nodes]);
  const moveOptions = useMemo(
    () => (selected ? buildMoveParentOptions(nodes, selected.id) : []),
    [nodes, selected],
  );
  const canWrite = kb != null && kb.role !== 'reader';
  const dirty = isDirty(body, lastSavedBody);
  const outline = useMemo(
    () => (selected?.type === 'doc' ? extractOutline(body) : []),
    [selected?.type, body],
  );
  const reorderAvail = useMemo(
    () =>
      selected
        ? siblingReorderAvailability(nodes, selected.id)
        : { canUp: false, canDown: false },
    [nodes, selected],
  );

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
      setKbNameDraft(k.name);
      setKbDescDraft(k.description ?? '');
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
    setRenameTitle(n.title);
    setMoveParentId(n.parentId ?? '');
    setConflict(null);
    setShare(null);
    setStatus(null);
    setCopyHint(null);
    setRevisions(null);
    setRevisionsOpen(false);
    setRevisionPreview(null);
    setEditorMode('edit');
    setLastSavedBody(null);
    setSaving(false);
    setCollapsedIds((prev) =>
      expandAncestorsInCollapsed(prev, collectAncestorIds(nodes, n.id)),
    );
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
      setLastSavedBody(c.bodyMd);
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

  const save = useCallback(
    async (opts?: { auto?: boolean }) => {
      const auto = opts?.auto === true;
      if (!selected || selected.type !== 'doc' || version == null) return;
      if (!canWrite) return;
      if (conflict && auto) return;

      setSaving(true);
      if (!auto) setConflict(null);
      setStatus(auto ? '自动保存中…' : '保存中…');
      try {
        const meta = await contentApi.put(selected.id, version, body);
        setVersion(meta.version);
        setLastSavedBody(body);
        setStatus(auto ? `已自动保存 v${meta.version}` : `已保存 v${meta.version}`);
        setConflict(null);
      } catch (e) {
        if (e instanceof ApiError && e.code === 'DOC_VERSION_CONFLICT') {
          const serverVersion = Number(
            (e.details as { serverVersion?: number } | null)?.serverVersion ?? 0,
          );
          setConflict({ serverVersion });
          setStatus('版本冲突：请选择处理方式（已暂停自动保存）');
        } else {
          setStatus(e instanceof ApiError ? e.message : '保存失败');
        }
      } finally {
        setSaving(false);
      }
    },
    [selected, version, body, canWrite, conflict],
  );

  // Debounced autosave; paused while conflict is open (PRD).
  useEffect(() => {
    if (docLoading) return;
    const gate = canAutosave({
      hasDoc: selected?.type === 'doc',
      version,
      body,
      lastSavedBody,
      hasConflict: conflict != null,
      isSaving: saving,
      canWrite,
    });
    if (!gate.allow) return;
    const t = window.setTimeout(() => {
      void save({ auto: true });
    }, AUTOSAVE_DEBOUNCE_MS);
    return () => window.clearTimeout(t);
  }, [
    body,
    version,
    lastSavedBody,
    conflict,
    saving,
    selected?.type,
    selected?.id,
    docLoading,
    canWrite,
    save,
  ]);

  // Ctrl/Cmd+S → manual save (block browser "Save Page")
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (!(e.metaKey || e.ctrlKey)) return;
      if (e.key !== 's' && e.key !== 'S') return;
      e.preventDefault();
      if (selected?.type !== 'doc' || !canWrite || saving || version == null) {
        return;
      }
      void save({ auto: false });
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [selected?.type, canWrite, saving, version, save]);

  async function reloadServer() {
    if (!selected || selected.type !== 'doc') return;
    const c = await contentApi.get(selected.id);
    setBody(c.bodyMd);
    setVersion(c.version);
    setLastSavedBody(c.bodyMd);
    setConflict(null);
    setStatus(`已加载服务器 v${c.version}`);
  }

  async function overwrite() {
    if (!selected || !conflict) return;
    const meta = await contentApi.overwrite(selected.id, conflict.serverVersion, body);
    setVersion(meta.version);
    setLastSavedBody(body);
    setConflict(null);
    setStatus(`已覆盖保存 v${meta.version}`);
    if (revisionsOpen) {
      void loadRevisions();
    }
  }

  async function loadRevisions() {
    if (!selected || selected.type !== 'doc') return;
    setRevisionsLoading(true);
    try {
      const r = await contentApi.listRevisions(selected.id);
      setRevisions(r.items);
      setRevisionsOpen(true);
    } catch (e) {
      setStatus(e instanceof ApiError ? e.message : '加载历史快照失败');
    } finally {
      setRevisionsLoading(false);
    }
  }

  async function openRevision(id: string) {
    if (!selected) return;
    try {
      const det = await contentApi.getRevision(selected.id, id);
      setRevisionPreview(det);
    } catch (e) {
      setStatus(e instanceof ApiError ? e.message : '打开快照失败');
    }
  }

  function jumpToOutline(item: { id: string; line: number }) {
    if (editorMode === 'preview') {
      setOutlineOpen(true);
      // ensure preview painted with ids
      requestAnimationFrame(() => {
        const root = previewRef.current;
        const el = root?.querySelector(`#${CSS.escape(item.id)}`);
        el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
      return;
    }
    const ta = editorRef.current;
    if (ta) focusTextareaLine(ta, item.line);
  }

  function applyRevisionToEditor() {
    if (!revisionPreview) return;
    setBody(revisionPreview.bodyMd);
    setRevisionPreview(null);
    setStatus(
      `已将快照 v${revisionPreview.version} 填入编辑器（未保存，当前服务器版本仍为 v${version ?? '—'}）`,
    );
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
        const expiresAt = expiresAtFromPreset(shareExpiryPreset);
        const s = await shareApi.enable(
          selected.id,
          expiresAt === null ? { expiresAt: null } : { expiresAt },
        );
        setShare(s);
        setStatus(
          expiresAt ? `已开启分享（${formatShareExpiry(s.expiresAt)}）` : '已开启分享（永久）',
        );
      }
    } catch (e) {
      setStatus(e instanceof ApiError ? e.message : '分享操作失败');
    }
  }

  async function applyShareExpiry() {
    if (!selected || selected.type !== 'doc' || !share?.enabled) return;
    try {
      const expiresAt = expiresAtFromPreset(shareExpiryPreset);
      const s = await shareApi.enable(selected.id, { expiresAt });
      setShare(s);
      setStatus(`已更新分享：${formatShareExpiry(s.expiresAt)}`);
    } catch (e) {
      setStatus(e instanceof ApiError ? e.message : '更新有效期失败');
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
      setRenameTitle('');
      setStatus(`已删除「${selected.title}」`);
      await refreshTree();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : '删除失败');
    }
  }

  async function renameSelected() {
    if (!selected) return;
    const parsed = normalizeRenameTitle(renameTitle);
    if (!parsed.ok) {
      setError(parsed.message);
      return;
    }
    try {
      const updated = await treeApi.update(selected.id, parsed.title);
      setSelected(updated);
      setRenameTitle(updated.title);
      setStatus(`已重命名为「${updated.title}」`);
      setError(null);
      await refreshTree();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : '重命名失败');
    }
  }

  async function moveSelected() {
    if (!selected) return;
    const parentId = moveParentId === '' ? null : moveParentId;
    try {
      const updated = await treeApi.move(selected.id, parentId);
      setSelected(updated);
      setMoveParentId(updated.parentId ?? '');
      setStatus('已移动节点');
      setError(null);
      await refreshTree();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : '移动失败');
    }
  }

  async function reorderSibling(direction: SiblingReorderDirection) {
    if (!selected) return;
    const plan = planSiblingReorder(nodes, selected.id, direction);
    if (!plan.ok) {
      setStatus(plan.message);
      return;
    }
    try {
      for (const m of plan.moves) {
        await treeApi.move(m.id, m.parentId, m.sortOrder);
      }
      const data = await treeApi.list(kbId);
      setNodes(data.items);
      const me = data.items.find((n) => n.id === selected.id);
      if (me) {
        setSelected(me);
        setMoveParentId(me.parentId ?? '');
      }
      setStatus(direction === 'up' ? '已上移' : '已下移');
      setError(null);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : '调整顺序失败');
    }
  }

  async function runSearch() {
    const parsed = normalizeSearchQuery(searchQ);
    if (!parsed.ok) {
      setError(parsed.message);
      setSearchHits(null);
      return;
    }
    setSearching(true);
    setError(null);
    try {
      const data = await treeApi.search(kbId, parsed.q);
      setSearchHits(data.items);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : '搜索失败');
      setSearchHits(null);
    } finally {
      setSearching(false);
    }
  }

  async function saveKbMeta() {
    if (!kb) return;
    if (kb.role === 'reader') {
      setError('只读成员不能修改知识库');
      return;
    }
    const nameParsed = normalizeKbName(kbNameDraft);
    if (!nameParsed.ok) {
      setError(nameParsed.message);
      return;
    }
    const descParsed = normalizeKbDescription(kbDescDraft);
    if (!descParsed.ok) {
      setError(descParsed.message);
      return;
    }
    setKbSaving(true);
    setError(null);
    try {
      const updated = await kbApi.update(kb.id, {
        name: nameParsed.name,
        description: descParsed.description,
      });
      setKb(updated);
      setKbNameDraft(updated.name);
      setKbDescDraft(updated.description ?? '');
      setStatus('知识库信息已保存');
    } catch (e) {
      setError(e instanceof ApiError ? e.message : '保存知识库失败');
    } finally {
      setKbSaving(false);
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
          {kb.role !== 'reader' && (
            <div className="kb-meta-edit">
              <label className="field-label">
                库名称
                <input
                  value={kbNameDraft}
                  onChange={(e) => setKbNameDraft(e.target.value)}
                  maxLength={128}
                  aria-label="知识库名称"
                />
              </label>
              <label className="field-label">
                简介
                <textarea
                  className="field-textarea"
                  value={kbDescDraft}
                  onChange={(e) => setKbDescDraft(e.target.value)}
                  maxLength={2000}
                  rows={2}
                  aria-label="知识库简介"
                  placeholder="可选"
                />
              </label>
              <button
                type="button"
                className="btn secondary small"
                disabled={kbSaving}
                onClick={() => void saveKbMeta()}
              >
                {kbSaving ? '保存中…' : '保存库信息'}
              </button>
            </div>
          )}
          <MembersPanel
            kb={kb}
            onOwnershipTransferred={() => {
              void loadWorkspace();
            }}
          />
        </div>
        <div className="tree-actions">
          <div className="row">
            <input
              value={searchQ}
              onChange={(e) => setSearchQ(e.target.value)}
              placeholder="搜索标题…"
              aria-label="搜索节点标题"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  void runSearch();
                }
              }}
            />
            <button
              type="button"
              className="btn secondary small"
              disabled={searching}
              onClick={() => void runSearch()}
            >
              {searching ? '…' : '搜索'}
            </button>
          </div>
          {searchHits && (
            <div className="search-hits" role="listbox" aria-label="搜索结果">
              {searchHits.length === 0 ? (
                <p className="hint">无匹配节点</p>
              ) : (
                searchHits.map((n) => (
                  <button
                    key={n.id}
                    type="button"
                    className="tree-item"
                    role="option"
                    onClick={() => void openNode(n)}
                  >
                    <span
                      className={`tree-type ${n.type === 'folder' ? 'tree-type--folder' : 'tree-type--doc'}`}
                      aria-hidden
                    >
                      {n.type === 'folder' ? 'F' : 'D'}
                    </span>
                    <span>{n.title}</span>
                  </button>
                ))
              )}
              <button
                type="button"
                className="btn ghost small"
                onClick={() => {
                  setSearchHits(null);
                  setSearchQ('');
                }}
              >
                清除搜索
              </button>
            </div>
          )}
          <input
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="新建节点标题"
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
            <>
              <label className="field-label">
                重命名
                <div className="row">
                  <input
                    value={renameTitle}
                    onChange={(e) => setRenameTitle(e.target.value)}
                    aria-label="节点新标题"
                  />
                  <button type="button" className="btn secondary small" onClick={() => void renameSelected()}>
                    保存名
                  </button>
                </div>
              </label>
              <label className="field-label">
                移动到
                <div className="row">
                  <select
                    className="field-select"
                    value={moveParentId}
                    onChange={(e) => setMoveParentId(e.target.value)}
                    aria-label="移动目标父节点"
                  >
                    {moveOptions.map((o) => (
                      <option key={o.value || 'root'} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                  <button type="button" className="btn secondary small" onClick={() => void moveSelected()}>
                    移动
                  </button>
                </div>
              </label>
              <div className="row tree-reorder">
                <span className="muted">同级顺序</span>
                <button
                  type="button"
                  className="btn secondary small"
                  disabled={!reorderAvail.canUp}
                  onClick={() => void reorderSibling('up')}
                  title={reorderAvail.canUp ? '与上一个同级节点交换顺序' : '已在同级最前'}
                >
                  上移
                </button>
                <button
                  type="button"
                  className="btn secondary small"
                  disabled={!reorderAvail.canDown}
                  onClick={() => void reorderSibling('down')}
                  title={reorderAvail.canDown ? '与下一个同级节点交换顺序' : '已在同级最后'}
                >
                  下移
                </button>
              </div>
              <button
                type="button"
                className="btn secondary small danger-outline"
                onClick={() => void deleteSelected()}
              >
                删除选中节点
              </button>
            </>
          )}
        </div>
        {nodes.length > 0 && (
          <div className="row tree-collapse-actions">
            <button
              type="button"
              className="btn ghost small"
              onClick={() => setCollapsedIds(new Set())}
              title="展开全部节点"
            >
              全部展开
            </button>
            <button
              type="button"
              className="btn ghost small"
              onClick={() =>
                setCollapsedIds(new Set(collectParentIdsWithChildren(nodes)))
              }
              title="折叠所有有子节点的项"
            >
              全部折叠
            </button>
          </div>
        )}
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
              collapsedIds={collapsedIds}
              onToggleCollapse={(id) =>
                setCollapsedIds((prev) => toggleCollapsedId(prev, id))
              }
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
            <p className="muted">这是文件夹，没有正文。可在其下创建子文件夹或文档；左侧可重命名、移动或删除。</p>
          </div>
        )}

        {selected?.type === 'doc' && (
          <>
            <div className="editor-toolbar">
              <h2>{selected.title}</h2>
              <div className="row">
                <span className="badge">v{version ?? '—'}</span>
                {dirty && !conflict && (
                  <span className="badge badge-warn" title="本地有未同步修改">
                    未保存
                  </span>
                )}
                {saving && <span className="muted">自动保存中…</span>}
                <div className="seg-control" role="group" aria-label="编辑模式">
                  <button
                    type="button"
                    className={`btn small ${editorMode === 'edit' ? 'primary' : 'secondary'}`}
                    onClick={() => setEditorMode('edit')}
                    aria-pressed={editorMode === 'edit'}
                  >
                    编辑
                  </button>
                  <button
                    type="button"
                    className={`btn small ${editorMode === 'preview' ? 'primary' : 'secondary'}`}
                    onClick={() => setEditorMode('preview')}
                    aria-pressed={editorMode === 'preview'}
                  >
                    预览
                  </button>
                </div>
                <button
                  type="button"
                  className="btn secondary small"
                  onClick={() => setOutlineOpen((v) => !v)}
                  aria-pressed={outlineOpen}
                  title="根据 # 标题生成大纲"
                >
                  {outlineOpen ? '收起大纲' : '大纲'}
                  {outline.length > 0 ? ` (${outline.length})` : ''}
                </button>
                <button
                  type="button"
                  className="btn primary small"
                  disabled={!canWrite || saving || version == null}
                  onClick={() => void save({ auto: false })}
                  title="Ctrl/Cmd+S"
                >
                  保存
                </button>
                <label className="share-expiry-inline">
                  <span className="muted">有效期</span>
                  <select
                    className="input small"
                    value={shareExpiryPreset}
                    onChange={(e) =>
                      setShareExpiryPreset(e.target.value as ShareExpiryPreset)
                    }
                    aria-label="分享有效期"
                  >
                    {SHARE_EXPIRY_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  type="button"
                  className="btn secondary small"
                  onClick={() => void toggleShare()}
                >
                  {share?.enabled ? '关闭分享' : '开启分享'}
                </button>
                {share?.enabled && (
                  <button
                    type="button"
                    className="btn secondary small"
                    onClick={() => void applyShareExpiry()}
                  >
                    更新有效期
                  </button>
                )}
                <button
                  type="button"
                  className="btn secondary small"
                  onClick={() => {
                    if (revisionsOpen) {
                      setRevisionsOpen(false);
                      setRevisionPreview(null);
                    } else {
                      void loadRevisions();
                    }
                  }}
                  disabled={revisionsLoading}
                >
                  {revisionsLoading
                    ? '加载中…'
                    : revisionsOpen
                      ? '收起快照'
                      : '历史快照'}
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
            {revisionsOpen && (
              <div className="revisions-panel card" aria-label="覆盖前历史快照">
                <div className="row" style={{ width: '100%' }}>
                  <strong>历史快照</strong>
                  <span className="muted">
                    仅强制覆盖时写入；点击可预览，可填入编辑器后自行保存
                  </span>
                  <button
                    type="button"
                    className="btn secondary small"
                    onClick={() => void loadRevisions()}
                    disabled={revisionsLoading}
                  >
                    刷新
                  </button>
                </div>
                {!revisions?.length ? (
                  <p className="muted">暂无覆盖快照</p>
                ) : (
                  <ul className="revisions-list">
                    {revisions.map((item) => (
                      <li key={item.id}>
                        <button
                          type="button"
                          className={`revisions-item${
                            revisionPreview?.id === item.id ? ' active' : ''
                          }`}
                          onClick={() => void openRevision(item.id)}
                        >
                          <span className="badge">v{item.version}</span>
                          <span className="muted">
                            {new Date(item.createdAt).toLocaleString()}
                          </span>
                          <span className="muted">
                            {item.createdBy?.nickname ?? '未知'}
                          </span>
                          <span className="hint">{item.reason}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                {revisionPreview && (
                  <div className="revision-preview">
                    <div className="row" style={{ width: '100%' }}>
                      <strong>快照 v{revisionPreview.version}</strong>
                      <button
                        type="button"
                        className="btn primary small"
                        onClick={() => applyRevisionToEditor()}
                      >
                        填入编辑器
                      </button>
                      <button
                        type="button"
                        className="btn secondary small"
                        onClick={() => setRevisionPreview(null)}
                      >
                        关闭预览
                      </button>
                    </div>
                    <pre className="revision-body">{revisionPreview.bodyMd}</pre>
                  </div>
                )}
              </div>
            )}
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
              <div
                className={`share-link${isShareExpired(share.expiresAt) ? ' share-link--expired' : ''}`}
              >
                <div className="row" style={{ width: '100%' }}>
                  <span className="share-link-label">公开链接</span>
                  {isShareExpired(share.expiresAt) ? (
                    <span className="badge badge-warn">已过期</span>
                  ) : (
                    <span className="muted">{formatShareExpiry(share.expiresAt)}</span>
                  )}
                  <button type="button" className="btn secondary small" onClick={() => void copyShareUrl()}>
                    复制链接
                  </button>
                  {copyHint && <span className="muted">{copyHint}</span>}
                </div>
                <a className="share-link-url" href={publicShareUrl} target="_blank" rel="noreferrer">
                  {publicShareUrl}
                </a>
                {isShareExpired(share.expiresAt) ? (
                  <p className="hint warn">链接已过期，公开访问返回 404。可「更新有效期」或关闭后重新开启。</p>
                ) : (
                  <p className="hint">
                    也可在站内打开： <Link to={`/s/${share.token}`}>预览分享页</Link>
                  </p>
                )}
              </div>
            )}
            {docLoading ? (
              <StatePanel phase="loading" title="加载正文" description="读取文档内容与版本…" />
            ) : (
              <div
                className={`editor-body-row${outlineOpen ? ' editor-body-row--outline' : ''}`}
              >
                <div className="editor-main">
                  {editorMode === 'edit' ? (
                    <textarea
                      ref={editorRef}
                      className="editor"
                      value={body}
                      onChange={(e) => setBody(e.target.value)}
                      placeholder="在此编写 Markdown 正文…"
                      spellCheck={false}
                      aria-label="文档正文"
                      readOnly={!canWrite}
                    />
                  ) : (
                    <div ref={previewRef} className="editor-preview-wrap">
                      <MarkdownView
                        source={body}
                        className="md-preview editor-preview"
                        emptyLabel="（空文档 — 切换到编辑开始写）"
                      />
                    </div>
                  )}
                </div>
                {outlineOpen && (
                  <aside className="doc-outline" aria-label="文档大纲">
                    <div className="doc-outline-head">
                      <strong>大纲</strong>
                      <span className="muted">
                        {outline.length ? `${outline.length} 个标题` : '无标题'}
                      </span>
                    </div>
                    {!outline.length ? (
                      <p className="hint">使用 # / ## / ### 标题后显示大纲</p>
                    ) : (
                      <ul className="doc-outline-list">
                        {outline.map((item) => (
                          <li key={item.id}>
                            <button
                              type="button"
                              className={`doc-outline-item level-${item.level}`}
                              onClick={() => jumpToOutline(item)}
                              title={`第 ${item.line + 1} 行`}
                            >
                              {item.text}
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </aside>
                )}
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
}
