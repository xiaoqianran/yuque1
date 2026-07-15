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
  return `确定删除${kind}「${title}」吗？\n\n有未删除子节点时会失败；此操作不可撤销（软删）。`;
}

export function confirmDeleteKbMessage(name: string): string {
  return `确定删除知识库「${name}」吗？\n\n将软删库内文档并禁用分享，不可撤销。`;
}
