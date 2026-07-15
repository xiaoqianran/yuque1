import { useEffect, useMemo, useRef } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import { StatePanel } from '../components/StatePanel';
import { DeleteConfirmDialog } from '../components/workspace/DeleteConfirmDialog';
import { DocumentHeader } from '../components/workspace/DocumentHeader';
import { EmptyDocumentState } from '../components/workspace/EmptyDocumentState';
import { HistoryDrawer } from '../components/workspace/HistoryDrawer';
import { KnowledgeSettingsDialog } from '../components/workspace/KnowledgeSettingsDialog';
import { KnowledgeSidebar } from '../components/workspace/KnowledgeSidebar';
import { MarkdownEditor } from '../components/workspace/MarkdownEditor';
import { MarkdownPreview } from '../components/workspace/MarkdownPreview';
import { MembersDrawer } from '../components/workspace/MembersDrawer';
import { MoveNodeDialog } from '../components/workspace/MoveNodeDialog';
import { OutlinePanel } from '../components/workspace/OutlinePanel';
import { ShareDialog } from '../components/workspace/ShareDialog';
import { TrashDrawer } from '../components/workspace/TrashDrawer';
import { WorkspaceShell } from '../components/workspace/WorkspaceShell';
import { useKnowledgeWorkspace } from '../hooks/useKnowledgeWorkspace';
import {
  computeDocStats,
  downloadMarkdownFile,
  formatDocStats,
} from '../ui/docStats';
import { readFileAsText, validateImportFile } from '../ui/importMd';
import { extractOutline, scrollPreviewToHeading } from '../ui/markdown';
import { buildBreadcrumbPath } from '../ui/treeOps';
import { resolveViewPhase } from '../ui/viewState';

export function KbWorkspacePage() {
  const { kbId = '' } = useParams();
  const navigate = useNavigate();
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const previewRef = useRef<HTMLDivElement | null>(null);

  const ws = useKnowledgeWorkspace(kbId);

  const outline = useMemo(
    () => (ws.selected?.type === 'doc' ? extractOutline(ws.body) : []),
    [ws.selected?.type, ws.body],
  );
  const docStatsLabel = useMemo(
    () => formatDocStats(computeDocStats(ws.body)),
    [ws.body],
  );
  const breadcrumb = useMemo(
    () =>
      ws.selected
        ? buildBreadcrumbPath(ws.nodes, ws.selected.id)
        : [],
    [ws.nodes, ws.selected],
  );

  const saveLabel = (() => {
    if (ws.saving) return '保存中…';
    if (ws.conflict) return '版本冲突';
    if (ws.dirty) return '未保存';
    if (ws.version != null) return `已保存 v${ws.version}`;
    return '—';
  })();

  const saveTone =
    ws.saving ? 'saving' : ws.dirty || ws.conflict ? 'dirty' : 'default';

  useEffect(() => {
    if (!ws.mobileSidebarOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') ws.setMobileSidebarOpen(false);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [ws.mobileSidebarOpen, ws.setMobileSidebarOpen]);

  const loadPhase = resolveViewPhase({
    loading: ws.loading,
    error: ws.loading ? null : ws.error && !ws.kb ? ws.error : null,
    isEmpty: false,
  });

  if (loadPhase === 'loading') {
    return (
      <div className="editor-placeholder">
        <StatePanel
          phase="loading"
          title="正在打开知识库"
          description="加载元数据与文档树…"
        />
      </div>
    );
  }

  if (!ws.kb) {
    return (
      <div className="editor-placeholder">
        <StatePanel
          phase="error"
          title="无法打开知识库"
          description={ws.error ?? '资源不存在或无权限'}
          action={
            <div className="row">
              <Link className="btn secondary small" to="/">
                返回列表
              </Link>
              <button
                type="button"
                className="btn primary small"
                onClick={() => void ws.loadWorkspace()}
              >
                重试
              </button>
            </div>
          }
        />
      </div>
    );
  }

  async function importMarkdownFile(file: File) {
    if (!ws.selected || ws.selected.type !== 'doc' || !ws.canWrite) return;
    const check = validateImportFile(file);
    if (!check.ok) {
      ws.setStatus(check.message);
      return;
    }
    if (ws.dirty) {
      // use delete dialog pattern: simple confirm via status for import
      // dedicated flow: overwrite local editor only
    }
    try {
      const text = await readFileAsText(file);
      ws.setBody(text);
      ws.setEditorMode('edit');
      ws.setStatus(`已导入「${file.name}」（未保存，请保存或等待自动保存）`);
    } catch {
      ws.setStatus('读取文件失败');
    }
  }

  async function copyBody() {
    try {
      await navigator.clipboard.writeText(ws.body);
      ws.setStatus('正文已复制到剪贴板');
    } catch {
      ws.setStatus('复制失败：浏览器未授权剪贴板');
    }
  }

  return (
    <WorkspaceShell focusMode={ws.focusMode}>
      <div className="ws-body">
        {!ws.focusMode && ws.mobileSidebarOpen && (
          <button
            type="button"
            className="ws-sidebar-scrim"
            aria-label="关闭文档目录"
            onClick={() => ws.setMobileSidebarOpen(false)}
          />
        )}
        {!ws.focusMode && (
          <KnowledgeSidebar
            kb={ws.kb}
            nodes={ws.nodes}
            selectedId={ws.selected?.id ?? null}
            collapsedIds={ws.collapsedIds}
            canWrite={ws.canWrite}
            mobileOpen={ws.mobileSidebarOpen}
            onMobileClose={() => ws.setMobileSidebarOpen(false)}
            searchQ={ws.searchQ}
            onSearchQChange={ws.setSearchQ}
            onSearch={() => void ws.runSearch()}
            searching={ws.searching}
            searchHits={ws.searchHits}
            onClearSearch={ws.clearSearch}
            onSelect={(n) => void ws.handleSelect(n)}
            onToggleCollapse={ws.toggleCollapse}
            onCreate={(type) => void ws.createNode(type)}
            onCreateUnder={(type, ctx) =>
              void ws.createNode(type, { contextNode: ctx })
            }
            onRename={(node, title) => void ws.renameNode(node, title)}
            onMoveRequest={(node) => ws.setMoveTarget(node)}
            onReorder={(node, dir) => void ws.reorderSibling(node, dir)}
            onDeleteRequest={(node) => ws.setDeleteTarget(node)}
            onDuplicateRequest={(node) => void ws.duplicateDocument(node)}
            onDragMove={(plan) => void ws.dragMoveNode(plan)}
            renameNodeId={ws.renameNodeId}
            onRenameNodeIdChange={ws.setRenameNodeId}
            onKbMenu={(action) => {
              switch (action) {
                case 'settings':
                  ws.setSettingsOpen(true);
                  break;
                case 'members':
                  ws.setMembersOpen(true);
                  break;
                case 'trash':
                  ws.setTrashOpen(true);
                  break;
                case 'expand-all':
                  ws.expandAll();
                  break;
                case 'collapse-all':
                  ws.collapseAll();
                  break;
                case 'back':
                  navigate('/');
                  break;
              }
            }}
          />
        )}

        <section className="ws-main" aria-label="文档工作区">
          {!ws.focusMode && (
            <div className="ws-mobile-nav">
              <button
                type="button"
                className="ws-btn"
                aria-label="打开文档目录"
                aria-expanded={ws.mobileSidebarOpen}
                aria-controls="ws-knowledge-sidebar"
                title="文档目录"
                onClick={() => ws.setMobileSidebarOpen(true)}
              >
                <Menu size={16} aria-hidden />
                目录
              </button>
              <span className="ws-mobile-nav-kb" title={ws.kb.name}>
                {ws.kb.name}
              </span>
              {ws.mobileSidebarOpen && (
                <button
                  type="button"
                  className="ws-icon-btn"
                  aria-label="关闭文档目录"
                  onClick={() => ws.setMobileSidebarOpen(false)}
                >
                  <X size={18} />
                </button>
              )}
            </div>
          )}
          {ws.error && ws.kb && (
            <p className="form-msg form-msg--error" role="alert" style={{ margin: '8px 16px' }}>
              {ws.error}
            </p>
          )}

          {/* Empty knowledge base */}
          {!ws.docsExist && !ws.selected && (
            <EmptyDocumentState
              canWrite={ws.canWrite}
              onCreateDoc={() => void ws.createNode('doc')}
            />
          )}

          {/* Has docs but none selected yet (brief) or folder selected */}
          {ws.docsExist && !ws.selected && (
            <div className="ws-empty">
              <h2>选择文档</h2>
              <p>在左侧文档树中选择一篇文档开始阅读或编辑。</p>
            </div>
          )}

          {ws.selected?.type === 'folder' && (
            <div className="ws-folder-empty">
              <h2>{ws.selected.title}</h2>
              <p className="muted">这是文件夹。可在侧栏新建文档或子文件夹。</p>
              {ws.canWrite && (
                <div className="row" style={{ gap: 8, marginTop: 12 }}>
                  <button
                    type="button"
                    className="ws-btn ws-btn--primary"
                    onClick={() => void ws.createNode('doc')}
                  >
                    在此新建文档
                  </button>
                  <button
                    type="button"
                    className="ws-btn"
                    onClick={() => void ws.createNode('folder')}
                  >
                    新建子文件夹
                  </button>
                </div>
              )}
            </div>
          )}

          {ws.selected?.type === 'doc' && (
            <>
              <DocumentHeader
                title={ws.titleDraft}
                breadcrumb={breadcrumb}
                canWrite={ws.canWrite}
                saveLabel={saveLabel}
                saveTone={saveTone}
                editorMode={ws.editorMode}
                onEditorModeChange={ws.setEditorMode}
                onTitleChange={ws.setTitleDraft}
                onTitleCommit={() => void ws.commitTitleDraft()}
                onShare={() => ws.setShareOpen(true)}
                focusMode={ws.focusMode}
                onMenuAction={(action) => {
                  switch (action) {
                    case 'import':
                      importInputRef.current?.click();
                      break;
                    case 'export':
                      downloadMarkdownFile(
                        ws.selected?.title || 'untitled',
                        ws.body,
                      );
                      break;
                    case 'copy':
                      void copyBody();
                      break;
                    case 'duplicate':
                      if (ws.selected) void ws.duplicateDocument(ws.selected);
                      break;
                    case 'history':
                      void ws.loadRevisions();
                      break;
                    case 'focus':
                      ws.setFocusMode((v) => {
                        const next = !v;
                        if (next) ws.setOutlineOpen(false);
                        return next;
                      });
                      break;
                    case 'outline':
                      ws.setOutlineOpen((v) => !v);
                      break;
                    case 'delete':
                      if (ws.selected) ws.setDeleteTarget(ws.selected);
                      break;
                  }
                }}
              />

              <input
                ref={importInputRef}
                type="file"
                accept=".md,.markdown,.txt,text/markdown,text/plain"
                className="sr-only"
                aria-hidden
                tabIndex={-1}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  e.target.value = '';
                  if (f) void importMarkdownFile(f);
                }}
              />

              {ws.status && <p className="ws-status-line">{ws.status}</p>}
              <p className="ws-doc-stats" aria-live="polite">
                {docStatsLabel}
                {ws.dirty ? ' · 未保存' : ''}
              </p>

              {ws.conflict && (
                <div className="ws-conflict" role="alert">
                  <strong>版本冲突</strong>
                  <span className="muted">
                    服务器版本 v{ws.conflict.serverVersion}
                  </span>
                  <button
                    type="button"
                    className="ws-btn"
                    onClick={() => void ws.reloadServer()}
                  >
                    加载最新
                  </button>
                  <button
                    type="button"
                    className="ws-btn ws-btn--primary"
                    onClick={() => void ws.overwrite()}
                  >
                    强制覆盖
                  </button>
                  <button
                    type="button"
                    className="ws-btn"
                    onClick={() => void ws.saveAsCopy()}
                  >
                    另存副本
                  </button>
                </div>
              )}

              <div className="ws-editor-surface">
                {ws.docLoading ? (
                  <StatePanel
                    phase="loading"
                    title="加载正文"
                    description="读取文档内容与版本…"
                  />
                ) : (
                  <div className="ws-editor-row">
                    <div className="ws-editor-center">
                      <div className="ws-editor-column">
                        {ws.editorMode === 'edit' ? (
                          <MarkdownEditor
                            value={ws.body}
                            onChange={ws.setBody}
                            readOnly={!ws.canWrite}
                            onSave={() => void ws.save({ auto: false })}
                          />
                        ) : (
                          <MarkdownPreview
                            ref={previewRef}
                            source={ws.body}
                          />
                        )}
                      </div>
                    </div>
                    {!ws.focusMode && (
                      <OutlinePanel
                        items={outline}
                        open={ws.outlineOpen}
                        onJump={(item) => {
                          if (ws.editorMode === 'preview') {
                            scrollPreviewToHeading(
                              previewRef.current,
                              item.id,
                            );
                          } else {
                            ws.setEditorMode('preview');
                            requestAnimationFrame(() => {
                              scrollPreviewToHeading(
                                previewRef.current,
                                item.id,
                              );
                            });
                          }
                        }}
                      />
                    )}
                  </div>
                )}
              </div>
            </>
          )}
        </section>
      </div>

      <KnowledgeSettingsDialog
        open={ws.settingsOpen}
        kb={ws.kb}
        canEdit={ws.canWrite}
        saving={ws.kbSaving}
        onClose={() => ws.setSettingsOpen(false)}
        onSave={ws.saveKbMeta}
      />

      <MembersDrawer
        open={ws.membersOpen}
        kb={ws.kb}
        onClose={() => ws.setMembersOpen(false)}
        onOwnershipTransferred={() => void ws.loadWorkspace()}
      />

      <ShareDialog
        open={ws.shareOpen}
        share={ws.share}
        canWrite={ws.canWrite}
        onClose={() => ws.setShareOpen(false)}
        onEnable={ws.enableShare}
        onDisable={ws.disableShare}
        onUpdateExpiry={ws.updateShareExpiry}
      />

      <HistoryDrawer
        open={ws.historyOpen}
        loading={ws.revisionsLoading}
        items={ws.revisions}
        preview={ws.revisionPreview}
        onClose={() => {
          ws.setHistoryOpen(false);
          ws.setRevisionPreview(null);
        }}
        onRefresh={() => void ws.loadRevisions()}
        onSelect={(id) => void ws.openRevision(id)}
        onApply={ws.applyRevisionToEditor}
        onClearPreview={() => ws.setRevisionPreview(null)}
      />

      <TrashDrawer
        open={ws.trashOpen}
        items={ws.trashItems}
        loading={ws.trashLoading}
        canWrite={ws.canWrite}
        restoringId={ws.restoringId}
        purgingId={ws.purgingId}
        onClose={() => ws.setTrashOpen(false)}
        onRestore={(id, title) => void ws.restoreTrashItem(id, title)}
        onPurgeRequest={(node) => ws.setPurgeTarget(node)}
      />

      <MoveNodeDialog
        open={ws.moveTarget != null}
        node={ws.moveTarget}
        nodes={ws.nodes}
        onClose={() => ws.setMoveTarget(null)}
        onMove={(parentId) => {
          if (ws.moveTarget) void ws.moveNode(ws.moveTarget, parentId);
        }}
      />

      <DeleteConfirmDialog
        open={ws.deleteTarget != null}
        title="确认删除"
        message={ws.deleteMessage}
        busy={ws.deleteBusy}
        onCancel={() => ws.setDeleteTarget(null)}
        onConfirm={() => void ws.confirmDelete()}
      />

      <DeleteConfirmDialog
        open={ws.purgeTarget != null}
        title="永久删除"
        message={ws.purgeMessage}
        confirmLabel="永久删除"
        busy={ws.purgeBusy}
        onCancel={() => ws.setPurgeTarget(null)}
        onConfirm={() => void ws.confirmPurge()}
      />
    </WorkspaceShell>
  );
}
