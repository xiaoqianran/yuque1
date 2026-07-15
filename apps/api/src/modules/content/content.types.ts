export type KbRole = 'owner' | 'editor' | 'reader';

export type UserBrief = {
  id: string;
  nickname: string;
};

export type DocumentContentDto = {
  nodeId: string;
  bodyMd: string;
  version: number;
  updatedAt: string;
  updatedBy: UserBrief | null;
};

export type ContentMetaDto = {
  nodeId: string;
  version: number;
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
};

export type ServiceErr = {
  ok: false;
  code: string;
  message: string;
  http: number;
  details?: Record<string, unknown> | null;
};

export type ServiceOk<T> = { ok: true; data: T };
export type ServiceResult<T> = ServiceOk<T> | ServiceErr;
