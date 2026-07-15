import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { authApi } from '../api/endpoints';
import { ApiError } from '../api/types';
import type { PublicUser } from '../api/types';

type AuthState = {
  user: PublicUser | null;
  loading: boolean;
  refresh: () => Promise<void>;
  login: (mobile: string, code: string, nickname?: string) => Promise<void>;
  logout: () => Promise<void>;
  sendSms: (mobile: string) => Promise<void>;
  updateProfile: (patch: {
    nickname?: string;
    email?: string | null;
  }) => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<PublicUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const me = await authApi.me();
      setUser(me);
    } catch (e) {
      if (e instanceof ApiError && e.http === 401) {
        setUser(null);
      } else {
        setUser(null);
      }
    }
  }, []);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      await refresh();
      setLoading(false);
    })();
  }, [refresh]);

  const login = useCallback(
    async (mobile: string, code: string, nickname?: string) => {
      const u = await authApi.login(mobile, code, nickname);
      setUser(u);
    },
    [],
  );

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } finally {
      setUser(null);
    }
  }, []);

  const sendSms = useCallback(async (mobile: string) => {
    await authApi.sendSms(mobile);
  }, []);

  const updateProfile = useCallback(
    async (patch: { nickname?: string; email?: string | null }) => {
      const u = await authApi.updateMe(patch);
      setUser(u);
    },
    [],
  );

  const value = useMemo(
    () => ({ user, loading, refresh, login, logout, sendSms, updateProfile }),
    [user, loading, refresh, login, logout, sendSms, updateProfile],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
