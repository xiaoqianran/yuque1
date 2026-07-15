import { apiRequest } from './client';
import type {
  ContentMeta,
  ContentRevision,
  ContentRevisionBrief,
  DocumentContent,
  KbMember,
  PublicKb,
  PublicNode,
  PublicUser,
  ShareInfo,
  SharedDocument,
} from './types';

export const authApi = {
  sendSms: (mobileE164: string) =>
    apiRequest<null>('/auth/sms/send', {
      method: 'POST',
      body: JSON.stringify({ mobileE164 }),
    }),
  login: (mobileE164: string, code: string, nickname?: string) =>
    apiRequest<PublicUser>('/auth/sms/login', {
      method: 'POST',
      body: JSON.stringify({ mobileE164, code, nickname }),
    }),
  logout: () => apiRequest<null>('/auth/logout', { method: 'POST' }),
  me: () => apiRequest<PublicUser>('/auth/me'),
  updateMe: (patch: { nickname?: string; email?: string | null }) =>
    apiRequest<PublicUser>('/auth/me', {
      method: 'PATCH',
      body: JSON.stringify(patch),
    }),
};

export const kbApi = {
  list: () =>
    apiRequest<{ items: PublicKb[]; page: number; pageSize: number; total: number }>(
      '/kbs',
    ),
  create: (name: string, description?: string) =>
    apiRequest<PublicKb>('/kbs', {
      method: 'POST',
      body: JSON.stringify({ name, description }),
    }),
  get: (kbId: string) => apiRequest<PublicKb>(`/kbs/${kbId}`),
  update: (
    kbId: string,
    patch: { name?: string; description?: string | null },
  ) =>
    apiRequest<PublicKb>(`/kbs/${kbId}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    }),
  remove: (kbId: string) => apiRequest<null>(`/kbs/${kbId}`, { method: 'DELETE' }),
};

export const treeApi = {
  list: (kbId: string) =>
    apiRequest<{ items: PublicNode[] }>(`/kbs/${kbId}/tree`),
  trash: (kbId: string) =>
    apiRequest<{ items: PublicNode[] }>(`/kbs/${kbId}/trash`),
  search: (kbId: string, q: string, limit = 50) =>
    apiRequest<{ items: PublicNode[] }>(
      `/kbs/${kbId}/nodes?q=${encodeURIComponent(q)}&limit=${limit}`,
    ),
  create: (
    kbId: string,
    input: { type: 'folder' | 'doc'; title: string; parentId?: string | null },
  ) =>
    apiRequest<PublicNode>(`/kbs/${kbId}/nodes`, {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  update: (nodeId: string, title: string) =>
    apiRequest<PublicNode>(`/nodes/${nodeId}`, {
      method: 'PATCH',
      body: JSON.stringify({ title }),
    }),
  move: (nodeId: string, parentId: string | null, sortOrder?: number) =>
    apiRequest<PublicNode>(`/nodes/${nodeId}/move`, {
      method: 'POST',
      body: JSON.stringify(
        sortOrder === undefined ? { parentId } : { parentId, sortOrder },
      ),
    }),
  remove: (nodeId: string) =>
    apiRequest<null>(`/nodes/${nodeId}`, { method: 'DELETE' }),
  restore: (nodeId: string) =>
    apiRequest<PublicNode>(`/nodes/${nodeId}/restore`, { method: 'POST' }),
  /** Hard-delete a soft-deleted node (trash permanent). */
  purge: (nodeId: string) =>
    apiRequest<null>(`/nodes/${nodeId}/permanent`, { method: 'DELETE' }),
};

export const contentApi = {
  get: (nodeId: string) => apiRequest<DocumentContent>(`/nodes/${nodeId}/content`),
  put: (nodeId: string, expectedVersion: number, bodyMd: string) =>
    apiRequest<ContentMeta>(`/nodes/${nodeId}/content`, {
      method: 'PUT',
      body: JSON.stringify({ expectedVersion, bodyMd }),
    }),
  overwrite: (nodeId: string, baseVersion: number, bodyMd: string) =>
    apiRequest<ContentMeta>(`/nodes/${nodeId}/content/overwrite`, {
      method: 'POST',
      body: JSON.stringify({ baseVersion, bodyMd }),
    }),
  saveAs: (
    nodeId: string,
    bodyMd: string,
    opts?: { title?: string; parentId?: string | null },
  ) =>
    apiRequest<{ node: PublicNode; content: DocumentContent }>(
      `/nodes/${nodeId}/content/save-as`,
      {
        method: 'POST',
        body: JSON.stringify({
          bodyMd,
          ...(opts?.title !== undefined ? { title: opts.title } : {}),
          ...(opts?.parentId !== undefined ? { parentId: opts.parentId } : {}),
        }),
      },
    ),
  listRevisions: (nodeId: string) =>
    apiRequest<{ items: ContentRevisionBrief[] }>(
      `/nodes/${nodeId}/content/revisions`,
    ),
  getRevision: (nodeId: string, revisionId: string) =>
    apiRequest<ContentRevision>(
      `/nodes/${nodeId}/content/revisions/${revisionId}`,
    ),
};

export const shareApi = {
  get: (nodeId: string) => apiRequest<ShareInfo>(`/nodes/${nodeId}/share`),
  enable: (nodeId: string, opts?: { expiresAt?: string | null }) =>
    apiRequest<ShareInfo>(`/nodes/${nodeId}/share`, {
      method: 'PUT',
      body: JSON.stringify(opts ?? {}),
    }),
  disable: (nodeId: string) =>
    apiRequest<null>(`/nodes/${nodeId}/share`, { method: 'DELETE' }),
  publicGet: (token: string) => apiRequest<SharedDocument>(`/share/${token}`),
};

export const membersApi = {
  list: (kbId: string) =>
    apiRequest<{ items: KbMember[] }>(`/kbs/${kbId}/members`),
  add: (kbId: string, mobileE164: string, role: 'editor' | 'reader') =>
    apiRequest<KbMember>(`/kbs/${kbId}/members`, {
      method: 'POST',
      body: JSON.stringify({ mobileE164, role }),
    }),
  updateRole: (kbId: string, userId: string, role: 'editor' | 'reader') =>
    apiRequest<KbMember>(`/kbs/${kbId}/members/${userId}`, {
      method: 'PATCH',
      body: JSON.stringify({ role }),
    }),
  remove: (kbId: string, userId: string) =>
    apiRequest<null>(`/kbs/${kbId}/members/${userId}`, { method: 'DELETE' }),
  transferOwner: (kbId: string, userId: string) =>
    apiRequest<KbMember>(`/kbs/${kbId}/transfer-owner`, {
      method: 'POST',
      body: JSON.stringify({ userId }),
    }),
};
