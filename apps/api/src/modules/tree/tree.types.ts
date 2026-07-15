export type NodeType = 'folder' | 'doc';
export type KbRole = 'owner' | 'editor' | 'reader';

export type PublicNode = {
  id: string;
  knowledgeBaseId: string;
  parentId: string | null;
  type: NodeType;
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
