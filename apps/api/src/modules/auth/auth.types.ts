export type SessionPayload = {
  userId: string;
  createdAt: string;
};

export type PublicUser = {
  id: string;
  mobileE164: string;
  nickname: string;
  mobileVerified: boolean;
  email: string | null;
  avatarUrl: string | null;
};

export const E164_RE = /^\+[1-9]\d{6,14}$/;
export const SMS_CODE_RE = /^\d{6}$/;
export const SID_COOKIE = 'sid';
