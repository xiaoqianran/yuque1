export type ApiEnvelope<T> = {
  success: boolean;
  data: T | null;
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown> | null;
  } | null;
  requestId: string;
};

export type PublicUser = {
  id: string;
  mobileE164: string;
  nickname: string;
  mobileVerified: boolean;
  email: string | null;
  avatarUrl: string | null;
};

export type PublicKb = {
  id: string;
  name: string;
  description: string | null;
  visibility: 'private';
  role: 'owner' | 'editor' | 'reader';
  createdAt: string;
  updatedAt: string;
};

export type PublicNode = {
  id: string;
  knowledgeBaseId: string;
  parentId: string | null;
  type: 'folder' | 'doc';
  title: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
};

export type DocumentContent = {
  nodeId: string;
  bodyMd: string;
  version: number;
  updatedAt: string;
  updatedBy: { id: string; nickname: string } | null;
};

export type ContentMeta = {
  nodeId: string;
  version: number;
  updatedAt: string;
};

export type ContentRevisionBrief = {
  id: string;
  version: number;
  reason: string;
  createdBy: { id: string; nickname: string } | null;
  createdAt: string;
};

export type ContentRevision = ContentRevisionBrief & {
  nodeId: string;
  bodyMd: string;
};

export type ShareInfo = {
  enabled: boolean;
  token: string | null;
  urlPath: string | null;
  expiresAt: string | null;
};

export type SharedDocument = {
  title: string;
  bodyMd: string;
  updatedAt: string | null;
};

export type KbMember = {
  userId: string;
  mobileE164: string;
  nickname: string;
  role: 'owner' | 'editor' | 'reader';
  createdAt: string;
};

export class ApiError extends Error {
  readonly code: string;
  readonly http: number;
  readonly details: Record<string, unknown> | null;

  constructor(
    code: string,
    message: string,
    http: number,
    details: Record<string, unknown> | null = null,
  ) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.http = http;
    this.details = details;
  }
}
