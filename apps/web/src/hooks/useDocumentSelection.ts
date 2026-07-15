import { useCallback, useRef, useState } from 'react';
import { contentApi, shareApi } from '../api/endpoints';
import { ApiError } from '../api/types';
import type { PublicNode, ShareInfo } from '../api/types';
import {
  loadLastOpenedDocId,
  saveLastOpenedDocId,
} from '../ui/lastOpenedDoc';
import {
  filterRecentIds,
  loadRecentDocIds,
  recordRecentDoc,
  saveRecentDocIds,
} from '../ui/recentDocs';
import {
  collectAncestorIds,
  expandAncestorsInCollapsed,
  pickDefaultDocument,
} from '../ui/treeOps';

export function useDocumentSelection(kbId: string) {
  const [selected, setSelected] = useState<PublicNode | null>(null);
  const [body, setBody] = useState('');
  const [version, setVersion] = useState<number | null>(null);
  const [share, setShare] = useState<ShareInfo | null>(null);
  const [docLoading, setDocLoading] = useState(false);
  const [lastSavedBody, setLastSavedBody] = useState<string | null>(null);
  const [recentIds, setRecentIds] = useState<string[]>([]);
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(
    () => new Set(),
  );
  const openSeq = useRef(0);

  const syncRecentFromNodes = useCallback(
    (nodes: PublicNode[]) => {
      if (nodes.length === 0) return;
      const valid = new Set(
        nodes.filter((n) => n.type === 'doc').map((n) => n.id),
      );
      setRecentIds((prev) => {
        const next = filterRecentIds(prev, valid);
        if (
          next.length !== prev.length ||
          next.some((id, i) => id !== prev[i])
        ) {
          saveRecentDocIds(kbId, next);
          return next;
        }
        return prev;
      });
    },
    [kbId],
  );

  const initRecent = useCallback(() => {
    setRecentIds(loadRecentDocIds(kbId));
  }, [kbId]);

  const openNode = useCallback(
    async (n: PublicNode, nodes: PublicNode[]) => {
      const seq = ++openSeq.current;
      setSelected(n);
      setShare(null);
      setLastSavedBody(null);
      setCollapsedIds((prev) =>
        expandAncestorsInCollapsed(prev, collectAncestorIds(nodes, n.id)),
      );

      if (n.type === 'doc') {
        setRecentIds(recordRecentDoc(kbId, n.id));
        saveLastOpenedDocId(kbId, n.id);
      }

      if (n.type !== 'doc') {
        setBody('');
        setVersion(null);
        setDocLoading(false);
        return;
      }

      setDocLoading(true);
      try {
        const c = await contentApi.get(n.id);
        if (seq !== openSeq.current) return;
        setBody(c.bodyMd);
        setVersion(c.version);
        setLastSavedBody(c.bodyMd);
        try {
          const s = await shareApi.get(n.id);
          if (seq !== openSeq.current) return;
          setShare(s);
        } catch {
          if (seq !== openSeq.current) return;
          setShare(null);
        }
      } catch (e) {
        if (seq !== openSeq.current) return;
        throw e instanceof ApiError ? e : new Error('打开文档失败');
      } finally {
        if (seq === openSeq.current) setDocLoading(false);
      }
    },
    [kbId],
  );

  const openDefaultDocument = useCallback(
    async (nodes: PublicNode[]) => {
      const last = loadLastOpenedDocId(kbId);
      const recent = loadRecentDocIds(kbId);
      const target = pickDefaultDocument(nodes, {
        lastOpenedId: last,
        recentIds: recent,
      });
      if (target) {
        await openNode(target, nodes);
      }
    },
    [kbId, openNode],
  );

  return {
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
    recentIds,
    setRecentIds,
    collapsedIds,
    setCollapsedIds,
    openNode,
    openDefaultDocument,
    initRecent,
    syncRecentFromNodes,
    openSeq,
  };
}
