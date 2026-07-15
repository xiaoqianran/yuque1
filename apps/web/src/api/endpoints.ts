import { apiRequest } from './client';
import type {
  ContentMeta,
  DocumentContent,
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
  saveAs: (nodeId: string, bodyMd: string, title?: string) =>
    apiRequest<{ node: PublicNode; content: DocumentContent }>(
      `/nodes/${nodeId}/content/save-as`,
      {
        method: 'POST',
        body: JSON.stringify({ bodyMd, title }),
      },
    ),
};

export const shareApi = {
  get: (nodeId: string) => apiRequest<ShareInfo>(`/nodes/${nodeId}/share`),
  enable: (nodeId: string) =>
    apiRequest<ShareInfo>(`/nodes/${nodeId}/share`, { method: 'PUT', body: '{}' }),
  disable: (nodeId: string) =>
    apiRequest<null>(`/nodes/${nodeId}/share`, { method: 'DELETE' }),
  publicGet: (token: string) => apiRequest<SharedDocument>(`/share/${token}`),
};
