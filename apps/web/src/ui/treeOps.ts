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

/** Ids of nodes that currently have at least one child (collapsible). */
export function collectParentIdsWithChildren(nodes: PublicNode[]): string[] {
  const counts = new Map<string, number>();
  for (const n of nodes) {
    if (!n.parentId) continue;
    counts.set(n.parentId, (counts.get(n.parentId) ?? 0) + 1);
  }
  return [...counts.keys()];
}

/**
 * Resolve parent for a new node (folder or doc).
 * - Selected folder → create inside that folder
 * - Selected doc → create as sibling (same parent)
 * - Nothing selected → library root
 *
 * Documents are leaves for *new* creates only; historical doc subtrees still render.
 */
export function resolveCreateParentId(
  selected: Pick<PublicNode, 'id' | 'type' | 'parentId'> | null | undefined,
): string | null {
  if (!selected) return null;
  if (selected.type === 'folder') return selected.id;
  return selected.parentId ?? null;
}

/** Build parentId → sorted children map for tree rendering. */
export function buildChildrenMap(
  nodes: PublicNode[],
): Map<string | null, PublicNode[]> {
  const map = new Map<string | null, PublicNode[]>();
  for (const n of nodes) {
    const key = n.parentId;
    const list = map.get(key) ?? [];
    list.push(n);
    map.set(key, list);
  }
  for (const list of map.values()) {
    list.sort(compareSiblingOrder);
  }
  return map;
}

/**
 * Default document to open when entering a knowledge base.
 * Priority: lastOpenedId (if still a doc) → first recent valid doc → first doc in tree order → null.
 */
export function pickDefaultDocument(
  nodes: PublicNode[],
  opts?: {
    lastOpenedId?: string | null;
    recentIds?: readonly string[];
  },
): PublicNode | null {
  const docs = nodes.filter((n) => n.type === 'doc');
  if (docs.length === 0) return null;
  const byId = new Map(docs.map((d) => [d.id, d]));

  const last = opts?.lastOpenedId?.trim();
  if (last && byId.has(last)) return byId.get(last)!;

  for (const id of opts?.recentIds ?? []) {
    const hit = byId.get(id);
    if (hit) return hit;
  }

  // First document in DFS tree order (root → children by sortOrder)
  const childMap = buildChildrenMap(nodes);
  const stack: PublicNode[] = [...(childMap.get(null) ?? [])].reverse();
  while (stack.length) {
    const n = stack.pop()!;
    if (n.type === 'doc') return n;
    const kids = childMap.get(n.id) ?? [];
    for (let i = kids.length - 1; i >= 0; i--) stack.push(kids[i]!);
  }
  return docs[0] ?? null;
}

/** Breadcrumb path from root to node (inclusive). */
export function buildBreadcrumbPath(
  nodes: PublicNode[],
  nodeId: string,
): PublicNode[] {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const path: PublicNode[] = [];
  let cur = byId.get(nodeId);
  const guard = new Set<string>();
  while (cur) {
    if (guard.has(cur.id)) break;
    guard.add(cur.id);
    path.unshift(cur);
    cur = cur.parentId ? byId.get(cur.parentId) : undefined;
  }
  return path;
}

/**
 * Visible tree order (DFS) respecting collapsed folders.
 * Used for keyboard ArrowUp/ArrowDown selection.
 */
export function flattenVisibleTree(
  nodes: PublicNode[],
  collapsedIds: ReadonlySet<string>,
): PublicNode[] {
  const childMap = buildChildrenMap(nodes);
  const out: PublicNode[] = [];
  function walk(parentId: string | null) {
    const kids = childMap.get(parentId) ?? [];
    for (const n of kids) {
      out.push(n);
      const hasKids = (childMap.get(n.id) ?? []).length > 0;
      if (hasKids && !collapsedIds.has(n.id)) {
        walk(n.id);
      }
    }
  }
  walk(null);
  return out;
}

/**
 * Next/previous node in visible tree order.
 * direction: 1 = down, -1 = up.
 */
export function adjacentVisibleNode(
  nodes: PublicNode[],
  collapsedIds: ReadonlySet<string>,
  selectedId: string | null,
  direction: 1 | -1,
): PublicNode | null {
  const visible = flattenVisibleTree(nodes, collapsedIds);
  if (visible.length === 0) return null;
  if (!selectedId) {
    return direction === 1 ? visible[0]! : visible[visible.length - 1]!;
  }
  const idx = visible.findIndex((n) => n.id === selectedId);
  if (idx < 0) {
    return direction === 1 ? visible[0]! : visible[visible.length - 1]!;
  }
  const next = idx + direction;
  if (next < 0 || next >= visible.length) return visible[idx]!;
  return visible[next]!;
}

export type TreeDropPosition = 'before' | 'after' | 'inside';

export type TreeDropPlan =
  | {
      ok: true;
      nodeId: string;
      parentId: string | null;
      sortOrder: number;
    }
  | {
      ok: false;
      reason:
        | 'not_found'
        | 'same_node'
        | 'cycle'
        | 'noop'
        | 'invalid_inside';
      message: string;
    };

/** True if `ancestorId` is an ancestor of `nodeId` (or equal). */
export function isAncestorOf(
  nodes: PublicNode[],
  ancestorId: string,
  nodeId: string,
): boolean {
  if (ancestorId === nodeId) return true;
  const byId = new Map(nodes.map((n) => [n.id, n]));
  let cur = byId.get(nodeId);
  const guard = new Set<string>();
  while (cur?.parentId) {
    if (cur.parentId === ancestorId) return true;
    if (guard.has(cur.parentId)) break;
    guard.add(cur.parentId);
    cur = byId.get(cur.parentId);
  }
  return false;
}

function siblingsUnder(
  nodes: PublicNode[],
  parentId: string | null,
  excludeId?: string,
): PublicNode[] {
  return nodes
    .filter(
      (n) =>
        n.parentId === parentId && (excludeId === undefined || n.id !== excludeId),
    )
    .slice()
    .sort(compareSiblingOrder);
}

/**
 * Compute sortOrder to insert at `index` among already-sorted siblings
 * (excluding the moving node). index 0 = first.
 */
export function sortOrderAtIndex(
  siblings: PublicNode[],
  index: number,
): number {
  if (siblings.length === 0) return 1000;
  if (index <= 0) {
    return siblings[0]!.sortOrder - 1000;
  }
  if (index >= siblings.length) {
    return siblings[siblings.length - 1]!.sortOrder + 1000;
  }
  const prev = siblings[index - 1]!.sortOrder;
  const next = siblings[index]!.sortOrder;
  if (next - prev > 1) {
    return Math.floor((prev + next) / 2);
  }
  // Collapsed spacing — place after prev; server accepts any int.
  return prev + 1;
}

/**
 * Map a raw insert index in the full sibling list (including active)
 * to an index in the list with active removed.
 */
function insertIndexExcludingActive(
  fullSibs: PublicNode[],
  rawIndex: number,
  activeId: string,
): number {
  let count = 0;
  const limit = Math.max(0, Math.min(rawIndex, fullSibs.length));
  for (let i = 0; i < limit; i++) {
    if (fullSibs[i]!.id !== activeId) count += 1;
  }
  return count;
}

/**
 * Plan a tree drag-drop move against real POST /nodes/:id/move.
 *
 * - inside folder → parent = folder, append
 * - inside doc → treated as after that doc (sibling; docs stay leaves for drop UX)
 * - before/after → same parent as over, reordered among siblings
 * - cycle prevention when new parent is under active subtree
 */
export function planTreeDrop(
  nodes: PublicNode[],
  activeId: string,
  overId: string,
  position: TreeDropPosition,
): TreeDropPlan {
  const active = nodes.find((n) => n.id === activeId);
  const over = nodes.find((n) => n.id === overId);
  if (!active || !over) {
    return { ok: false, reason: 'not_found', message: '节点不存在' };
  }
  if (activeId === overId) {
    return { ok: false, reason: 'same_node', message: '不能拖到自身' };
  }

  let parentId: string | null;
  let insertIndex: number;

  if (position === 'inside' && over.type === 'folder') {
    parentId = over.id;
    insertIndex = siblingsUnder(nodes, parentId, activeId).length;
  } else if (position === 'inside' && over.type === 'doc') {
    // Drop onto a document → become sibling after it (not child)
    parentId = over.parentId;
    const fullSibs = siblingsUnder(nodes, parentId);
    const oi = fullSibs.findIndex((n) => n.id === overId);
    const raw = oi < 0 ? fullSibs.length : oi + 1;
    insertIndex = insertIndexExcludingActive(fullSibs, raw, activeId);
  } else {
    // before / after (or inside coerced above)
    parentId = over.parentId;
    const fullSibs = siblingsUnder(nodes, parentId);
    const oi = fullSibs.findIndex((n) => n.id === overId);
    if (oi < 0) {
      return { ok: false, reason: 'not_found', message: '目标节点不存在' };
    }
    const raw = position === 'before' ? oi : oi + 1;
    insertIndex = insertIndexExcludingActive(fullSibs, raw, activeId);
  }

  // Cycle: new parent must not be under active (or equal)
  if (parentId != null && isAncestorOf(nodes, activeId, parentId)) {
    return {
      ok: false,
      reason: 'cycle',
      message: '不能移动到自己的子树内',
    };
  }

  const targetSiblings = siblingsUnder(nodes, parentId, activeId);
  const sortOrder = sortOrderAtIndex(targetSiblings, insertIndex);

  // No-op: same parent and same visual index among siblings
  if (active.parentId === parentId) {
    const currentSibs = siblingsUnder(nodes, parentId);
    const curIdx = currentSibs.findIndex((n) => n.id === activeId);
    if (curIdx >= 0 && insertIndex === curIdx) {
      return { ok: false, reason: 'noop', message: '位置未变化' };
    }
  }

  return {
    ok: true,
    nodeId: activeId,
    parentId,
    sortOrder,
  };
}

/**
 * Infer drop position from pointer Y relative to the over element rect.
 * Top 25% → before, bottom 25% → after, middle → inside (folder) or after (doc).
 */
export function inferDropPosition(
  overType: 'folder' | 'doc',
  clientY: number,
  rect: { top: number; height: number },
): TreeDropPosition {
  const ratio = rect.height <= 0 ? 0.5 : (clientY - rect.top) / rect.height;
  if (ratio < 0.25) return 'before';
  if (ratio > 0.75) return 'after';
  if (overType === 'folder') return 'inside';
  return 'after';
}
