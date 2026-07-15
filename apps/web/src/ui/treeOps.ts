import type { PublicNode } from '../api/types';

/** Validate search query for GET /kbs/:id/nodes?q= (OpenAPI min 1, max 200). */
export function normalizeSearchQuery(raw: string):
  | { ok: true; q: string }
  | { ok: false; message: string } {
  const q = raw.trim();
  if (!q) return { ok: false, message: '请输入搜索关键词' };
  if (q.length > 200) return { ok: false, message: '搜索词不超过 200 字' };
  return { ok: true, q };
}

/**
 * Parent options for move: library root + all nodes except self.
 * (Cycle prevention remains server-side.)
 */
export function buildMoveParentOptions(
  nodes: PublicNode[],
  movingId: string,
): { value: string; label: string }[] {
  const opts: { value: string; label: string }[] = [
    { value: '', label: '库根（无父节点）' },
  ];
  for (const n of nodes) {
    if (n.id === movingId) continue;
    const kind = n.type === 'folder' ? '文件夹' : '文档';
    opts.push({ value: n.id, label: `${kind} · ${n.title}` });
  }
  return opts;
}

export function normalizeRenameTitle(raw: string):
  | { ok: true; title: string }
  | { ok: false; message: string } {
  const title = raw.trim();
  if (!title) return { ok: false, message: '标题不能为空' };
  if (title.length > 512) return { ok: false, message: '标题不超过 512 字' };
  return { ok: true, title };
}

/** Knowledge base name: non-empty, max 128 (OpenAPI / Design-01). */
export function normalizeKbName(raw: string):
  | { ok: true; name: string }
  | { ok: false; message: string } {
  const name = raw.trim();
  if (!name) return { ok: false, message: '知识库名称不能为空' };
  if (name.length > 128) return { ok: false, message: '知识库名称不超过 128 字' };
  return { ok: true, name };
}

/** KB description optional; max 2000. */
export function normalizeKbDescription(
  raw: string | null | undefined,
):
  | { ok: true; description: string | null }
  | { ok: false; message: string } {
  if (raw == null) return { ok: true, description: null };
  if (raw.length > 2000) {
    return { ok: false, message: '简介不超过 2000 字' };
  }
  const t = raw.trim();
  return { ok: true, description: t || null };
}

/** Same ordering as the workspace tree (sortOrder, then title). */
export function compareSiblingOrder(a: PublicNode, b: PublicNode): number {
  return a.sortOrder - b.sortOrder || a.title.localeCompare(b.title);
}

export type SiblingReorderDirection = 'up' | 'down';

export type SiblingReorderPlan =
  | {
      ok: true;
      /** Two move calls: swap sortOrder under the same parent. */
      moves: [
        { id: string; parentId: string | null; sortOrder: number },
        { id: string; parentId: string | null; sortOrder: number },
      ];
    }
  | {
      ok: false;
      reason: 'not_found' | 'already_first' | 'already_last' | 'no_siblings';
      message: string;
    };

/**
 * Plan swapping sortOrder with the adjacent sibling (up = earlier in list).
 * Does not mutate; caller applies via POST /nodes/{id}/move.
 */
export function planSiblingReorder(
  nodes: PublicNode[],
  nodeId: string,
  direction: SiblingReorderDirection,
): SiblingReorderPlan {
  const self = nodes.find((n) => n.id === nodeId);
  if (!self) {
    return { ok: false, reason: 'not_found', message: '节点不存在' };
  }
  const siblings = nodes
    .filter((n) => n.parentId === self.parentId)
    .slice()
    .sort(compareSiblingOrder);
  if (siblings.length < 2) {
    return {
      ok: false,
      reason: 'no_siblings',
      message: '没有可调整顺序的同级节点',
    };
  }
  const idx = siblings.findIndex((n) => n.id === nodeId);
  if (idx < 0) {
    return { ok: false, reason: 'not_found', message: '节点不存在' };
  }
  if (direction === 'up' && idx === 0) {
    return { ok: false, reason: 'already_first', message: '已在同级最前' };
  }
  if (direction === 'down' && idx === siblings.length - 1) {
    return { ok: false, reason: 'already_last', message: '已在同级最后' };
  }
  const neighbor = siblings[direction === 'up' ? idx - 1 : idx + 1]!;
  return {
    ok: true,
    moves: [
      {
        id: self.id,
        parentId: self.parentId,
        sortOrder: neighbor.sortOrder,
      },
      {
        id: neighbor.id,
        parentId: neighbor.parentId,
        sortOrder: self.sortOrder,
      },
    ],
  };
}

/** Whether the node can move up/down among siblings (for button disabled). */
export function siblingReorderAvailability(
  nodes: PublicNode[],
  nodeId: string,
): { canUp: boolean; canDown: boolean } {
  return {
    canUp: planSiblingReorder(nodes, nodeId, 'up').ok,
    canDown: planSiblingReorder(nodes, nodeId, 'down').ok,
  };
}

/** Ancestor node ids from root→parent of `nodeId` (does not include self). */
export function collectAncestorIds(
  nodes: PublicNode[],
  nodeId: string,
): string[] {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const chain: string[] = [];
  let cur = byId.get(nodeId);
  const guard = new Set<string>();
  while (cur?.parentId) {
    if (guard.has(cur.parentId)) break;
    guard.add(cur.parentId);
    chain.unshift(cur.parentId);
    cur = byId.get(cur.parentId);
  }
  return chain;
}

/** Remove ancestor ids from a collapsed set so the path is visible. */
export function expandAncestorsInCollapsed(
  collapsed: ReadonlySet<string>,
  ancestorIds: string[],
): Set<string> {
  const next = new Set(collapsed);
  for (const id of ancestorIds) next.delete(id);
  return next;
}

export function toggleCollapsedId(
  collapsed: ReadonlySet<string>,
  nodeId: string,
): Set<string> {
  const next = new Set(collapsed);
  if (next.has(nodeId)) next.delete(nodeId);
  else next.add(nodeId);
  return next;
}
