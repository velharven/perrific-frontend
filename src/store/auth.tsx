import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import type { User } from '@/types';
import { api, getToken, setToken, clearToken } from '@/lib/api';

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  bootFailed: boolean;
  login: (identifier: string, password: string) => Promise<void>;
  register: (input: { name: string; email: string; username: string; password: string }) => Promise<void>;
  loginWithGoogle: (accessToken: string) => Promise<void>;
  updateProfile: (body: { name?: string; username?: string | null; avatarUrl?: string | null }) => Promise<void>;
  changePassword: (body: { currentPassword?: string; newPassword: string }) => Promise<void>;
  retry: () => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  // true bila verifikasi awal gagal BUKAN karena sesi invalid (mis. backend
  // mati sesaat): token dipertahankan agar bisa sambung ulang otomatis.
  const [bootFailed, setBootFailed] = useState(false);

  const fetchMe = useCallback(async () => {
    const token = getToken();
    if (!token) {
      setUser(null);
      setBootFailed(false);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await api.get<{ data: User }>('/auth/me');
      setUser(res.data.data);
      setBootFailed(false);
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status === 401) {
        clearToken();
        setUser(null);
        setBootFailed(false);
      } else {
        setUser(null);
        setBootFailed(true);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchMe();
  }, [fetchMe]);

  async function login(identifier: string, password: string) {
    const res = await api.post('/auth/login', { identifier, password });
    setToken(res.data.data.token);
    setUser(res.data.data.user);
  }

  async function register(input: { name: string; email: string; username: string; password: string }) {
    const res = await api.post('/auth/register', input);
    setToken(res.data.data.token);
    setUser(res.data.data.user);
  }

  async function loginWithGoogle(accessToken: string) {
    const res = await api.post('/auth/google', { accessToken });
    setToken(res.data.data.token);
    setUser(res.data.data.user);
  }

  async function updateProfile(body: { name?: string; username?: string | null; avatarUrl?: string | null }) {
    const res = await api.patch('/auth/me', body);
    setUser(res.data.data);
  }

  async function changePassword(body: { currentPassword?: string; newPassword: string }) {
    await api.post('/auth/me/password', body);
  }

  function logout() {
    clearToken();
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, loading, bootFailed, login, register, loginWithGoogle,
updateProfile, changePassword, retry: fetchMe, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth harus dipakai di dalam AuthProvider');
  return ctx;
}
