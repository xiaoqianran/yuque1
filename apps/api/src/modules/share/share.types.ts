export type KbRole = 'owner' | 'editor' | 'reader';

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

export type ServiceErr = {
  ok: false;
  code: string;
  message: string;
  http: number;
  details?: Record<string, unknown> | null;
};

export type ServiceOk<T> = { ok: true; data: T };
export type ServiceResult<T> = ServiceOk<T> | ServiceErr;
