import { useCallback, useEffect, useMemo, useState } from 'react';
import { contentApi, kbApi, shareApi, treeApi } from '../api/endpoints';
import {
  buildDocExportPaths,
  buildMarkdownZip,
  downloadZipFile,
  type ZipFileEntry,
} from '../ui/exportKbZip';
import { ApiError } from '../api/types';
import type {
  ContentRevision,
  ContentRevisionBrief,
  PublicKb,
  PublicNode,
} from '../api/types';
import {
  expiresAtFromPreset,
  type ShareExpiryPreset,
} from '../ui/shareExpiry';
import {
  collectParentIdsWithChildren,
  planSiblingReorder,
  resolveCreateParentId,
  toggleCollapsedId,
  type SiblingReorderDirection,
} from '../ui/treeOps';
import { duplicateTitle } from '../ui/duplicateDoc';
import {
  confirmDeleteNodeMessage,
  confirmEmptyTrashMessage,
  confirmPurgeNodeMessage,
} from '../ui/urls';
import { useDocumentAutosave } from './useDocumentAutosave';
import { useDocumentEditor } from './useDocumentEditor';
import { useDocumentSelection } from './useDocumentSelection';

export function useKnowledgeWorkspace(kbId: string) {
  const [kb, setKb] = useState<PublicKb | null>(null);
  const [nodes, setNodes] = useState<PublicNode[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<string | null>(null);
  const [searchQ, setSearchQ] = useState('');
  const [searchHits, setSearchHits] = useState<PublicNode[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [kbSaving, setKbSaving] = useState(false);
  const [focusMode, setFocusMode] = useState(false);
  const [outlineOpen, setOutlineOpen] = useState(() => {
    if (typeof localStorage === 'undefined') return true;
    try {
      const v = localStorage.getItem(`yuque1:outline-open:${kbId}`);
      if (v === '0') return false;
      if (v === '1') return true;
    } catch {
      /* ignore */
    }
    return true;
  });

  // dialogs
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [membersOpen, setMembersOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [trashOpen, setTrashOpen] = useState(false);
  const [moveTarget, setMoveTarget] = useState<PublicNode | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<PublicNode | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [purgeTarget, setPurgeTarget] = useState<PublicNode | null>(null);
  const [purgeBusy, setPurgeBusy] = useState(false);
  const [purgingId, setPurgingId] = useState<string | null>(null);
  const [emptyTrashConfirm, setEmptyTrashConfirm] = useState(false);
  const [emptyingTrash, setEmptyingTrash] = useState(false);
  const [exportingZip, setExportingZip] = useState(false);
  const [renameNodeId, setRenameNodeId] = useState<string | null>(null);
  const [titleDraft, setTitleDraft] = useState('');
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  const [revisions, setRevisions] = useState<ContentRevisionBrief[] | null>(
    null,
  );
  const [revisionsLoading, setRevisionsLoading] = useState(false);
  const [revisionPreview, setRevisionPreview] =
    useState<ContentRevision | null>(null);
  const [trashItems, setTrashItems] = useState<PublicNode[]>([]);
  const [trashLoading, setTrashLoading] = useState(false);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [defaultOpenDone, setDefaultOpenDone] = useState(false);

  const selection = useDocumentSelection(kbId);
  const {
    selected,
    setSelected,
    body,
    setBody,
    version,
    setVersion,
    share,
    setShare,
    docLoading,
    lastSavedBody,
    setLastSavedBody,
    collapsedIds,
    setCollapsedIds,
    openNode,
    openDefaultDocument,
    initRecent,
    syncRecentFromNodes,
  } = selection;

  const canWrite = kb != null && kb.role !== 'reader';

  const refreshTree = useCallback(async () => {
    const data = await treeApi.list(kbId);
    setNodes(data.items);
    return data.items;
  }, [kbId]);

  const editor = useDocumentEditor({
    selected,
    body,
    setBody,
    version,
    setVersion,
    lastSavedBody,
    setLastSavedBody,
    canWrite,
    setStatus,
    refreshTree: async () => {
      await refreshTree();
    },
    onSaveAsCopyOpened: (node) => {
      void refreshTree().then((items) => openNode(node, items));
    },
  });

  const {
    saving,
    conflict,
    setConflict,
    editorMode,
    setEditorMode,
    dirty,
    save,
    reloadServer,
    overwrite,
    saveAsCopy,
    duplicateDoc: duplicateOpenDoc,
  } = editor;

  useDocumentAutosave({
    docLoading,
    hasDoc: selected?.type === 'doc',
    version,
    body,
    lastSavedBody,
    hasConflict: conflict != null,
    isSaving: saving,
    canWrite,
    save,
    selectedId: selected?.id,
  });

  const loadTrash = useCallback(async () => {
    setTrashLoading(true);
    try {
      const data = await treeApi.trash(kbId);
      setTrashItems(data.items);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : '加载回收站失败');
    } finally {
      setTrashLoading(false);
    }
  }, [kbId]);

  const loadWorkspace = useCallback(async () => {
    setLoading(true);
    setError(null);
    setDefaultOpenDone(false);
    try {
      const [k, t] = await Promise.all([kbApi.get(kbId), treeApi.list(kbId)]);
      setKb(k);
      setNodes(t.items);
      initRecent();
      syncRecentFromNodes(t.items);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : '加载知识库失败');
    } finally {
      setLoading(false);
    }
  }, [kbId, initRecent, syncRecentFromNodes]);

  useEffect(() => {
    void loadWorkspace();
  }, [loadWorkspace]);

  useEffect(() => {
    if (loading || defaultOpenDone || !kb) return;
    setDefaultOpenDone(true);
    void openDefaultDocument(nodes).catch((e) => {
      setError(e instanceof Error ? e.message : '打开文档失败');
    });
  }, [loading, defaultOpenDone, kb, nodes, openDefaultDocument]);

  useEffect(() => {
    if (trashOpen) void loadTrash();
  }, [trashOpen, loadTrash]);

  useEffect(() => {
    syncRecentFromNodes(nodes);
  }, [nodes, syncRecentFromNodes]);

  useEffect(() => {
    if (selected) setTitleDraft(selected.title);
  }, [selected?.id, selected?.title]);

  useEffect(() => {
    try {
      localStorage.setItem(
        `yuque1:outline-open:${kbId}`,
        outlineOpen ? '1' : '0',
      );
    } catch {
      /* ignore */
    }
  }, [outlineOpen, kbId]);

  // leave warning
  useEffect(() => {
    if (!dirty) return;
    function onBeforeUnload(e: BeforeUnloadEvent) {
      e.preventDefault();
      e.returnValue = '';
    }
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [dirty]);

  // shortcuts
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && focusMode) {
        e.preventDefault();
        setFocusMode(false);
        return;
      }
      if (!(e.metaKey || e.ctrlKey)) return;
      if (e.shiftKey && (e.key === 'f' || e.key === 'F')) {
        e.preventDefault();
        if (selected?.type === 'doc') {
          setFocusMode((v) => {
            const next = !v;
            if (next) setOutlineOpen(false);
            return next;
          });
        }
        return;
      }
      if (e.key !== 's' && e.key !== 'S') return;
      e.preventDefault();
      if (selected?.type !== 'doc' || !canWrite || saving || version == null) {
        return;
      }
      void save({ auto: false });
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [selected?.type, canWrite, saving, version, save, focusMode]);

  useEffect(() => {
    if (selected?.type !== 'doc' && focusMode) setFocusMode(false);
  }, [selected?.type, focusMode]);

  const handleSelect = useCallback(
    async (n: PublicNode) => {
      setConflict(null);
      setStatus(null);
      setEditorMode('edit');
      setHistoryOpen(false);
      setRevisionPreview(null);
      setRevisions(null);
      setMobileSidebarOpen(false);
      try {
        await openNode(n, nodes);
      } catch (e) {
        setError(e instanceof Error ? e.message : '打开失败');
      }
    },
    [nodes, openNode, setConflict, setEditorMode],
  );

  const createNode = useCallback(
    async (
      type: 'folder' | 'doc',
      opts?: { contextNode?: PublicNode | null; title?: string },
    ) => {
      const context = opts?.contextNode !== undefined ? opts.contextNode : selected;
      const parentId = resolveCreateParentId(context);
      const title =
        opts?.title?.trim() ||
        (type === 'folder' ? '新建文件夹' : '无标题文档');
      try {
        const node = await treeApi.create(kbId, { type, title, parentId });
        const items = await refreshTree();
        if (type === 'doc') {
          await openNode(node, items);
          setRenameNodeId(node.id);
        } else {
          setSelected(node);
        }
        setStatus(`已创建「${node.title}」`);
        return node;
      } catch (e) {
        setError(e instanceof ApiError ? e.message : '创建失败');
        return null;
      }
    },
    [selected, kbId, refreshTree, openNode, setSelected],
  );

  const renameNode = useCallback(
    async (node: PublicNode, title: string) => {
      try {
        const updated = await treeApi.update(node.id, title);
        if (selected?.id === updated.id) {
          setSelected(updated);
          setTitleDraft(updated.title);
        }
        setStatus(`已重命名为「${updated.title}」`);
        await refreshTree();
      } catch (e) {
        setError(e instanceof ApiError ? e.message : '重命名失败');
      }
    },
    [selected, refreshTree, setSelected],
  );

  const commitTitleDraft = useCallback(async () => {
    if (!selected || !canWrite) return;
    const t = titleDraft.trim();
    if (!t || t === selected.title) {
      setTitleDraft(selected.title);
      return;
    }
    await renameNode(selected, t);
  }, [selected, canWrite, titleDraft, renameNode]);

  const moveNode = useCallback(
    async (node: PublicNode, parentId: string | null) => {
      try {
        const updated = await treeApi.move(node.id, parentId);
        if (selected?.id === updated.id) setSelected(updated);
        setStatus('已移动节点');
        setMoveTarget(null);
        await refreshTree();
      } catch (e) {
        setError(e instanceof ApiError ? e.message : '移动失败');
      }
    },
    [selected, refreshTree, setSelected],
  );

  /**
   * Duplicate a document as a sibling via content save-as.
   * Uses open editor body when the source is currently selected.
   */
  const duplicateDocument = useCallback(
    async (node: PublicNode) => {
      if (!canWrite || node.type !== 'doc') return null;
      try {
        let bodyMd = '';
        if (selected?.id === node.id) {
          bodyMd = body;
        } else {
          const c = await contentApi.get(node.id);
          bodyMd = c.bodyMd;
        }
        const r = await contentApi.saveAs(node.id, bodyMd, {
          title: duplicateTitle(node.title),
          parentId: node.parentId,
        });
        const items = await refreshTree();
        await openNode(r.node, items);
        setRenameNodeId(r.node.id);
        setStatus(`已复制为「${r.node.title}」`);
        return r.node;
      } catch (e) {
        setError(e instanceof ApiError ? e.message : '复制文档失败');
        return null;
      }
    },
    [canWrite, selected, body, refreshTree, openNode],
  );

  /** Drag-drop move with explicit sortOrder (real API). */
  const dragMoveNode = useCallback(
    async (plan: {
      nodeId: string;
      parentId: string | null;
      sortOrder: number;
    }) => {
      if (!canWrite) return;
      try {
        const updated = await treeApi.move(
          plan.nodeId,
          plan.parentId,
          plan.sortOrder,
        );
        if (selected?.id === updated.id) setSelected(updated);
        setStatus('已拖拽移动');
        await refreshTree();
      } catch (e) {
        setError(e instanceof ApiError ? e.message : '拖拽移动失败');
      }
    },
    [canWrite, selected, refreshTree, setSelected],
  );

  const reorderSibling = useCallback(
    async (node: PublicNode, direction: SiblingReorderDirection) => {
      const plan = planSiblingReorder(nodes, node.id, direction);
      if (!plan.ok) {
        setStatus(plan.message);
        return;
      }
      try {
        for (const m of plan.moves) {
          await treeApi.move(m.id, m.parentId, m.sortOrder);
        }
        const items = await refreshTree();
        const me = items.find((n) => n.id === node.id);
        if (me && selected?.id === me.id) setSelected(me);
        setStatus(direction === 'up' ? '已上移' : '已下移');
      } catch (e) {
        setError(e instanceof ApiError ? e.message : '调整顺序失败');
      }
    },
    [nodes, refreshTree, selected, setSelected],
  );

  const confirmDelete = useCallback(async () => {
    if (!deleteTarget) return;
    setDeleteBusy(true);
    try {
      await treeApi.remove(deleteTarget.id);
      if (selected?.id === deleteTarget.id) {
        setSelected(null);
        setBody('');
        setVersion(null);
        setShare(null);
      }
      setStatus(`已移入回收站「${deleteTarget.title}」`);
      setDeleteTarget(null);
      await refreshTree();
      if (trashOpen) await loadTrash();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : '删除失败');
    } finally {
      setDeleteBusy(false);
    }
  }, [
    deleteTarget,
    selected,
    refreshTree,
    trashOpen,
    loadTrash,
    setSelected,
    setBody,
    setVersion,
    setShare,
  ]);

  const restoreTrashItem = useCallback(
    async (nodeId: string, title: string) => {
      if (!canWrite) return;
      setRestoringId(nodeId);
      try {
        const restored = await treeApi.restore(nodeId);
        setStatus(
          restored.parentId
            ? `已恢复「${title}」`
            : `已恢复「${title}」到库根（原父节点不可用）`,
        );
        const items = await refreshTree();
        await loadTrash();
        if (restored.type === 'doc') await openNode(restored, items);
        else setSelected(restored);
      } catch (e) {
        setError(e instanceof ApiError ? e.message : '恢复失败');
      } finally {
        setRestoringId(null);
      }
    },
    [canWrite, refreshTree, loadTrash, openNode, setSelected],
  );

  const confirmPurge = useCallback(async () => {
    if (!purgeTarget || !canWrite) return;
    setPurgeBusy(true);
    setPurgingId(purgeTarget.id);
    try {
      await treeApi.purge(purgeTarget.id);
      setStatus(`已永久删除「${purgeTarget.title}」`);
      setPurgeTarget(null);
      await loadTrash();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : '永久删除失败');
    } finally {
      setPurgeBusy(false);
      setPurgingId(null);
    }
  }, [purgeTarget, canWrite, loadTrash]);

  const confirmEmptyTrash = useCallback(async () => {
    if (!canWrite) return;
    setEmptyingTrash(true);
    try {
      const r = await treeApi.emptyTrash(kbId);
      setStatus(
        r.purgedCount > 0
          ? `已清空回收站（永久删除 ${r.purgedCount} 项）`
          : '回收站已为空',
      );
      setEmptyTrashConfirm(false);
      await loadTrash();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : '清空回收站失败');
    } finally {
      setEmptyingTrash(false);
    }
  }, [canWrite, kbId, loadTrash]);

  /** Export all docs in tree as a Markdown ZIP (members with read access). */
  const exportKbZip = useCallback(async () => {
    if (!kb || exportingZip) return;
    setExportingZip(true);
    setError(null);
    setStatus('正在导出知识库…');
    try {
      const tree = await treeApi.list(kbId);
      const items = tree.items;
      const paths = buildDocExportPaths(items);
      const files: ZipFileEntry[] = [];
      // Sequential fetch to avoid burst; small KBs are fine.
      for (const p of paths) {
        try {
          const c = await contentApi.get(p.nodeId);
          files.push({ path: p.path, body: c.bodyMd });
        } catch {
          files.push({
            path: p.path,
            body: `<!-- export failed for node ${p.nodeId} -->\n`,
          });
        }
      }
      const zip = buildMarkdownZip(files);
      downloadZipFile(kb.name || 'knowledge-base', zip);
      setStatus(
        paths.length
          ? `已导出 ${paths.length} 篇文档为 ZIP`
          : '已导出空知识库 ZIP',
      );
    } catch (e) {
      setError(e instanceof ApiError ? e.message : '导出知识库失败');
      setStatus(null);
    } finally {
      setExportingZip(false);
    }
  }, [kb, kbId, exportingZip]);

  const runSearch = useCallback(async () => {
    const q = searchQ.trim();
    if (!q) {
      setError('请输入搜索关键词');
      setSearchHits(null);
      return;
    }
    if (q.length > 200) {
      setError('搜索词不超过 200 字');
      return;
    }
    setSearching(true);
    setError(null);
    try {
      const data = await treeApi.search(kbId, q);
      setSearchHits(data.items);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : '搜索失败');
      setSearchHits(null);
    } finally {
      setSearching(false);
    }
  }, [searchQ, kbId]);

  const saveKbMeta = useCallback(
    async (input: { name: string; description: string | null }) => {
      if (!kb) return;
      setKbSaving(true);
      setError(null);
      try {
        const updated = await kbApi.update(kb.id, input);
        setKb(updated);
        setStatus('知识库信息已保存');
        setSettingsOpen(false);
      } catch (e) {
        setError(e instanceof ApiError ? e.message : '保存知识库失败');
      } finally {
        setKbSaving(false);
      }
    },
    [kb],
  );

  const enableShare = useCallback(
    async (preset: ShareExpiryPreset) => {
      if (!selected || selected.type !== 'doc') return;
      try {
        const expiresAt = expiresAtFromPreset(preset);
        const s = await shareApi.enable(
          selected.id,
          expiresAt === null ? { expiresAt: null } : { expiresAt },
        );
        setShare(s);
        setStatus('已开启分享');
      } catch (e) {
        setStatus(e instanceof ApiError ? e.message : '分享操作失败');
      }
    },
    [selected, setShare],
  );

  const disableShare = useCallback(async () => {
    if (!selected || selected.type !== 'doc') return;
    try {
      await shareApi.disable(selected.id);
      setShare({
        enabled: false,
        token: null,
        urlPath: null,
        expiresAt: null,
      });
      setStatus('已关闭分享');
    } catch (e) {
      setStatus(e instanceof ApiError ? e.message : '分享操作失败');
    }
  }, [selected, setShare]);

  const updateShareExpiry = useCallback(
    async (preset: ShareExpiryPreset) => {
      if (!selected || selected.type !== 'doc' || !share?.enabled) return;
      try {
        const expiresAt = expiresAtFromPreset(preset);
        const s = await shareApi.enable(selected.id, { expiresAt });
        setShare(s);
        setStatus('已更新分享有效期');
      } catch (e) {
        setStatus(e instanceof ApiError ? e.message : '更新有效期失败');
      }
    },
    [selected, share, setShare],
  );

  const loadRevisions = useCallback(async () => {
    if (!selected || selected.type !== 'doc') return;
    setRevisionsLoading(true);
    try {
      const r = await contentApi.listRevisions(selected.id);
      setRevisions(r.items);
      setHistoryOpen(true);
    } catch (e) {
      setStatus(e instanceof ApiError ? e.message : '加载历史快照失败');
    } finally {
      setRevisionsLoading(false);
    }
  }, [selected]);

  const openRevision = useCallback(
    async (id: string) => {
      if (!selected) return;
      try {
        const det = await contentApi.getRevision(selected.id, id);
        setRevisionPreview(det);
      } catch (e) {
        setStatus(e instanceof ApiError ? e.message : '打开快照失败');
      }
    },
    [selected],
  );

  const applyRevisionToEditor = useCallback(() => {
    if (!revisionPreview) return;
    setBody(revisionPreview.bodyMd);
    setRevisionPreview(null);
    setEditorMode('edit');
    setStatus(
      `已将快照 v${revisionPreview.version} 填入编辑器（未保存）`,
    );
  }, [revisionPreview, setBody, setEditorMode]);

  const deleteMessage = useMemo(() => {
    if (!deleteTarget) return '';
    return confirmDeleteNodeMessage(deleteTarget.title, deleteTarget.type);
  }, [deleteTarget]);

  const purgeMessage = useMemo(() => {
    if (!purgeTarget) return '';
    return confirmPurgeNodeMessage(purgeTarget.title, purgeTarget.type);
  }, [purgeTarget]);

  const emptyTrashMessage = useMemo(
    () => confirmEmptyTrashMessage(trashItems.length),
    [trashItems.length],
  );

  const expandAll = useCallback(() => setCollapsedIds(new Set()), [setCollapsedIds]);
  const collapseAll = useCallback(() => {
    setCollapsedIds(new Set(collectParentIdsWithChildren(nodes)));
  }, [nodes, setCollapsedIds]);

  const toggleCollapse = useCallback(
    (id: string) => {
      setCollapsedIds((prev) => toggleCollapsedId(prev, id));
    },
    [setCollapsedIds],
  );

  const docsExist = useMemo(
    () => nodes.some((n) => n.type === 'doc'),
    [nodes],
  );

  return {
    kb,
    nodes,
    loading,
    error,
    setError,
    status,
    setStatus,
    canWrite,
    docsExist,
    selected,
    body,
    setBody,
    version,
    share,
    docLoading,
    lastSavedBody,
    dirty,
    saving,
    conflict,
    editorMode,
    setEditorMode,
    save,
    reloadServer,
    overwrite,
    saveAsCopy,
    focusMode,
    setFocusMode,
    outlineOpen,
    setOutlineOpen,
    collapsedIds,
    toggleCollapse,
    expandAll,
    collapseAll,
    searchQ,
    setSearchQ,
    searchHits,
    searching,
    runSearch,
    clearSearch: () => {
      setSearchHits(null);
      setSearchQ('');
    },
    handleSelect,
    createNode,
    renameNode,
    moveNode,
    dragMoveNode,
    reorderSibling,
    duplicateDocument,
    duplicateOpenDoc,
    titleDraft,
    setTitleDraft,
    commitTitleDraft,
    renameNodeId,
    setRenameNodeId,
    // dialogs
    settingsOpen,
    setSettingsOpen,
    membersOpen,
    setMembersOpen,
    shareOpen,
    setShareOpen,
    historyOpen,
    setHistoryOpen,
    trashOpen,
    setTrashOpen,
    moveTarget,
    setMoveTarget,
    deleteTarget,
    setDeleteTarget,
    deleteBusy,
    deleteMessage,
    confirmDelete,
    purgeTarget,
    setPurgeTarget,
    purgeBusy,
    purgingId,
    purgeMessage,
    confirmPurge,
    emptyTrashConfirm,
    setEmptyTrashConfirm,
    emptyingTrash,
    emptyTrashMessage,
    confirmEmptyTrash,
    exportingZip,
    exportKbZip,
    saveKbMeta,
    kbSaving,
    enableShare,
    disableShare,
    updateShareExpiry,
    loadRevisions,
    revisions,
    revisionsLoading,
    revisionPreview,
    setRevisionPreview,
    openRevision,
    applyRevisionToEditor,
    trashItems,
    trashLoading,
    restoringId,
    restoreTrashItem,
    loadWorkspace,
    mobileSidebarOpen,
    setMobileSidebarOpen,
  };
}
