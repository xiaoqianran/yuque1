export type KbRole = 'owner' | 'editor' | 'reader';
export type AssignableRole = 'editor' | 'reader';

export type PublicMember = {
  userId: string;
  mobileE164: string;
  nickname: string;
  role: KbRole;
  createdAt: string;
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
