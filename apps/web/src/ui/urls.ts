/**
 * Build absolute public share URL for copy/paste.
 * Uses Vite BASE_URL (e.g. / or /proxy/5173/) + SPA route /s/:token.
 */
export function buildPublicShareUrl(
  token: string,
  opts?: { origin?: string; baseUrl?: string },
): string {
  const t = token.trim();
  if (!t) return '';
  const origin = (
    opts?.origin ?? (typeof window !== 'undefined' ? window.location.origin : '')
  ).replace(/\/$/, '');
  const base = (opts?.baseUrl ?? import.meta.env.BASE_URL ?? '/').replace(/\/?$/, '/');
  const path = `${base}s/${encodeURIComponent(t)}`.replace(/\/{2,}/g, '/');
  if (!origin) return path.startsWith('/') ? path : `/${path}`;
  return `${origin}${path.startsWith('/') ? path : `/${path}`}`;
}

export function confirmDeleteNodeMessage(title: string, type: 'folder' | 'doc'): string {
  const kind = type === 'folder' ? '文件夹' : '文档';
  return `确定删除${kind}「${title}」吗？\n\n有未删除子节点时会失败；此操作将移入回收站（软删）。`;
}

export function confirmPurgeNodeMessage(title: string, type: 'folder' | 'doc'): string {
  const kind = type === 'folder' ? '文件夹' : '文档';
  return `确定永久删除${kind}「${title}」吗？\n\n将从回收站彻底移除正文、历史快照与分享链接，不可恢复。\n若仍有子节点（含已删除子节点）会失败。`;
}

export function confirmDeleteKbMessage(name: string): string {
  return `确定删除知识库「${name}」吗？\n\n将软删库内文档并禁用分享，不可撤销。`;
}
