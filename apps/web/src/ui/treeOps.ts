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
