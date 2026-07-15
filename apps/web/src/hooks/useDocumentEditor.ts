import { useCallback, useState } from 'react';
import { contentApi } from '../api/endpoints';
import { ApiError } from '../api/types';
import type { PublicNode } from '../api/types';
import { isDirty } from '../ui/autosave';

export function useDocumentEditor(opts: {
  selected: PublicNode | null;
  body: string;
  setBody: (b: string) => void;
  version: number | null;
  setVersion: (v: number | null) => void;
  lastSavedBody: string | null;
  setLastSavedBody: (b: string | null) => void;
  canWrite: boolean;
  setStatus: (s: string | null) => void;
  onSaveAsCopyOpened?: (node: PublicNode) => void;
  refreshTree: () => Promise<void>;
}) {
  const {
    selected,
    body,
    setBody,
    version,
    setVersion,
    lastSavedBody,
    setLastSavedBody,
    canWrite,
    setStatus,
    onSaveAsCopyOpened,
    refreshTree,
  } = opts;

  const [saving, setSaving] = useState(false);
  const [conflict, setConflict] = useState<{ serverVersion: number } | null>(
    null,
  );
  const [editorMode, setEditorMode] = useState<'edit' | 'preview'>('edit');

  const dirty = isDirty(body, lastSavedBody);

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
        setStatus(
          auto ? `已自动保存 v${meta.version}` : `已保存 v${meta.version}`,
        );
        setConflict(null);
      } catch (e) {
        if (e instanceof ApiError && e.code === 'DOC_VERSION_CONFLICT') {
          const serverVersion = Number(
            (e.details as { serverVersion?: number } | null)?.serverVersion ??
              0,
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
    [
      selected,
      version,
      body,
      canWrite,
      conflict,
      setStatus,
      setVersion,
      setLastSavedBody,
    ],
  );

  const reloadServer = useCallback(async () => {
    if (!selected || selected.type !== 'doc') return;
    const c = await contentApi.get(selected.id);
    setBody(c.bodyMd);
    setVersion(c.version);
    setLastSavedBody(c.bodyMd);
    setConflict(null);
    setStatus(`已加载服务器 v${c.version}`);
  }, [
    selected,
    setBody,
    setVersion,
    setLastSavedBody,
    setStatus,
  ]);

  const overwrite = useCallback(async () => {
    if (!selected || !conflict) return;
    const meta = await contentApi.overwrite(
      selected.id,
      conflict.serverVersion,
      body,
    );
    setVersion(meta.version);
    setLastSavedBody(body);
    setConflict(null);
    setStatus(`已覆盖保存 v${meta.version}`);
  }, [
    selected,
    conflict,
    body,
    setVersion,
    setLastSavedBody,
    setStatus,
  ]);

  const saveAsCopy = useCallback(async () => {
    if (!selected) return;
    const r = await contentApi.saveAs(selected.id, body);
    setConflict(null);
    await refreshTree();
    onSaveAsCopyOpened?.(r.node);
    setStatus('已另存为新文档');
  }, [selected, body, refreshTree, onSaveAsCopyOpened, setStatus]);

  return {
    saving,
    setSaving,
    conflict,
    setConflict,
    editorMode,
    setEditorMode,
    dirty,
    save,
    reloadServer,
    overwrite,
    saveAsCopy,
  };
}
